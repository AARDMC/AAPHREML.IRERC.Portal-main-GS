import { useState } from "react";
import { FileCheck2, Lock, Upload } from "lucide-react";
import { useIrerc } from "@/lib/irerc/store";
import {
  FINAL_PROTOCOL_CODE,
  type FinalProtocolStatus,
  type Protocol,
} from "@/lib/irerc/model";
import { saveDocument } from "@/lib/irerc/file-store";
import { REMOTE } from "@/lib/irerc/remote-flag";
import { Btn, Card, Chip } from "@/components/irerc/ui";
import { DocumentActions } from "@/components/irerc/document-actions";

const STATUS_LABEL: Record<FinalProtocolStatus, string> = {
  not_started: "Not started",
  draft: "Draft uploaded",
  submitted: "Submitted to reviewers",
  under_review: "Under review",
  accepted: "Accepted",
  rejected: "Revision required",
};

const STATUS_TONE: Record<FinalProtocolStatus, "muted" | "sky" | "amber" | "em" | "rose"> = {
  not_started: "muted",
  draft: "sky",
  submitted: "amber",
  under_review: "amber",
  accepted: "em",
  rejected: "rose",
};

export function FinalProtocolPanel({ protocol }: { protocol: Protocol }) {
  const role = useIrerc((s) => s.role);
  const uploadFinal = useIrerc((s) => s.uploadFinalProtocol);
  const submitFinal = useIrerc((s) => s.submitFinalProtocol);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const final = protocol.finalProtocol;
  if (!protocol.revision && !final) return null;

  const versions = final?.versions ?? [];
  const currentVersion = versions.reduce((max, version) => Math.max(max, version.version), 0);
  const status = final?.status ?? "not_started";
  const canUpload = role === "investigator" && status !== "accepted";

  async function upload() {
    if (!file) {
      setError("Choose the revised protocol PDF first.");
      return;
    }
    if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== "application/pdf")) {
      setError("Only PDF files are accepted for the revised/final research protocol.");
      return;
    }
    const limitMb = REMOTE ? 3 : 10;
    if (file.size > limitMb * 1024 * 1024) {
      setError(`The PDF must be ${limitMb} MB or smaller.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const version = currentVersion + 1;
      await saveDocument(protocol.id, FINAL_PROTOCOL_CODE, file, version);
      uploadFinal(protocol.id, {
        code: FINAL_PROTOCOL_CODE,
        version,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        uploadedBy: protocol.submission.piName,
        note: "Revised/final protocol PDF",
      });
      setFile(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The final protocol could not be stored.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-sky/30 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <FileCheck2 className="size-4 text-sky" /> Revised / Final Research Protocol
          </h2>
          <p className="text-sm text-muted">
            Independent PDF workflow. Application ID <span className="font-semibold text-fg">{protocol.id}</span>.
          </p>
        </div>
        <Chip tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Chip>
      </div>

      <div className="mt-3 grid gap-2 rounded-xl border border-line bg-panel-2/40 p-3 text-xs text-muted sm:grid-cols-2">
        <p className="flex items-center gap-1.5">
          <Lock className="size-3.5" />
          {protocol.initialProtocolLockedAt && !["submitted", "screening", "correction"].includes(protocol.status)
            ? `Initial protocol locked ${new Date(protocol.initialProtocolLockedAt).toLocaleString()}`
            : "Initial protocol editable until forwarded to reviewers"}
        </p>
        <p>
          Final protocol versions: <span className="font-semibold text-fg">{versions.length}</span>
          {currentVersion ? ` · current v${currentVersion}` : ""}
        </p>
        <p>Submitted to reviewers: {final?.submittedAt ? new Date(final.submittedAt).toLocaleString() : "Not yet"}</p>
        <p>Last update: {final?.updatedAt ? new Date(final.updatedAt).toLocaleString() : "—"}</p>
      </div>

      <div className="mt-3 rounded-xl border border-sky/20 bg-sky/5 p-3 text-sm">
        <p className="font-semibold text-sky">PDF only · no time limit</p>
        <p className="mt-1 text-muted">
          The original protocol is locked and cannot be replaced. Each revised/final protocol is stored as a new PDF version under the same application ID.
        </p>
      </div>

      {versions.length ? (
        <div className="mt-3 rounded-xl border border-line p-3">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Current final protocol</p>
          <div className="mt-2">
            <DocumentActions protocolId={protocol.id} code={FINAL_PROTOCOL_CODE} versions={versions} />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">No revised/final protocol PDF has been uploaded yet.</p>
      )}

      {canUpload ? (
        <div className="mt-4 rounded-xl border border-line bg-panel-2/40 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Upload className="size-4" /> Upload revised/final protocol
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-xl border border-line px-3 py-2 text-xs font-semibold">
              Choose PDF
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(event) => {
                  const selected = event.target.files?.[0];
                  if (selected) setFile(selected);
                  event.target.value = "";
                }}
              />
            </label>
            <span className="min-w-0 flex-1 truncate text-xs text-muted">{file ? file.name : "No PDF selected"}</span>
            <Btn className="px-3 py-1.5 text-xs" disabled={busy || !file} onClick={() => void upload()}>
              {busy ? "Uploading…" : `Upload as v${currentVersion + 1}`}
            </Btn>
          </div>
          {versions.length && status !== "submitted" && status !== "under_review" ? (
            <Btn className="mt-3" kind="go" onClick={() => submitFinal(protocol.id)}>
              Submit revised protocol to reviewers
            </Btn>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-3 rounded-xl border border-rose/30 bg-rose/10 px-3 py-2 text-xs text-rose">{error}</p> : null}
    </Card>
  );
}

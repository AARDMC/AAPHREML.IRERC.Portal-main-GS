import { useEffect, useMemo, useState } from "react";
import { Clock, RefreshCw, Upload } from "lucide-react";
import { useIrerc } from "@/lib/irerc/store";
import {
  DOC_DEFS,
  isRevisionOpen,
  revisionRemainingMs,
  type Protocol,
} from "@/lib/irerc/model";
import { saveDocument } from "@/lib/irerc/file-store";
import { REMOTE } from "@/lib/irerc/remote-flag";
import { Btn, Card, Chip } from "@/components/irerc/ui";

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

export function RevisionPanel({ protocol }: { protocol: Protocol }) {
  const role = useIrerc((s) => s.role);
  const recordDocumentRevision = useIrerc((s) => s.recordDocumentRevision);
  const submitRevision = useIrerc((s) => s.submitRevision);
  const extendRevision = useIrerc((s) => s.extendRevision);
  const [now, setNow] = useState(() => Date.now());
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const revision = protocol.revision;
  const open = isRevisionOpen(protocol, now);
  const remaining = revisionRemainingMs(protocol, now);
  const expired = revision?.status === "requested" && !open;
  const versions = useMemo(() => protocol.documentVersions ?? [], [protocol.documentVersions]);
  const canUpload = role === "investigator" && open;
  const canExtend = role === "admin" && revision?.status !== "submitted" && revision?.status !== "closed";
  const hasSupportingRevision = versions.some((version) => version.version > 1 && version.code !== "DOC_PROTOCOL");

  if (!revision) return null;

  async function upload(code: string, name: string) {
    const file = files[code];
    if (!file) {
      setError(`Choose a revised file for ${name} first.`);
      return;
    }
    const limitMb = REMOTE ? 3 : 5;
    if (file.size > limitMb * 1024 * 1024) {
      setError(`The revised file must be ${limitMb} MB or smaller.`);
      return;
    }
    setBusy(code);
    setError(null);
    try {
      const nextVersion = versions.filter((v) => v.code === code).reduce((max, v) => Math.max(max, v.version), 0) + 1;
      await saveDocument(protocol.id, code, file, nextVersion);
      recordDocumentRevision(protocol.id, {
        code,
        version: nextVersion,
        name: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        uploadedBy: protocol.submission.piName,
        note: "Revision upload",
      });
      setFiles((prev) => ({ ...prev, [code]: undefined }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The revised document could not be stored.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="border-sky/30 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <RefreshCw className="size-4 text-sky" /> Document revision
          </h2>
          <p className="text-sm text-muted">Reviewer comments and the PI revision window.</p>
        </div>
        <Chip tone={open ? "amber" : expired ? "rose" : revision.status === "submitted" ? "em" : "muted"}>
          {open ? "Window open" : expired ? "Window expired" : revision.status === "submitted" ? "Revisions submitted" : "Closed"}
        </Chip>
      </div>

      <div className={`mt-3 rounded-xl border p-3 ${open ? "border-amber/40 bg-amber/10" : "border-line bg-panel-2/50"}`}>
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          <Clock className="size-4" />
          {open ? `Time remaining: ${formatRemaining(remaining)}` : expired ? "The 48-hour window has ended." : revision.status === "submitted" ? `Submitted ${revision.submittedAt ? new Date(revision.submittedAt).toLocaleString() : ""}` : "Closed"}
        </p>
        <p className="mt-1 text-xs text-muted">
          Requested by {revision.requestedBy} on {new Date(revision.requestedAt).toLocaleString()} · Deadline{" "}
          {new Date(revision.dueAt).toLocaleString()}
          {revision.extendedBy ? ` · Extended by ${revision.extendedBy} on ${new Date(revision.extendedAt ?? "").toLocaleString()}` : ""}
        </p>
      </div>

      <div className="mt-3 rounded-xl border border-line bg-panel-2/40 p-3">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">Required revisions</p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{revision.comments}</p>
      </div>

      {(protocol.reviews.length || revision.reviews?.length) ? (
        <div className="mt-3">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Reviewer comments and recommendations</p>
          <ul className="mt-2 space-y-2">
            {(protocol.reviews.length ? protocol.reviews : revision.reviews ?? []).map((review, index) => (
              <li key={`${review.reviewer}-${review.date}`} className="rounded-xl border border-line bg-panel p-3 text-sm">
                <p className="font-semibold">
                  {role === "investigator" ? `Reviewer ${String(index + 1).padStart(2, "0")}` : review.reviewer}
                  <span className="ml-2 text-xs font-normal text-muted">{review.recommendation}</span>
                </p>
                {review.comments ? <p className="mt-1 text-muted">{review.comments}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canUpload ? (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Upload className="size-4" /> Upload revised supporting documents</p>
          <p className="mb-2 text-xs text-muted">The initial research protocol is locked. Upload the revised/final protocol PDF in the Final Protocol section below.</p>
          <div className="space-y-2">
            {DOC_DEFS.filter((doc) => doc.code !== "DOC_PROTOCOL").map((doc) => {
              const current = versions.filter((v) => v.code === doc.code).reduce((max, v) => Math.max(max, v.version), 0);
              return (
                <div key={doc.code} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel-2/40 p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{doc.name}</p>
                    <p className="text-xs text-muted">
                      Current version {current || 1}
                      {files[doc.code] ? ` · selected: ${files[doc.code]?.name}` : ""}
                    </p>
                  </div>
                  <label className="cursor-pointer rounded-xl border border-line px-3 py-2 text-xs font-semibold">
                    Choose file
                    <input
                      type="file"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) setFiles((prev) => ({ ...prev, [doc.code]: file }));
                        event.target.value = "";
                      }}
                    />
                  </label>
                  <Btn className="px-3 py-1.5 text-xs" disabled={busy === doc.code || !files[doc.code]} onClick={() => void upload(doc.code, doc.name)}>
                    {busy === doc.code ? "Uploading…" : "Upload revision"}
                  </Btn>
                </div>
              );
            })}
          </div>
          {hasSupportingRevision ? (
            <Btn className="mt-3" kind="go" onClick={() => submitRevision(protocol.id)}>
              Submit revised supporting documents to reviewers
            </Btn>
          ) : (
            <p className="mt-3 text-xs text-muted">
              Upload at least one revised supporting document, or submit the final protocol PDF in the Final Protocol section.
            </p>
          )}
        </div>
      ) : null}

      {expired ? (
        <p className="mt-3 rounded-xl border border-rose/30 bg-rose/10 p-3 text-sm text-rose">
          Editing and uploading are restricted. The PI must ask the System Administrator for an extension.
        </p>
      ) : null}

      {canExtend ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Btn onClick={() => extendRevision(protocol.id, 48)}>Extend window by 48 hours</Btn>
          <span className="text-xs text-muted">Administrator authority only.</span>
        </div>
      ) : null}

      {error ? <p className="mt-3 rounded-xl border border-rose/30 bg-rose/10 px-3 py-2 text-xs text-rose">{error}</p> : null}
    </Card>
  );
}

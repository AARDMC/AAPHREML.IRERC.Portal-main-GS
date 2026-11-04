import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ExternalLink, FileText, MessageSquare, ShieldCheck } from "lucide-react";
import { useIrerc } from "@/lib/irerc/store";
import {
  FINAL_PROTOCOL_CODE,
  isSubmissionUpdateOpen,
  type DocumentComment,
  type DocumentVersion,
  type RoleKey,
} from "@/lib/irerc/model";
import { downloadDocument, getDocument, openDocument } from "@/lib/irerc/file-store";
import { Btn, Chip, Modal, fieldClass } from "@/components/irerc/ui";

function sanitizeHtml(html: string): string {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  parsed.querySelectorAll("script,style,iframe,object,embed,link,meta").forEach((node) => node.remove());
  parsed.querySelectorAll("*").forEach((node) => {
    for (const attribute of [...node.attributes]) {
      if (/^on/i.test(attribute.name)) node.removeAttribute(attribute.name);
      if (attribute.name === "href" && /^javascript:/i.test(attribute.value)) node.removeAttribute("href");
    }
  });
  return parsed.body.innerHTML;
}

function authorLabel(comment: DocumentComment, comments: DocumentComment[], role: RoleKey | null): string {
  if (role !== "investigator") return comment.author;
  if (comment.authorRole === "reviewer") {
    const names = [...new Set(comments.filter((c) => c.authorRole === "reviewer").map((c) => c.author))];
    return `Reviewer ${String(names.indexOf(comment.author) + 1).padStart(2, "0")}`;
  }
  if (comment.authorRole === "secretariat") return "Secretariat";
  if (comment.authorRole === "chair") return "Chairperson";
  return "System Administrator";
}

export function DocumentReviewModal({
  id,
  initialCode,
  onClose,
}: {
  id: string;
  initialCode?: string;
  onClose: () => void;
}) {
  const protocol = useIrerc((s) => s.protocols.find((p) => p.id === id));
  const role = useIrerc((s) => s.role);
  const acting = useIrerc((s) => s.actingReviewer);
  const addComment = useIrerc((s) => s.addDocumentComment);
  const toggleComment = useIrerc((s) => s.toggleDocumentComment);
  const openModal = useIrerc((s) => s.openModal);
  const previewRef = useRef<HTMLDivElement>(null);
  const [code, setCode] = useState(initialCode ?? "DOC_PROTOCOL");
  const [version, setVersion] = useState(1);
  const [html, setHtml] = useState("");
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [kind, setKind] = useState<"docx" | "pdf" | "other" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState("");
  const [text, setText] = useState("");

  const initialVersions = useMemo(
    () => (protocol?.documentVersions ?? []).filter((item) => item.code === "DOC_PROTOCOL"),
    [protocol?.documentVersions],
  );
  const finalVersions = protocol?.finalProtocol?.versions ?? [];
  const versions: DocumentVersion[] = code === FINAL_PROTOCOL_CODE ? finalVersions : initialVersions;
  const comments = (protocol?.documentComments ?? []).filter(
    (comment) => comment.code === code && comment.version === version,
  );
  const initialMax = initialVersions.reduce((max, item) => Math.max(max, item.version), 0);
  const finalMax = finalVersions.reduce((max, item) => Math.max(max, item.version), 0);

  useEffect(() => {
    if (code === FINAL_PROTOCOL_CODE) setVersion(Math.max(1, finalMax));
    else setVersion(Math.max(1, initialMax));
    // The document set changes only when the protocol, source or version list changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protocol?.id, code, protocol?.documentVersions?.length, protocol?.finalProtocol?.versions.length]);

  useEffect(() => {
    if (!protocol) return;
    let active = true;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);
    setHtml("");
    setKind(null);
    setDocUrl(null);
    void getDocument(protocol.id, code, version)
      .then(async (versionedRecord) => {
        // Older builds stored only a pointer record. Fall back to it so existing
        // uploads remain reviewable instead of showing an empty workspace.
        const record = versionedRecord ?? (await getDocument(protocol.id, code));
        if (!active) return;
        if (!record) {
          setError("No stored file was found for this protocol. It may have been submitted before document storage was enabled; the PI must re-upload it through Update Submission or the final-protocol workflow.");
          setLoading(false);
          return;
        }
        objectUrl = URL.createObjectURL(record.blob);
        setDocUrl(objectUrl);
        const isPdf = record.type === "application/pdf" || /\.pdf$/i.test(record.name);
        const isWord = /\.docx$/i.test(record.name) || record.type.includes("word");
        if (isPdf) {
          setKind("pdf");
          setLoading(false);
          return;
        }
        if (isWord) {
          setKind("docx");
          try {
            const mammoth = (await import("mammoth")).default;
            const arrayBuffer = await record.blob.arrayBuffer();
            const result = await mammoth.convertToHtml({ arrayBuffer, buffer: arrayBuffer } as {
              arrayBuffer: ArrayBuffer;
            });
            if (active) setHtml(sanitizeHtml(result.value));
          } catch {
            if (active) setError("The Word document could not be rendered. Open it in a new tab or download it.");
          }
          setLoading(false);
          return;
        }
        setKind("other");
        setLoading(false);
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "The document could not be opened.");
        setLoading(false);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  // Reload only when the protocol, selected document or version changes — not when a comment is added.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protocol?.id, code, version, protocol?.documentVersions?.length, protocol?.finalProtocol?.versions.length]);

  function captureSelection() {
    const selection = window.getSelection();
    const selected = selection?.toString().trim() ?? "";
    const anchor = selection?.anchorNode;
    if (selected && anchor && previewRef.current?.contains(anchor)) {
      setQuote(selected.slice(0, 500));
    }
  }

  if (!protocol) return null;

  function openSeparately() {
    void openDocument(id, code, version).catch((cause) => {
      setError(cause instanceof Error ? cause.message : "The document could not be opened.");
    });
  }

  function downloadCopy() {
    void downloadDocument(id, code, version).catch((cause) => {
      setError(cause instanceof Error ? cause.message : "The document could not be downloaded.");
    });
  }

  const availableComments = comments.length;
  const finalAvailable = finalVersions.length > 0;
  const canComment = role === "reviewer" && protocol.reviewers.includes(acting);
  const viewOnly = role !== "reviewer";

  return (
    <Modal
      title="Document review workspace"
      onClose={onClose}
      wide
      footer={
        <>
          <Btn onClick={onClose}>Close</Btn>
          {role === "investigator" ? (
            <Btn onClick={openSeparately}>
              <ExternalLink className="size-4" /> Open original in new tab
            </Btn>
          ) : null}
          {role === "investigator" ? (
            <Btn onClick={downloadCopy}>
              <Download className="size-4" /> Download
            </Btn>
          ) : null}
        </>
      }
    >
      <div className="rounded-xl border border-em/30 bg-em/10 p-3 text-xs">
        <p className="flex items-center gap-2 font-semibold text-em">
          <ShieldCheck className="size-4" /> The PI's original document is protected
        </p>
        <p className="mt-1 text-muted">
          Comments and annotations are stored separately. Opening or commenting never modifies the
          uploaded file, and the PI can read every comment and submit a revised document through the
          revision/final-protocol workflow. Download is restricted to the PI; all other roles can view
          and comment inside this workspace.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => { setCode("DOC_PROTOCOL"); setVersion(Math.max(1, initialMax)); }}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${code === "DOC_PROTOCOL" ? "border-sky bg-sky/15 text-sky" : "border-line text-muted"}`}
        >
          Initial protocol
        </button>
        {finalAvailable ? (
          <button
            type="button"
            onClick={() => { setCode(FINAL_PROTOCOL_CODE); setVersion(Math.max(1, finalVersions.reduce((max, item) => Math.max(max, item.version), 0))); }}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${code === FINAL_PROTOCOL_CODE ? "border-sky bg-sky/15 text-sky" : "border-line text-muted"}`}
          >
            Revised / final protocol
          </button>
        ) : null}
        <select
          className="min-h-10 rounded-xl border border-line bg-panel px-3 text-xs"
          value={version}
          onChange={(event) => setVersion(Number(event.target.value))}
        >
          {versions.length === 0 ? <option value={version}>Stored document</option> : null}
          {versions.map((item) => (
            <option key={`${item.code}-${item.version}`} value={item.version}>
              Version {item.version} · {item.name}
            </option>
          ))}
        </select>
        <Chip tone="em">Original read-only</Chip>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-h-72 overflow-hidden rounded-xl border border-line bg-panel">
          {loading ? (
            <div className="grid h-80 place-items-center text-sm text-muted">Opening document…</div>
          ) : error ? (
            <div className="p-4">
              <p className="text-sm text-rose">{error}</p>
              {role === "investigator" ? (
                <>
                  <Btn className="mt-3" onClick={openSeparately}>
                    <ExternalLink className="size-4" /> Open in separate browser tab
                  </Btn>
                  {isSubmissionUpdateOpen(protocol) ? (
                    <Btn className="mt-2" kind="primary" onClick={() => openModal({ type: "update", id: protocol.id })}>
                      Update Submission and re-upload
                    </Btn>
                  ) : (
                    <p className="mt-2 text-xs text-muted">
                      The update window is closed. Ask the Secretariat to open a revision window, then upload the final protocol PDF.
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-2 text-xs text-muted">
                  The file is not stored in this browser/origin. Ask the PI or Secretariat to re-upload it before review.
                </p>
              )}
            </div>
          ) : kind === "pdf" && docUrl ? (
            <iframe
              title="Protocol PDF"
              src={`${docUrl}${role === "investigator" ? "" : "#toolbar=0&navpanes=0"}`}
              className="h-[65vh] w-full"
            />
          ) : kind === "other" ? (
            <div className="p-4">
              <p className="text-sm text-muted">This file type cannot be previewed in the browser.</p>
              {role === "investigator" ? (
                <Btn className="mt-3" onClick={openSeparately}>
                  <ExternalLink className="size-4" /> Open in separate browser tab
                </Btn>
              ) : (
                <p className="mt-2 text-xs text-muted">Ask the Secretariat to provide a PDF version for review.</p>
              )}
            </div>
          ) : html ? (
            <div
              ref={previewRef}
              className="doc-preview max-h-[65vh] overflow-y-auto p-5"
              onMouseUp={captureSelection}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <div className="p-4">
              <p className="text-sm text-muted">No readable text was found in this document.</p>
              {role === "investigator" ? (
                <Btn className="mt-3" onClick={openSeparately}>
                  <ExternalLink className="size-4" /> Open in separate browser tab
                </Btn>
              ) : null}
            </div>
          )}
        </div>

        <aside className="flex max-h-[65vh] flex-col overflow-hidden rounded-xl border border-line bg-panel">
          <div className="border-b border-line px-3 py-2.5">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              <MessageSquare className="size-4 text-sky" /> Review comments ({availableComments})
              {viewOnly ? <Chip tone="muted">View only</Chip> : null}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">Comments are linked to this exact document version.</p>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {comments.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted">No comments on this version yet.</p>
            ) : (
              comments.map((comment) => (
                <article key={comment.id} className={`rounded-xl border p-3 text-xs ${comment.resolved ? "border-em/30 bg-em/5" : "border-line bg-panel-2/40"}`}>
                  {comment.quote ? (
                    <blockquote className="mb-2 rounded-lg border-l-2 border-sky/50 bg-sky/5 px-2 py-1 text-[11px] text-muted">
                      “{comment.quote}”
                    </blockquote>
                  ) : null}
                  <p className="leading-relaxed">{comment.text}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                    <span className="font-semibold text-fg">{authorLabel(comment, comments, role)}</span>
                    <span>· {new Date(comment.createdAt).toLocaleString()}</span>
                    {comment.resolved ? <Chip tone="em">Resolved</Chip> : null}
                    {canComment ? (
                      <button type="button" className="font-semibold text-sky" onClick={() => toggleComment(protocol.id, comment.id)}>
                        {comment.resolved ? "Reopen" : "Resolve"}
                      </button>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>

          {role === "investigator" ? (
            <p className="border-t border-line p-3 text-xs text-muted">
              Reviewer comments are read-only for the PI. Use the revised/final protocol workflow to respond with a new version.
            </p>
          ) : !canComment ? (
            <p className="border-t border-line p-3 text-xs text-muted">
              {viewOnly
                ? "The comment section is view-only for the Secretariat, Chairperson and Administrator. Assigned reviewers add and resolve review comments."
                : "Only reviewers assigned to this protocol can add or resolve comments."}
            </p>
          ) : (
            <div className="border-t border-line p-3">
              {quote ? (
                <div className="mb-2 flex items-start gap-2 rounded-lg border border-sky/20 bg-sky/5 p-2 text-[11px]">
                  <span className="flex-1 text-muted">Selected: “{quote}”</span>
                  <button type="button" className="font-semibold text-rose" onClick={() => setQuote("")}>Clear</button>
                </div>
              ) : null}
              <label className="text-xs font-semibold text-fg">
                Add comment
                <textarea
                  className={`${fieldClass} min-h-24 text-xs`}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="Select text in the document, then write your comment or feedback."
                />
              </label>
              <Btn
                className="mt-2 w-full"
                kind="primary"
                disabled={!text.trim()}
                onClick={() => {
                  addComment(protocol.id, { code, version, text, quote });
                  setText("");
                  setQuote("");
                }}
              >
                Add comment
              </Btn>
            </div>
          )}
        </aside>
      </div>

      <p className="mt-3 text-[11px] text-muted">
        <FileText className="mr-1 inline size-3.5" /> Word documents are rendered from the uploaded
        file. If rendering is unavailable, use “Open original in new tab” or Download.
      </p>
    </Modal>
  );
}

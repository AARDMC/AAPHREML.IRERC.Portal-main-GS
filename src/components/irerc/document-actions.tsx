import { useEffect, useState } from "react";
import { Download, Eye } from "lucide-react";
import { Btn } from "@/components/irerc/ui";
import { useIrerc } from "@/lib/irerc/store";
import { downloadDocument, hasDocument, openDocument } from "@/lib/irerc/file-store";
import type { DocumentVersion } from "@/lib/irerc/model";

export function DocumentActions({
  protocolId,
  code,
  versions = [],
}: {
  protocolId: string;
  code: string;
  versions?: DocumentVersion[];
}) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const role = useIrerc((s) => s.role);
  const openModal = useIrerc((s) => s.openModal);
  const canDownload = role === "investigator";

  useEffect(() => {
    let active = true;
    void hasDocument(protocolId, code)
      .then((exists) => {
        if (active) setAvailable(exists);
      })
      .catch(() => {
        if (active) setAvailable(false);
      });
    return () => {
      active = false;
    };
  }, [protocolId, code]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The document could not be opened.");
    } finally {
      setBusy(false);
    }
  }

  function viewCurrent() {
    if (role === "investigator") {
      void run(() => openDocument(protocolId, code));
    } else {
      openModal({ type: "review", id: protocolId, code });
    }
  }

  if (available === null) {
    return <span className="text-xs text-muted">Checking file…</span>;
  }
  if (!available) {
    return <span className="text-xs text-muted">File not stored</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Btn className="px-2.5 py-1 text-xs" disabled={busy} onClick={viewCurrent}>
        <Eye className="size-3.5" /> View
      </Btn>
      {canDownload ? (
        <Btn className="px-2.5 py-1 text-xs" disabled={busy} onClick={() => void run(() => downloadDocument(protocolId, code))}>
          <Download className="size-3.5" /> Download
        </Btn>
      ) : null}
      {versions.length > 1 ? (
        <details className="w-full">
          <summary className="cursor-pointer text-xs font-semibold text-sky">
            Version history ({versions.length})
          </summary>
          <ul className="mt-1.5 space-y-1 rounded-lg border border-line bg-panel-2/50 p-2">
            {[...versions]
              .sort((a, b) => b.version - a.version)
              .map((version) => (
                <li key={`${version.code}-${version.version}`} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold">v{version.version}</span>
                  <span className="min-w-0 flex-1 truncate text-muted">
                    {version.name} · {new Date(version.uploadedAt).toLocaleString()}
                  </span>
                  <button
                    type="button"
                    className="font-semibold text-sky"
                    onClick={() => {
                      if (role === "investigator") void run(() => openDocument(protocolId, code, version.version));
                      else openModal({ type: "review", id: protocolId, code });
                    }}
                  >
                    View
                  </button>
                  {canDownload ? (
                    <button
                      type="button"
                      className="font-semibold text-sky"
                      onClick={() => void run(() => downloadDocument(protocolId, code, version.version))}
                    >
                      Download
                    </button>
                  ) : null}
                </li>
              ))}
          </ul>
        </details>
      ) : null}
      {error ? <span className="w-full text-xs text-rose">{error}</span> : null}
    </div>
  );
}

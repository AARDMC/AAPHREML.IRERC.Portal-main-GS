import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  FileText,
  Loader2,
  ScanLine,
  Upload,
  X,
} from "lucide-react";
import type { ScanResult } from "@/lib/irerc/model";
import { scanProtocolFile, scanProtocolText, SECTION_TOTAL } from "@/lib/irerc/scanner";
import { Btn, Chip } from "@/components/irerc/ui";

export function ProposalScanner({
  value,
  onChange,
  onExtracted,
  onFileSelected,
}: {
  value: ScanResult | null;
  onChange: (result: ScanResult | null) => void;
  onExtracted?: (extracted: ScanResult["extracted"]) => void;
  onFileSelected?: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textMode, setTextMode] = useState(false);
  const [text, setText] = useState("");

  const scoreColor = useMemo(() => {
    if (!value) return "var(--color-muted)";
    if (value.completeness >= 90) return "var(--color-em)";
    if (value.completeness >= 65) return "var(--color-amber)";
    return "var(--color-rose)";
  }, [value]);

  async function handleFile(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await scanProtocolFile(file);
      onFileSelected?.(file);
      onChange(result);
      onExtracted?.(result.extracted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The document could not be scanned.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleText() {
    if (!text.trim()) {
      setError("Paste the protocol text first.");
      return;
    }
    setError(null);
    const result = scanProtocolText(text, "Pasted protocol text");
    onChange(result);
    onExtracted?.(result.extracted);
    setTextMode(false);
  }

  return (
    <div className="rounded-2xl border border-line bg-ink-2/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ScanLine className="size-4 text-sky" /> Complete proposal scanner
          </p>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">
            Upload the full Research Protocol document. The scanner checks the same 28 required
            sections as the production system and extracts the title, institution, email, phone,
            study period and sample size. The file is parsed in this browser and kept with the submission for review.
          </p>
        </div>
        {value ? (
          <Btn className="px-3" onClick={() => onChange(null)}>
            <X className="size-4" /> Remove scan
          </Btn>
        ) : (
          <Btn kind="primary" className="px-3" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {busy ? "Scanning" : "Upload .docx"}
          </Btn>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".docx,.txt,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        className="sr-only"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />

      {!value ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void handleFile(event.dataTransfer.files?.[0]);
          }}
          className="mt-4 flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-line-2 px-4 py-7 text-center transition hover:border-sky/50 hover:bg-sky/5"
        >
          <FileText className="size-7 text-muted" />
          <span className="text-sm font-semibold">Drop the complete protocol here</span>
          <span className="text-xs text-muted">
            Microsoft Word (.docx) or plain text — PDF and legacy .doc are not scanned
          </span>
        </button>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-ink px-4 py-3">
            <div
              className="grid size-20 shrink-0 place-items-center rounded-full"
              style={{
                background: `conic-gradient(${scoreColor} ${value.completeness * 3.6}deg, var(--color-panel-2) 0deg)`,
              }}
            >
              <div className="grid size-16 place-items-center rounded-full bg-ink">
                <span className="text-lg font-bold tabular-nums">{value.completeness}%</span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{value.fileName}</p>
              <p className="mt-0.5 text-xs text-muted">
                {value.present} of {value.total} required sections found · scanned{" "}
                {new Date(value.scannedAt).toLocaleString()}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {value.completeness === 100 ? (
                  <Chip tone="em">Complete</Chip>
                ) : (
                  <Chip tone={value.completeness >= 65 ? "amber" : "rose"}>
                    {value.missing.length} missing
                  </Chip>
                )}
                <Chip tone="sky">{SECTION_TOTAL}-section audit</Chip>
              </div>
            </div>
            <Btn className="px-3" onClick={() => inputRef.current?.click()}>
              Replace
            </Btn>
          </div>

          {value.missing.length > 0 ? (
            <div className="rounded-xl border border-amber/30 bg-amber/10 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber">
                <AlertTriangle className="size-4" /> Missing sections
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {value.missing.map((section) => (
                  <span key={section} className="rounded-full border border-amber/30 bg-ink-2 px-2 py-0.5 text-xs text-amber">
                    {section}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                You may still submit so the secretariat can review the package, but missing sections
                usually trigger a correction request.
              </p>
            </div>
          ) : null}

          {Object.values(value.extracted).some(Boolean) ? (
            <div className="rounded-xl border border-line p-3">
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">Extracted fields</p>
              <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                {value.extracted.title ? <Extracted k="Title" v={value.extracted.title} /> : null}
                {value.extracted.institution ? <Extracted k="Institution" v={value.extracted.institution} /> : null}
                {value.extracted.email ? <Extracted k="Email" v={value.extracted.email} /> : null}
                {value.extracted.phoneNumber ? <Extracted k="Phone" v={value.extracted.phoneNumber} /> : null}
                {value.extracted.studyPeriod ? <Extracted k="Study period" v={value.extracted.studyPeriod} /> : null}
                {value.extracted.sampleSize ? <Extracted k="Sample size" v={value.extracted.sampleSize} /> : null}
              </dl>
            </div>
          ) : null}

          <details className="rounded-xl border border-line p-3">
            <summary className="cursor-pointer text-xs font-semibold tracking-wide text-muted uppercase">
              28-section checklist
            </summary>
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {value.checklist.map((item) => (
                <li key={item.section} className="flex items-center gap-2 text-xs">
                  {item.present ? (
                    <CheckCircle2 className="size-3.5 shrink-0 text-em" />
                  ) : (
                    <X className="size-3.5 shrink-0 text-rose" />
                  )}
                  <span className={item.present ? "text-muted" : "text-rose"}>{item.section}</span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}

      {!value ? (
        <div className="mt-3">
          {!textMode ? (
            <button type="button" onClick={() => setTextMode(true)} className="text-xs font-semibold text-sky">
              Or paste the protocol text instead
            </button>
          ) : (
            <div className="mt-2">
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Paste the complete protocol text here…"
                className="min-h-32 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-sky"
              />
              <div className="mt-2 flex gap-2">
                <Btn kind="primary" className="px-3" onClick={handleText}>
                  <Check className="size-4" /> Scan text
                </Btn>
                <Btn className="px-3" onClick={() => { setTextMode(false); setText(""); }}>
                  Cancel
                </Btn>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-xl border border-rose/30 bg-rose/10 px-3 py-2 text-xs text-rose">{error}</p>
      ) : null}
    </div>
  );
}

function Extracted({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="truncate font-medium">{v}</dd>
    </div>
  );
}

import { useMemo } from "react";
import { Search } from "lucide-react";
import { useIrerc } from "@/lib/irerc/store";
import type { Protocol } from "@/lib/irerc/model";
import { assessTitleSimilarity, type SimilarityBand } from "@/lib/irerc/title-similarity";
import { Card, Chip } from "@/components/irerc/ui";

const BAND_TONE: Record<SimilarityBand, "rose" | "amber" | "sky" | "muted"> = {
  "Very high": "rose",
  High: "amber",
  Moderate: "sky",
  Low: "muted",
  "No comparison": "muted",
};

export function TitleSimilarityCard({ protocol }: { protocol: Protocol }) {
  const role = useIrerc((s) => s.role);
  const protocols = useIrerc((s) => s.protocols);
  const openProtocol = useIrerc((s) => s.openProtocol);
  const permitted = role === "secretariat" || role === "chair" || role === "admin";
  const assessment = useMemo(
    () =>
      assessTitleSimilarity(
        protocol.title,
        protocols.filter((item) => item.id !== protocol.id).map((item) => ({ id: item.id, title: item.title })),
      ),
    [protocol.id, protocol.title, protocols],
  );

  if (!permitted) return null;

  const percent = Math.round(assessment.score * 100);
  const hasMatches = assessment.matches.length > 0 && assessment.corpusSize > 0;

  return (
    <Card className="border-sky/30 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Search className="size-4 text-sky" /> Title similarity screening
          </h2>
          <p className="mt-1 text-sm text-muted">
            Automatic comparison with {assessment.corpusSize} existing research title
            {assessment.corpusSize === 1 ? "" : "s"}.
          </p>
        </div>
        <Chip tone={BAND_TONE[assessment.band]}>{assessment.band}</Chip>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center">
        <div className="rounded-2xl border border-line bg-panel-2/50 p-3 text-center">
          <p className="text-3xl font-extrabold tabular-nums">{percent}%</p>
          <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">Overall match</p>
        </div>
        <div>
          <div className="h-3 overflow-hidden rounded-full bg-panel-2">
            <div
              className={`h-full rounded-full ${assessment.band === "Very high" ? "bg-rose" : assessment.band === "High" ? "bg-amber" : "bg-sky"}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Composite of TF-IDF token cosine (55%), token-set Jaccard overlap (25%) and normalized
            edit similarity (20%). Stop words and light stemming are applied. This is a screening
            aid, not a finding of duplicate or plagiarized research.
          </p>
        </div>
      </div>

      {hasMatches ? (
        <div className="mt-4">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Closest existing titles</p>
          <ul className="mt-2 space-y-2">
            {assessment.matches.map((match) => (
              <li key={match.protocolId}>
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-line bg-panel p-3 text-left transition hover:border-sky/50 hover:bg-sky/5"
                  onClick={() => openProtocol(match.protocolId)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{match.title}</span>
                    <span className="mt-0.5 block text-[11px] text-muted">{match.protocolId}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-bold tabular-nums">{Math.round(match.score * 100)}%</span>
                    <span className="block text-[10px] text-muted">
                      cosine {Math.round(match.cosine * 100)} · Jaccard {Math.round(match.jaccard * 100)} · edit {Math.round(match.edit * 100)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-line bg-panel-2/40 p-3 text-sm text-muted">
          No comparable existing titles were found. The assessment will grow as more protocols enter the file.
        </p>
      )}

      <p className="mt-3 text-[11px] text-muted">
        Assessed {new Date(assessment.assessedAt).toLocaleString()} · Visible to Secretariat, Chairperson and System Administrator.
      </p>
    </Card>
  );
}

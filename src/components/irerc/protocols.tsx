import {
  PIPE,
  STATUS_LABEL,
  STATUS_TONE,
  type Protocol,
  type Status,
  visibleTo,
} from "@/lib/irerc/model";
import { useIrerc } from "@/lib/irerc/store";
import { workItems } from "@/components/irerc/dashboard";
import { Btn, Card, Chip, Empty, PageHead } from "@/components/irerc/ui";
import { assessTitleSimilarity, type TitleSimilarity } from "@/lib/irerc/title-similarity";

function matches(p: Protocol, q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [p.id, p.title, p.pi, p.institution, p.type, p.focus, STATUS_LABEL[p.status]].join(" ").toLowerCase().includes(s);
}

export function ProtocolList({ preset }: { preset?: Status[] }) {
  const role = useIrerc((s) => s.role)!;
  const query = useIrerc((s) => s.query);
  const filter = useIrerc((s) => s.filter);
  const setFilter = useIrerc((s) => s.setFilter);
  const protocols = useIrerc((s) => s.protocols);
  const openProtocol = useIrerc((s) => s.openProtocol);
  const openModal = useIrerc((s) => s.openModal);
  const acting = useIrerc((s) => s.actingReviewer);
  const list = protocols.filter((p) => visibleTo(role, p) && matches(p, query));
  const scoped = preset ? list.filter((p) => preset.includes(p.status)) : list;
  const stage = PIPE.find((s) => s.key === filter);
  const shown = !preset && filter !== "all" ? scoped.filter((p) => stage?.match.includes(p.status)) : scoped;
  const waiting = new Set(workItems(role, acting, protocols).map((w) => w.id));
  const canSeeSimilarity = role === "secretariat" || role === "chair" || role === "admin";
  const similarityFor = (protocol: Protocol): TitleSimilarity | null =>
    canSeeSimilarity
      ? assessTitleSimilarity(
          protocol.title,
          protocols.filter((item) => item.id !== protocol.id).map((item) => ({ id: item.id, title: item.title })),
        )
      : null;

  return (
    <div className="rise">
      <PageHead
        title={preset ? "Screening desk" : role === "investigator" ? "My protocols" : "Protocols"}
        lede={preset ? "Verify the submission checklist before a protocol is numbered into review." : "Open a file to see documents, reviewers, the decision, and the audit trail."}
        action={role === "investigator" ? <Btn kind="primary" onClick={() => openModal({ type: "submit" })}>New submission</Btn> : null}
      />
      {!preset ? (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label={`All ${list.length}`} />
          {PIPE.map((stage) => {
            const n = list.filter((p) => stage.match.includes(p.status)).length;
            const on = filter === stage.key;
            return <FilterChip key={stage.key} active={on} onClick={() => setFilter(stage.key)} label={`${stage.label} ${n}`} />;
          })}
        </div>
      ) : null}
      <div className="grid gap-3 md:hidden">
        {shown.map((p) => (
          <button key={p.id} className="rounded-2xl border border-line bg-panel p-4 text-left" onClick={() => openProtocol(p.id)}>
            <RowBody p={p} hot={waiting.has(p.id)} similarity={similarityFor(p)} />
          </button>
        ))}
        {shown.length === 0 ? <Card><Empty title="Nothing in this view" text="Try another filter or submit a protocol." /></Card> : null}
      </div>
      <Card className="hidden overflow-hidden md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-xs tracking-wide text-muted uppercase">
              <th className="px-4 py-3 font-semibold">Protocol</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id} className="cursor-pointer border-b border-line/70 hover:bg-sky/5" onClick={() => openProtocol(p.id)}>
                <td className="px-4 py-3"><RowBody p={p} hot={waiting.has(p.id)} similarity={similarityFor(p)} /></td>
                <td className="px-4 py-3 text-sm text-muted">{p.type}</td>
                <td className="px-4 py-3"><Chip tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Chip></td>
                <td className="px-4 py-3 text-sm tabular-nums text-muted">{p.submitted}</td>
              </tr>
            ))}
            {shown.length === 0 ? (
              <tr><td colSpan={4}><Empty title="Nothing in this view" text="Try another filter or submit a protocol." /></td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function RowBody({ p, hot, similarity }: { p: Protocol; hot: boolean; similarity: TitleSimilarity | null }) {
  return (
    <div>
      <p className="font-mono text-xs text-sky">{p.id}</p>
      <p className="mt-1 font-semibold leading-snug">{p.title}</p>
      <p className="mt-1 text-xs text-muted">{p.pi} · {p.institution}</p>
      {similarity && similarity.corpusSize > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Chip tone={similarity.band === "Very high" ? "rose" : similarity.band === "High" ? "amber" : "sky"}>
            Title similarity {Math.round(similarity.score * 100)}%
          </Chip>
          <span className="text-[11px] text-muted">{similarity.band}</span>
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2 md:hidden">
        <Chip tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Chip>
        <span className="text-xs text-muted">{p.submitted}</span>
      </div>
      {hot ? <p className="mt-2 text-xs font-semibold text-amber">Waiting on you</p> : null}
    </div>
  );
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`min-h-11 shrink-0 rounded-full px-3 text-xs font-semibold ${active ? "bg-sky text-on-accent" : "border border-line bg-panel text-muted"}`}
    >
      {label}
    </button>
  );
}

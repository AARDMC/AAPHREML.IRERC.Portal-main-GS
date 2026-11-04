import { useEffect, useState, type ReactNode } from "react";
import {
  MEMBER_CATEGORIES,
  MEMBER_SEATS,
  ROLES,
  STATUS_LABEL,
  STATUS_TONE,
  TODAY,
  addDays,
  isOverdue,
  isReviewerSeat,
  myReviewPending,
  reviewDue,
  visibleTo,
  type Member,
  type MemberInput,
  type RoleKey,
} from "@/lib/irerc/model";
import { useIrerc } from "@/lib/irerc/store";
import { Btn, Card, Chip, Empty, Field, PageHead, fieldClass } from "@/components/irerc/ui";
import { REMOTE } from "@/lib/irerc/remote-flag";
import { gasUsers, gasSetUserRole } from "@/lib/gas/api";

type ManagedUser = {
  userId: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: RoleKey;
  active: boolean;
};

export function ReviewsDesk() {
  const acting = useIrerc((s) => s.actingReviewer);
  const setActing = useIrerc((s) => s.setActing);
  const members = useIrerc((s) => s.members);
  const protocols = useIrerc((s) => s.protocols);
  const openProtocol = useIrerc((s) => s.openProtocol);
  const openModal = useIrerc((s) => s.openModal);
  const reviewers = members
    .filter((m) => m.active && isReviewerSeat(m.seat))
    .map((m) => m.name);
  const firstReviewer = reviewers[0] ?? "";
  const hasActing = reviewers.includes(acting);
  const current = hasActing ? acting : firstReviewer;

  useEffect(() => {
    if (!hasActing && firstReviewer) setActing(firstReviewer);
  }, [hasActing, firstReviewer, setActing]);

  const mine = current ? protocols.filter((p) => p.reviewers.includes(current)) : [];
  const pending = mine.filter((p) => myReviewPending(p, current));
  const done = mine.filter((p) => p.reviews.some((r) => r.reviewer === current));

  return (
    <div className="rise">
      <PageHead
        title="My reviews"
        lede="Twenty ethical criteria, a recommendation, and a conflict declaration. The reviewer does not issue the committee decision."
        action={
          reviewers.length ? (
            <label className="text-xs font-semibold tracking-wide text-muted uppercase">
              Acting reviewer
              <select className="mt-1 block min-h-11 rounded-xl border border-line bg-ink-2 px-3 text-sm font-semibold text-fg normal-case" value={current} onChange={(e) => setActing(e.target.value)}>
                {reviewers.map((n) => <option key={n}>{n}</option>)}
              </select>
            </label>
          ) : null
        }
      />
      {reviewers.length === 0 ? (
        <Empty
          title="No reviewers registered"
          text="The Secretariat must register committee members and reviewers in the Roster before review work can begin."
        />
      ) : null}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-semibold">Pending</h2>
          <Chip tone="amber">{pending.length}</Chip>
        </div>
        <DeskRows
          rows={pending.map((p) => ({
            id: p.id,
            title: p.title,
            sub: `${p.id} · due ${reviewDue(p) || "—"}`,
            extra: isOverdue(p, acting) ? <Chip tone="rose">Overdue</Chip> : <Chip tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Chip>,
            action: <Btn kind="primary" onClick={() => openModal({ type: "assess", id: p.id })}>Assess</Btn>,
          }))}
          empty="No assessment is waiting for this reviewer."
        />
      </Card>
      <Card className="mt-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-semibold">Completed</h2>
          <Chip tone="em">{done.length}</Chip>
        </div>
        <ul className="divide-y divide-line">
          {done.map((p) => {
            const r = p.reviews.find((x) => x.reviewer === acting)!;
            return (
              <li key={p.id}>
                <button className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-sky/5" onClick={() => openProtocol(p.id)}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{p.title}</span>
                    <span className="block text-xs text-muted">{p.id} · {r.date}</span>
                  </span>
                  <Chip tone={r.recommendation.includes("Not") ? "rose" : r.recommendation.includes("major") ? "amber" : "em"}>{r.recommendation}</Chip>
                </button>
              </li>
            );
          })}
          {done.length === 0 ? <Empty title="None yet" text="Completed assessments appear here." /> : null}
        </ul>
      </Card>
    </div>
  );
}

export function CommitteeDesk() {
  const role = useIrerc((s) => s.role)!;
  const protocols = useIrerc((s) => s.protocols);
  const openProtocol = useIrerc((s) => s.openProtocol);
  const openModal = useIrerc((s) => s.openModal);
  const agenda = protocols.filter((p) => p.status === "agenda" || p.status === "reviews_complete");
  const decided = protocols.filter((p) => p.status === "decided");

  return (
    <div className="rise">
      <PageHead title="Committee" lede="Meeting 10/2026 · Addis Ababa Health Bureau, Conference Room B · 30 October 2026 · 09:00." />
      <Card className="mb-4 border-sky/30 bg-sky/10 p-4 text-sm">
        Quorum is half the roster plus the people actually in the room, and it must include one lay member and one scientist. Conflicted members leave before the vote. The chair records the result; the secretariat writes the letter.
      </Card>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-semibold">Agenda</h2>
          <Chip tone="amber">{agenda.length}</Chip>
        </div>
        <DeskRows
          rows={agenda.map((p) => ({
            id: p.id,
            title: p.title,
            sub: `${p.id} · ${p.reviewers.join(", ") || "No reviewers"}`,
            extra: <Chip tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Chip>,
            action: role === "chair"
              ? <Btn kind="go" onClick={() => openModal({ type: "decide", id: p.id })}>Record decision</Btn>
              : <Btn onClick={() => openProtocol(p.id)}>Open</Btn>,
          }))}
          empty="The agenda is clear."
        />
      </Card>
      <Card className="mt-4 overflow-hidden">
        <div className="border-b border-line px-4 py-3"><h2 className="font-semibold">Decisions waiting for a letter</h2></div>
        <DeskRows
          rows={decided.map((p) => ({
            id: p.id,
            title: p.id,
            sub: p.decision || "",
            extra: null,
            action: role === "chair" ? <Btn onClick={() => openProtocol(p.id)}>View</Btn> : <Btn kind="go" onClick={() => openModal({ type: "letter", id: p.id })}>Send letter</Btn>,
          }))}
          empty="No decision is waiting to be communicated."
        />
      </Card>
    </div>
  );
}

export function SafetyDesk() {
  const role = useIrerc((s) => s.role)!;
  const protocols = useIrerc((s) => s.protocols);
  const safety = useIrerc((s) => s.safety);
  const openModal = useIrerc((s) => s.openModal);
  const visibleIds = new Set(protocols.filter((p) => visibleTo(role, p)).map((p) => p.id));
  const rows = safety.filter((s) => visibleIds.has(s.protocolId));
  const pending = rows.filter((s) => s.status === "Pending review").length;
  const canReview = role === "chair" || role === "secretariat" || role === "reviewer";
  const ownActive = protocols.filter((p) => p.pi === ROLES.investigator.name && ["active", "reviewing", "agenda", "decided"].includes(p.status));

  return (
    <div className="rise">
      <PageHead
        title="Safety reports"
        lede="Serious, unexpected, and related events come back to the committee. Filing a report does not itself stop a study."
        action={role === "investigator" && ownActive[0] ? <Btn kind="primary" onClick={() => openModal({ type: "sae", id: ownActive[0].id })}>Report an event</Btn> : null}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Mini label="Pending" n={pending} />
        <Mini label="In this view" n={rows.length} />
        <Mini label="Reviewed" n={rows.length - pending} />
      </div>
      <Card className="overflow-hidden">
        <ul className="divide-y divide-line">
          {rows.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs text-sky">{s.id}</p>
                <p className="font-semibold">{s.event}</p>
                <p className="text-xs text-muted">{s.date} · {s.protocolId} · {s.relatedness} · {s.seriousness}</p>
                {s.note ? <p className="mt-1 text-sm text-muted">{s.note}</p> : null}
              </div>
              <Chip tone={s.status.startsWith("Pending") ? "amber" : "em"}>{s.status}</Chip>
              {canReview && s.status === "Pending review" ? <Btn kind="primary" onClick={() => openModal({ type: "safety", id: s.id })}>Review</Btn> : null}
            </li>
          ))}
          {rows.length === 0 ? <Empty title="No reports" text="Safety reports linked to your protocols appear here." /> : null}
        </ul>
      </Card>
    </div>
  );
}

export function MonitorDesk() {
  const role = useIrerc((s) => s.role)!;
  const protocols = useIrerc((s) => s.protocols);
  const openProtocol = useIrerc((s) => s.openProtocol);
  const list = protocols.filter((p) => visibleTo(role, p) && (p.status === "active" || p.amendment || p.continuingDue));
  return (
    <div className="rise">
      <PageHead title="After clearance" lede="Amendments, continuing review, and close-out. An approved study is not a finished file." />
      <div className="grid gap-3">
        {list.map((p) => (
          <Card key={p.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-sky">{p.id}</p>
                <h2 className="mt-1 text-lg font-semibold">{p.title}</h2>
                <p className="text-sm text-muted">{p.pi}</p>
              </div>
              <Btn onClick={() => openProtocol(p.id)}>Open file</Btn>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Chip>
              {p.continuingDue ? <Chip tone={p.continuingDue <= addDays(TODAY, 45) ? "amber" : "muted"}>Continuing review {p.continuingDue}</Chip> : null}
              {p.amendment ? <Chip tone={p.amendment.status === "Approved" ? "em" : p.amendment.status === "Pending review" ? "amber" : "rose"}>{p.amendment.status}</Chip> : null}
            </div>
          </Card>
        ))}
        {list.length === 0 ? <Card><Empty title="No active clearances" text="Approved studies that are still running show up here." /></Card> : null}
      </div>
    </div>
  );
}

export function ArchiveDesk() {
  const protocols = useIrerc((s) => s.protocols);
  const openProtocol = useIrerc((s) => s.openProtocol);
  const closed = protocols.filter((p) => p.status === "archived");
  return (
    <div className="rise">
      <PageHead title="Archive" lede="Active files move here after close-out. Retrieval stays with the secretariat." />
      <Card className="mb-4 border-amber/30 bg-amber/10 p-4 text-sm text-amber">
        Retention is not settled in the source package: indefinite storage and a minimum period after completion both appear. One schedule has to be formally approved before this workspace is used for real records.
      </Card>
      <Card className="overflow-hidden">
        <ul className="divide-y divide-line">
          {closed.map((p) => (
            <li key={p.id}>
              <button className="w-full px-4 py-3 text-left hover:bg-sky/5" onClick={() => openProtocol(p.id)}>
                <span className="font-mono text-xs text-sky">{p.id}</span>
                <span className="mt-1 block font-semibold">{p.title}</span>
                <span className="mt-1 block text-xs text-muted">{p.decision} · last event {p.history[p.history.length - 1]?.date}</span>
              </button>
            </li>
          ))}
          {closed.length === 0 ? <Empty title="Archive is empty" text="Closed studies will be listed here." /> : null}
        </ul>
      </Card>
    </div>
  );
}

export function SystemDesk() {
  const protocols = useIrerc((s) => s.protocols);
  const events = protocols.flatMap((p) => p.history.map((x) => ({ ...x, pid: p.id }))).sort((a, b) => b.date.localeCompare(a.date) || b.action.localeCompare(a.action));
  const matrix: [string, string, string, string, string][] = [
    ["Submit protocol", "Yes", "—", "—", "—"],
    ["Screen completeness", "—", "Yes", "—", "—"],
    ["Classify review type", "—", "Yes", "—", "Yes"],
    ["Assign reviewers", "—", "Yes", "—", "Yes"],
    ["Submit assessment", "—", "—", "Yes", "—"],
    ["Record decision", "—", "—", "—", "Yes"],
    ["Send action letter", "—", "Yes", "—", "—"],
    ["Archive", "—", "Yes", "—", "—"],
  ];
  return (
    <div className="rise">
      <PageHead title="System and audit" lede="The digital system records and enforces access. It has no authority to approve, defer, or reject a protocol." />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <h2 className="border-b border-line px-4 py-3 font-semibold">Who may do what</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs tracking-wide text-muted uppercase">
                  {["Function", "PI", "Secretariat", "Reviewer", "Chair"].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => (
                  <tr key={row[0]} className="border-t border-line">
                    {row.map((cell, i) => (
                      <td key={i} className={`px-3 py-2 ${cell === "Yes" ? "font-semibold text-em" : i ? "text-muted" : ""}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="p-4">
          <h2 className="font-semibold">Document control</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-muted uppercase">Numbering</dt><dd className="font-mono">AAPHREML-IRERC-YYYY-NNNN</dd></div>
            <div><dt className="text-xs text-muted uppercase">Review clock</dt><dd>7 working days</dd></div>
            <div><dt className="text-xs text-muted uppercase">Assessment</dt><dd>20 criteria</dd></div>
            <div><dt className="text-xs text-muted uppercase">Quorum floor</dt><dd>4 votes in this demo</dd></div>
          </dl>
          <p className="mt-4 text-sm text-muted">
            Committee date in this workspace is {TODAY}. Records are fictitious and stay in this browser. They are not written to the institutional spreadsheet or Drive folder.
          </p>
        </Card>
      </div>
      {REMOTE ? <AccessPanel /> : null}
      <Card className="mt-4 overflow-hidden">
        <h2 className="border-b border-line px-4 py-3 font-semibold">Audit trail</h2>
        <ul className="max-h-[28rem] divide-y divide-line overflow-y-auto">
          {events.map((e, i) => (
            <li key={`${e.pid}-${i}`} className="grid gap-1 px-4 py-3 text-sm md:grid-cols-[7rem_1fr]">
              <span className="text-xs text-muted tabular-nums">{e.date}</span>
              <span><span className="font-mono text-xs text-sky">{e.pid}</span> · {e.actor} — {e.action}{e.note ? <span className="text-muted"> — {e.note}</span> : null}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export function RosterDesk() {
  const role = useIrerc((s) => s.role);
  const members = useIrerc((s) => s.members);
  const addMember = useIrerc((s) => s.addMember);
  const updateMember = useIrerc((s) => s.updateMember);
  const removeMember = useIrerc((s) => s.removeMember);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<MemberInput>(() => emptyMember());
  const [error, setError] = useState<string | null>(null);

  if (role === "investigator") {
    return (
      <Empty
        title="Restricted"
        text="The committee roster and internal role assignments are available only to authorised IRERC users."
      />
    );
  }

  const canEdit = role === "secretariat";

  const set = <K extends keyof MemberInput>(key: K, value: MemberInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  function startNew() {
    setForm(emptyMember());
    setError(null);
    setEditing("new");
  }

  function startEdit(member: Member) {
    setForm({
      name: member.name,
      category: member.category,
      seat: member.seat,
      institution: member.institution,
      email: member.email,
      phone: member.phone,
      active: member.active,
    });
    setError(null);
    setEditing(member.id);
  }

  function save() {
    if (!form.name.trim() || !form.institution.trim()) {
      setError("Member name and institution are required.");
      return;
    }
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      setError("Enter a valid email address, or leave it blank.");
      return;
    }
    const duplicate = members.some(
      (m) => m.id !== editing && m.name.toLowerCase() === form.name.trim().toLowerCase(),
    );
    if (duplicate) {
      setError("A member or reviewer with that name already exists.");
      return;
    }
    if (editing === "new") addMember(form);
    else if (editing) updateMember(editing, form);
    setEditing(null);
    setError(null);
  }

  function toggleActive(member: Member) {
    updateMember(member.id, {
      name: member.name,
      category: member.category,
      seat: member.seat,
      institution: member.institution,
      email: member.email,
      phone: member.phone,
      active: !member.active,
    });
  }

  function remove(member: Member) {
    if (!window.confirm(`Remove ${member.name} from the roster? Assigned reviewers cannot be removed; mark them inactive instead.`)) return;
    removeMember(member.id);
  }

  const duties: [string, string][] = [
    ["Investigator", "Submits a complete package, conducts the study as approved, requests amendments before changing the protocol, and reports safety, deviations, progress, and close-out on time."],
    ["Secretariat", "Receives, screens, numbers, assigns, builds the agenda, issues action letters, and keeps the archive. The Secretariat registers and maintains the member and reviewer roster."],
    ["Reviewer", "Reviews only assigned protocols, completes the assessment, declares conflicts, and presents at the meeting."],
    ["Chairperson", "Maintains quorum, calls the vote, signs the decision, and may approve items the committee's procedures allow by expedited or exemption review."],
    ["System", "Access control, version history, and the audit trail. Support only — never a voter."],
  ];

  return (
    <div className="rise">
      <PageHead
        title="Roster"
        lede="Duties follow the committee's procedures. The Secretariat registers members and reviewers; the seat, not the software, carries the authority."
      />

      <div className="grid gap-3 md:grid-cols-2">
        {duties.map(([title, text]) => (
          <Card key={title} className="p-4">
            <h2 className="text-lg font-semibold text-sky">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
          </Card>
        ))}
      </div>

      {editing ? (
        <Card className="mt-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{editing === "new" ? "Register member or reviewer" : "Edit member or reviewer"}</h2>
            <Btn onClick={() => { setEditing(null); setError(null); }}>Cancel</Btn>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Full name *">
              <input className={fieldClass} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Dr. Abebe Kebede" />
            </Field>
            <Field label="Seat *">
              <select className={fieldClass} value={form.seat} onChange={(e) => set("seat", e.target.value as MemberInput["seat"])}>
                {MEMBER_SEATS.map((seat) => <option key={seat}>{seat}</option>)}
              </select>
            </Field>
            <Field label="Category / expertise *">
              <select className={fieldClass} value={form.category} onChange={(e) => set("category", e.target.value)}>
                {MEMBER_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
              </select>
            </Field>
            <Field label="Institution *">
              <input className={fieldClass} value={form.institution} onChange={(e) => set("institution", e.target.value)} placeholder="e.g. Addis Ababa University" />
            </Field>
            <Field label="Email">
              <input className={fieldClass} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="name@institution.org" />
            </Field>
            <Field label="Telephone">
              <input className={fieldClass} type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+251 91 xxx xxxx" />
            </Field>
          </div>
          <label className="mt-3 flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} />
            Active — may be assigned to new reviews
          </label>
          {error ? <p className="mt-3 rounded-xl border border-rose/30 bg-rose/10 px-3 py-2 text-xs text-rose">{error}</p> : null}
          <div className="mt-3 flex gap-2">
            <Btn kind="go" onClick={save}>Save member</Btn>
            <Btn onClick={() => { setEditing(null); setError(null); }}>Cancel</Btn>
          </div>
        </Card>
      ) : null}

      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <h2 className="font-semibold">Registered members and reviewers</h2>
            <p className="text-xs text-muted">
              {members.length} registered · {members.filter((m) => m.active && isReviewerSeat(m.seat)).length} active reviewers
            </p>
          </div>
          {canEdit ? <Btn kind="primary" onClick={startNew}>Register member</Btn> : null}
        </div>
        {members.length === 0 ? (
          <div className="p-4">
            <Empty
              title="No members registered"
              text={canEdit ? "Use Register member to add the first committee member or reviewer." : "The Secretariat has not registered any committee members or reviewers yet."}
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="grid size-10 place-items-center rounded-full bg-panel-2 text-xs font-bold">{initials(m.name)}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {m.name}
                    {!m.active ? <span className="ml-2 rounded-full border border-amber/30 bg-amber/10 px-2 py-0.5 text-[10px] font-semibold text-amber">Inactive</span> : null}
                  </p>
                  <p className="text-xs text-muted">{m.institution}{m.email ? ` · ${m.email}` : ""}{m.phone ? ` · ${m.phone}` : ""}</p>
                </div>
                <Chip tone={m.lay ? "amber" : "sky"}>{m.category}</Chip>
                <Chip tone={isReviewerSeat(m.seat) ? "em" : "sky"}>{m.seat}</Chip>
                {canEdit ? (
                  <div className="flex flex-wrap gap-2">
                    <Btn className="px-3" onClick={() => startEdit(m)}>Edit</Btn>
                    <Btn className="px-3" onClick={() => toggleActive(m)}>{m.active ? "Deactivate" : "Activate"}</Btn>
                    <Btn className="px-3" kind="danger" onClick={() => remove(m)}>Delete</Btn>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {!canEdit ? (
        <p className="mt-3 text-xs text-muted">
          Only the Secretariat can register or edit members and reviewers. You are viewing the roster in read-only mode.
        </p>
      ) : null}
    </div>
  );
}

function emptyMember(): MemberInput {
  return {
    name: "",
    category: MEMBER_CATEGORIES[0],
    seat: "Member",
    institution: "",
    email: "",
    phone: "",
    active: true,
  };
}

function initials(name: string) {
  const parts = name.replace(/^(Dr\.|Prof\.|Ato|W\/ro)\s+/i, "").split(" ");
  return (parts[0]?.[0] || "") + (parts[1]?.[0] || "");
}

function Mini({ label, n }: { label: string; n: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{n}</p>
    </Card>
  );
}

function DeskRows({
  rows,
  empty,
}: {
  rows: { id: string; title: string; sub: string; extra: ReactNode; action: ReactNode }[];
  empty: string;
}) {
  if (!rows.length) return <Empty title="Clear" text={empty} />;
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{r.title}</p>
            <p className="text-xs text-muted">{r.sub}</p>
          </div>
          {r.extra}
          {r.action}
        </li>
      ))}
    </ul>
  );
}

const ASSIGNABLE: RoleKey[] = ["investigator", "secretariat", "reviewer", "chair", "admin"];

/** Admin-only: assign roles to people who have signed up and verified their e-mail. */
function AccessPanel() {
  const myRole = useIrerc((s) => s.role);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const res = await gasUsers();
      setUsers(res.users as ManagedUser[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load users.");
    }
  }
  useEffect(() => {
    if (myRole === "admin") void load();
  }, [myRole]);
  if (myRole !== "admin") return null;

  async function change(u: ManagedUser, role: RoleKey, active: boolean) {
    setBusy(u.userId);
    setError(null);
    try {
      await gasSetUserRole(u.userId, role, active);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The change was not saved.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="mt-4 overflow-hidden">
      <h2 className="border-b border-line px-4 py-3 font-semibold">Access control</h2>
      {error ? <p role="alert" className="px-4 py-2 text-sm text-rose">{error}</p> : null}
      <ul className="divide-y divide-line">
        {users.map((u) => (
          <li key={u.userId} className="grid items-center gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_12rem_8rem]">
            <span>
              <span className="font-semibold">{u.name}</span>{" "}
              <span className="text-muted">{u.email}</span>{" "}
              {u.emailVerified ? null : <Chip tone="amber">E-mail not verified</Chip>}
            </span>
            <select
              className={fieldClass}
              value={u.role}
              disabled={busy === u.userId}
              onChange={(e) => void change(u, e.target.value as RoleKey, u.active)}
              aria-label={`Role for ${u.name}`}
            >
              {ASSIGNABLE.map((r) => <option key={r} value={r}>{ROLES[r].name}</option>)}
            </select>
            <Btn kind={u.active ? "danger" : "go"} disabled={busy === u.userId} onClick={() => void change(u, u.role, !u.active)}>
              {u.active ? "Deactivate" : "Activate"}
            </Btn>
          </li>
        ))}
      </ul>
    </Card>
  );
}

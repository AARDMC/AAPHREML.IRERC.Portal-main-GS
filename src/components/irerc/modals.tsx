import { useMemo, useState } from "react";
import {
  CATEGORY_EXPERTISE,
  CRITERIA,
  DECISIONS,
  RECOMMENDATIONS,
  SECTIONS,
  addDays,
  TODAY,
  isReviewerSeat,
  type ReviewType,
} from "@/lib/irerc/model";
import { Printer } from "lucide-react";
import { useIrerc } from "@/lib/irerc/store";
import { Btn, Field, Modal, fieldClass } from "@/components/irerc/ui";
import { ClearanceLetter } from "@/components/irerc/clearance-letter";
import { SubmitModal } from "@/components/irerc/submit-modal";
import { DocumentReviewModal } from "@/components/irerc/document-review";

export function ModalHost() {
  const modal = useIrerc((s) => s.modal);
  const close = useIrerc((s) => s.closeModal);
  if (!modal) return null;
  if (modal.type === "submit") return <SubmitModal onClose={close} />;
  if (modal.type === "assign") return <AssignModal id={modal.id} onClose={close} />;
  if (modal.type === "assess") return <AssessModal id={modal.id} onClose={close} />;
  if (modal.type === "decide") return <DecideModal id={modal.id} onClose={close} />;
  if (modal.type === "letter") return <LetterModal id={modal.id} onClose={close} />;
  if (modal.type === "certificate") return <CertificateModal id={modal.id} onClose={close} />;
  if (modal.type === "classify") return <ClassifyModal id={modal.id} onClose={close} />;
  if (modal.type === "safety") return <SafetyModal id={modal.id} onClose={close} />;
  if (modal.type === "sae") return <SaeModal id={modal.id} onClose={close} />;
  if (modal.type === "amend") return <AmendModal id={modal.id} onClose={close} />;
  if (modal.type === "continuing") return <ContinuingModal id={modal.id} onClose={close} />;
  if (modal.type === "revision") return <RequestRevisionModal id={modal.id} onClose={close} />;
  if (modal.type === "update") return <UpdateSubmissionModal id={modal.id} onClose={close} />;
  if (modal.type === "review") return <DocumentReviewModal id={modal.id} initialCode={modal.code} onClose={close} />;
  return null;
}

function UpdateSubmissionModal({ id, onClose }: { id: string; onClose: () => void }) {
  const protocol = useIrerc((s) => s.protocols.find((p) => p.id === id));
  if (!protocol) return null;
  return <SubmitModal onClose={onClose} editProtocol={protocol} />;
}

function RequestRevisionModal({ id, onClose }: { id: string; onClose: () => void }) {
  const protocol = useIrerc((s) => s.protocols.find((p) => p.id === id));
  const request = useIrerc((s) => s.requestRevision);
  const [comments, setComments] = useState(() =>
    protocol
      ? protocol.reviews
          .map((review) => `${review.recommendation}: ${review.comments}`.trim())
          .filter(Boolean)
          .join("\n\n")
      : "",
  );
  if (!protocol) return null;
  return (
    <Modal
      title="Request document revisions"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" onClick={() => request(id, comments)}>Open 48-hour revision window</Btn>
        </>
      }
    >
      <div className="rounded-xl border border-amber/30 bg-amber/10 p-3 text-sm">
        <p className="font-semibold text-amber">Assessment is complete</p>
        <p className="mt-1 text-muted">
          The PI will receive a notification with these instructions and a 48-hour window to upload revised
          documents. The reviewers will be asked to reassess after the PI submits.
        </p>
      </div>
      {protocol.reviews.length ? (
        <div className="mt-3 space-y-2">
          {protocol.reviews.map((review) => (
            <div key={`${review.reviewer}-${review.date}`} className="rounded-xl border border-line bg-panel-2/50 p-3 text-sm">
              <p className="font-semibold">{review.reviewer} · {review.recommendation}</p>
              {review.comments ? <p className="mt-1 text-muted">{review.comments}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
      <Field label="Required revisions and instructions to the PI *">
        <textarea
          className={`${fieldClass} min-h-40`}
          value={comments}
          onChange={(event) => setComments(event.target.value)}
          placeholder="List each document and the change required."
        />
      </Field>
    </Modal>
  );
}

function AssignModal({ id, onClose }: { id: string; onClose: () => void }) {
  const protocol = useIrerc((s) => s.protocols.find((p) => p.id === id));
  const members = useIrerc((s) => s.members);
  const assign = useIrerc((s) => s.assignReviewers);
  const suggested = protocol ? CATEGORY_EXPERTISE[protocol.category] : "";
  const pool = useMemo(
    () => members.filter((m) => m.active && isReviewerSeat(m.seat)),
    [members],
  );
  const initial = useMemo(() => {
    const match = pool.filter((m) => m.category === suggested).map((m) => m.name);
    const lay = pool.find((m) => m.lay)?.name;
    const picked = [...match];
    if (lay && !picked.includes(lay)) picked.push(lay);
    return picked.slice(0, 2);
  }, [pool, suggested]);
  const [picked, setPicked] = useState<string[]>(initial);
  if (!protocol) return null;
  return (
    <Modal
      title="Assign reviewers"
      onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" disabled={!picked.length} onClick={() => assign(id, picked)}>Assign</Btn></>}
    >
      <p className="text-sm text-muted">
        {protocol.reviewType === "Full Board Review"
          ? "Full board review uses two primary reviewers. Include a lay member when you can. The whole committee still receives the package."
          : "Expedited review can proceed with one qualified reviewer. The chair still records the decision."}
        {suggested ? ` Suggested expertise: ${suggested}.` : ""}
      </p>
      {pool.length === 0 ? (
        <p className="mt-3 rounded-xl border border-amber/30 bg-amber/10 p-3 text-sm text-amber">
          No reviewers are registered. The Secretary must register members and reviewers in
          Roster before reviewers can be assigned.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {pool.map((m) => (
            <li key={m.id}>
              <label className="flex min-h-11 items-center gap-3 rounded-xl border border-line px-3 text-sm">
                <input
                  type="checkbox"
                  checked={picked.includes(m.name)}
                  onChange={(e) => setPicked((cur) => e.target.checked ? [...cur, m.name] : cur.filter((n) => n !== m.name))}
                />
                <span>
                  <span className="font-semibold">{m.name}</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {m.category}{m.lay ? " · lay member" : ""}{m.category === suggested ? " · suggested" : ""}
                    {m.institution ? ` · ${m.institution}` : ""}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function AssessModal({ id, onClose }: { id: string; onClose: () => void }) {
  const protocol = useIrerc((s) => s.protocols.find((p) => p.id === id));
  const save = useIrerc((s) => s.saveAssessment);
  const [scores, setScores] = useState<Record<string, string>>(() => Object.fromEntries(CRITERIA.map((c) => [c.code, "Appropriate"])));
  const [recommendation, setRec] = useState<string>(RECOMMENDATIONS[1]);
  const [comments, setComments] = useState("");
  const [conflict, setConflict] = useState(false);
  if (!protocol) return null;
  const failed = CRITERIA.filter((c) => scores[c.code] === "Not appropriate").map((c) => c.code);
  return (
    <Modal
      title="Assessment form"
      onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" onClick={() => save(id, recommendation, comments, conflict, failed)}>Submit assessment</Btn></>}
    >
      <p className="text-sm font-semibold">{protocol.id}</p>
      <p className="text-sm text-muted">{protocol.title}</p>
      <div className="mt-3 max-h-96 space-y-4 overflow-y-auto pr-1">
        {SECTIONS.map((section) => (
          <div key={section}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">{section}</p>
              <button className="text-xs font-semibold text-sky" onClick={() => setScores((cur) => {
                const next = { ...cur };
                CRITERIA.filter((c) => c.section === section).forEach((c) => { next[c.code] = "Appropriate"; });
                return next;
              })}>Mark section appropriate</button>
            </div>
            {CRITERIA.filter((c) => c.section === section).map((c) => (
              <div key={c.code} className="mb-2 rounded-xl border border-line p-3">
                <p className="text-sm">{CRITERIA.findIndex((x) => x.code === c.code) + 1}. {c.question}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["Appropriate", "Not appropriate", "N/A"].map((opt) => (
                    <label key={opt} className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-xs font-semibold ${scores[c.code] === opt ? "border-sky bg-sky/15 text-sky" : "border-line text-muted"}`}>
                      <input type="radio" className="sr-only" name={c.code} checked={scores[c.code] === opt} onChange={() => setScores((cur) => ({ ...cur, [c.code]: opt }))} />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <Field label="Recommendation">
        <select className={fieldClass} value={recommendation} onChange={(e) => setRec(e.target.value)}>
          {RECOMMENDATIONS.map((r) => <option key={r}>{r}</option>)}
        </select>
      </Field>
      <Field label="Comments to the committee">
        <textarea className={fieldClass} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Required if any criterion is not appropriate" />
      </Field>
      <label className="mt-3 flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" checked={conflict} onChange={(e) => setConflict(e.target.checked)} />
        I have no unmanaged conflict of interest on this protocol.
      </label>
    </Modal>
  );
}

function DecideModal({ id, onClose }: { id: string; onClose: () => void }) {
  const protocol = useIrerc((s) => s.protocols.find((p) => p.id === id));
  const memberCount = useIrerc((s) => s.members.filter((m) => m.active).length);
  const save = useIrerc((s) => s.saveDecision);
  const [decision, setDecision] = useState<string>(DECISIONS[0]);
  const [note, setNote] = useState("");
  const [votes, setVotes] = useState({ for: 0, against: 0, abstain: 0 });
  if (!protocol) return null;
  const setVote = (k: "for" | "against" | "abstain", raw: string) => {
    const n = Math.max(0, Number(raw) || 0);
    setVotes((v) => ({ ...v, [k]: n }));
  };
  return (
    <Modal
      title="Committee decision"
      onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="go" onClick={() => save(id, decision, note, votes)}>Record decision</Btn></>}
    >
      <p className="text-sm font-semibold">{protocol.id}</p>
      <p className="text-sm text-muted">{protocol.title}</p>
      {protocol.reviews.length < protocol.reviewers.length ? (
        <p className="mt-3 rounded-xl border border-amber/40 bg-amber/10 p-3 text-sm text-amber">
          Not every assigned assessment is in. Expedited or exemption items may still be decided by the chair; full board items should wait for both reviews.
        </p>
      ) : null}
      <Field label="Decision">
        <select className={fieldClass} value={decision} onChange={(e) => setDecision(e.target.value)}>
          {DECISIONS.map((d) => <option key={d}>{d}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Votes for"><input className={fieldClass} inputMode="numeric" value={votes.for} onChange={(e) => setVote("for", e.target.value)} /></Field>
        <Field label="Against"><input className={fieldClass} inputMode="numeric" value={votes.against} onChange={(e) => setVote("against", e.target.value)} /></Field>
        <Field label="Abstentions"><input className={fieldClass} inputMode="numeric" value={votes.abstain} onChange={(e) => setVote("abstain", e.target.value)} /></Field>
      </div>
      <Field label="Conditions or reasons for the minutes">
        <textarea className={fieldClass} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <p className="mt-3 text-xs text-muted">
        Quorum is at least half of {memberCount} active registered members, with a lay member and a scientist present. Members with a conflict leave the room. The recorded votes must meet the committee's quorum.
      </p>
    </Modal>
  );
}

function LetterModal({ id, onClose }: { id: string; onClose: () => void }) {
  const protocol = useIrerc((s) => s.protocols.find((p) => p.id === id));
  const send = useIrerc((s) => s.sendLetter);
  const [date, setDate] = useState(addDays(TODAY, 365));
  const [message, setMessage] = useState("");
  if (!protocol) return null;
  const approved = protocol.decision?.startsWith("Approved") ?? false;
  const body = message || defaultLetter(protocol.decision || "the recorded outcome", protocol.pi, date);
  return (
    <Modal
      title={approved ? "Clearance letter" : "Action letter"}
      onClose={onClose}
      wide
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          {approved ? (
            <Btn onClick={() => window.print()}>
              <Printer className="size-4" /> Print letter
            </Btn>
          ) : null}
          <Btn kind="go" onClick={() => send(id, body, date)}>
            {approved ? "Issue clearance" : "Send action letter"}
          </Btn>
        </>
      }
    >
      <p className="no-print text-sm text-muted">
        {approved
          ? "The clearance letter is generated from the recorded committee decision. Printing uses the browser print dialog, where you can save it as a PDF."
          : "The secretariat prepares the letter. It lists the decision, any continuing-review date, and the appeal route. It does not change the committee's decision."}
      </p>
      <div className="no-print mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Decision">
          <input className={fieldClass} readOnly value={protocol.decision || ""} />
        </Field>
        <Field label="Continuing review due">
          <input className={fieldClass} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
      </div>
      {approved ? (
        <div className="mt-4 overflow-x-auto">
          <ClearanceLetter protocol={protocol} />
        </div>
      ) : (
        <Field label="Message">
          <textarea className={`${fieldClass} min-h-40`} value={body} onChange={(event) => setMessage(event.target.value)} />
        </Field>
      )}
    </Modal>
  );
}

function CertificateModal({ id, onClose }: { id: string; onClose: () => void }) {
  const protocol = useIrerc((s) => s.protocols.find((p) => p.id === id));
  if (!protocol) return null;
  return (
    <Modal
      title="Clearance letter"
      onClose={onClose}
      wide
      footer={
        <>
          <Btn onClick={onClose}>Close</Btn>
          <Btn kind="primary" onClick={() => window.print()}>
            <Printer className="size-4" /> Print / save as PDF
          </Btn>
        </>
      }
    >
      <div className="overflow-x-auto">
        <ClearanceLetter protocol={protocol} />
      </div>
    </Modal>
  );
}

function defaultLetter(decision: string, pi: string, date: string) {
  return `${pi},

AAPHREML-IRERC has completed review of your protocol. The decision is: ${decision}.

If clearance is granted, continuing review is due on ${date}. Do not implement an amendment before the committee approves it. Report serious and unanticipated events within the timelines required by the committee.

To appeal, write to the Chairperson with the reasons and any new information. This letter is an administrative communication of a committee decision.`;
}

function ClassifyModal({ id, onClose }: { id: string; onClose: () => void }) {
  const classify = useIrerc((s) => s.classify);
  const current = useIrerc((s) => s.protocols.find((p) => p.id === id)?.reviewType);
  const [value, setValue] = useState<ReviewType>(current || "Full Board Review");
  return (
    <Modal
      title="Review type"
      onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" onClick={() => classify(id, value)}>Save classification</Btn></>}
    >
      <div className="space-y-2">
        {([
          ["Full Board Review", "Convened meeting. Two primary reviewers. Quorum, including a lay member, throughout the vote."],
          ["Expedited Review", "Minimal risk, for example a non-significant-risk device. One reviewer may assess. The chair records the decision."],
          ["Exemption Review", "Fits an exemption category. The chair records the determination. It is still logged."],
        ] as const).map(([label, text]) => (
          <label key={label} className={`block rounded-xl border p-3 ${value === label ? "border-sky bg-sky/10" : "border-line"}`}>
            <span className="flex items-center gap-2 text-sm font-semibold">
              <input type="radio" checked={value === label} onChange={() => setValue(label)} />
              {label}
            </span>
            <span className="mt-1 block text-xs text-muted">{text}</span>
          </label>
        ))}
      </div>
    </Modal>
  );
}

function SafetyModal({ id, onClose }: { id: string; onClose: () => void }) {
  const report = useIrerc((s) => s.safety.find((r) => r.id === id));
  const save = useIrerc((s) => s.reviewSafety);
  const [action, setAction] = useState("No further action");
  const [note, setNote] = useState("");
  if (!report) return null;
  return (
    <Modal
      title={`Review ${report.id}`}
      onClose={onClose}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" onClick={() => save(id, action, note)}>Record action</Btn></>}
    >
      <p className="text-sm font-semibold">{report.event}</p>
      <p className="text-sm text-muted">{report.protocolId} · {report.date} · {report.relatedness} · {report.seriousness}</p>
      <Field label="Action">
        <select className={fieldClass} value={action} onChange={(e) => setAction(e.target.value)}>
          <option>No further action</option>
          <option>Request information</option>
          <option>Recommend further action</option>
        </select>
      </Field>
      <Field label="Note for the minutes"><textarea className={fieldClass} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    </Modal>
  );
}

function SaeModal({ id, onClose }: { id: string; onClose: () => void }) {
  const file = useIrerc((s) => s.fileSae);
  const [event, setEvent] = useState("");
  const [relatedness, setRel] = useState("Unknown");
  const [seriousness, setSer] = useState("Hospitalization");
  return (
    <Modal title="Safety report" onClose={onClose} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" onClick={() => file(id, event, relatedness, seriousness)}>File report</Btn></>}>
      <p className="text-sm text-muted">File within the committee's timeline. This does not suspend the study by itself.</p>
      <Field label="Event"><textarea className={fieldClass} value={event} onChange={(e) => setEvent(e.target.value)} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Relatedness">
          <select className={fieldClass} value={relatedness} onChange={(e) => setRel(e.target.value)}>
            {["Not related", "Possibly related", "Probably related", "Unknown"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Seriousness">
          <select className={fieldClass} value={seriousness} onChange={(e) => setSer(e.target.value)}>
            {["Non-serious", "Hospitalization", "Life-threatening", "Death", "Disability"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

function AmendModal({ id, onClose }: { id: string; onClose: () => void }) {
  const file = useIrerc((s) => s.fileAmendment);
  const [summary, setSummary] = useState("");
  return (
    <Modal title="Protocol amendment" onClose={onClose} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" onClick={() => file(id, summary)}>Submit amendment</Btn></>}>
      <p className="text-sm text-muted">Do not implement the change until the chair records approval.</p>
      <Field label="What is changing, and why"><textarea className={fieldClass} value={summary} onChange={(e) => setSummary(e.target.value)} /></Field>
    </Modal>
  );
}

function ContinuingModal({ id, onClose }: { id: string; onClose: () => void }) {
  const file = useIrerc((s) => s.fileContinuing);
  const [summary, setSummary] = useState("");
  return (
    <Modal title="Continuing review" onClose={onClose} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" onClick={() => file(id, summary)}>Submit report</Btn></>}>
      <p className="text-sm text-muted">Enrolment, safety, deviations, and whether the risk-benefit balance has changed.</p>
      <Field label="Progress since the last review"><textarea className={fieldClass} value={summary} onChange={(e) => setSummary(e.target.value)} /></Field>
    </Modal>
  );
}

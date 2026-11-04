import { useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import {
  PIPE,
  ROLES,
  STATUS_LABEL,
  STATUS_TONE,
  isOverdue,
  isSubmissionUpdateOpen,
  myReviewPending,
  requiredDocsOk,
  stageIndex,
  type Protocol,
  type RoleKey,
} from "@/lib/irerc/model";
import { useIrerc } from "@/lib/irerc/store";
import { DocumentActions } from "@/components/irerc/document-actions";
import { RevisionPanel } from "@/components/irerc/revision-panel";
import { FinalProtocolPanel } from "@/components/irerc/final-protocol-panel";
import { SubmissionUpdateCard } from "@/components/irerc/submission-update-card";
import { DocumentReviewCard } from "@/components/irerc/document-review-card";
import { TitleSimilarityCard } from "@/components/irerc/title-similarity-card";
import { Btn, Card, Chip, PageHead, fieldClass } from "@/components/irerc/ui";

export function ProtocolDetail() {
  const id = useIrerc((s) => s.selectedId);
  const protocol = useIrerc((s) => s.protocols.find((p) => p.id === id) ?? null);
  const go = useIrerc((s) => s.go);
  const returnView = useIrerc((s) => s.returnView);
  const openModal = useIrerc((s) => s.openModal);
  const role = useIrerc((s) => s.role);
  if (!protocol) {
    return (
      <div>
        <Btn onClick={() => go("protocols")}>Back</Btn>
        <p className="mt-6 text-muted">That protocol is not in the file.</p>
      </div>
    );
  }
  const idx = stageIndex(protocol.status);
  const pct = protocol.reviewers.length ? Math.round((protocol.reviews.length / protocol.reviewers.length) * 100) : 0;

  return (
    <div className="rise">
      <button className="mb-3 text-sm font-semibold text-sky" onClick={() => go(returnView === "detail" ? "protocols" : returnView)}>
        ← Back
      </button>
      <PageHead
        title={protocol.title}
        lede={`${protocol.id} · ${protocol.focus}`}
        action={<Chip tone={STATUS_TONE[protocol.status]}>{STATUS_LABEL[protocol.status]}</Chip>}
      />
      <div className="mb-5 grid grid-cols-4 gap-2 md:grid-cols-8">
        {PIPE.map((s, i) => (
          <div key={s.key}>
            <div className={`mb-1 h-1.5 rounded-full ${i < idx ? "bg-em" : i === idx ? "bg-sky" : "bg-panel-2"}`} />
            <p className={`truncate text-xs font-semibold tracking-wide uppercase ${i === idx ? "text-sky" : i < idx ? "text-em" : "text-muted"}`}>{s.label}</p>
          </div>
        ))}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <SubmissionUpdateCard protocol={protocol} />
          <TitleSimilarityCard protocol={protocol} />
          <Card className="p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Research Protocol Submission</h2>
                <p className="text-sm text-muted">Registration, protocol content, supporting documents and validation for this file.</p>
              </div>
              <Chip tone={STATUS_TONE[protocol.status]}>{STATUS_LABEL[protocol.status]}</Chip>
            </div>

            <section className="mt-4 border-t border-line pt-4">
              <h3 className="text-sm font-semibold tracking-wide text-muted uppercase">Registration and investigator</h3>
              <dl className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Meta k="Principal investigator" v={protocol.submission.piName} />
                <Meta k="PI email" v={protocol.submission.piEmail} />
                <Meta k="PI telephone" v={protocol.submission.piPhone} />
                <Meta k="College / institution" v={protocol.submission.college === "Other:" ? protocol.submission.collegeOther : protocol.submission.college} />
                <Meta k="Department" v={protocol.submission.department === "Other:" ? protocol.submission.departmentOther : protocol.submission.department} />
                <Meta k="Activity type" v={protocol.submission.activityType === "Other:" ? protocol.submission.activityTypeOther : protocol.submission.activityType} />
                <Meta k="Advisor" v={protocol.submission.advisorName} />
                <Meta k="Advisor email" v={protocol.submission.advisorEmail} />
                <Meta k="Advisor telephone" v={protocol.submission.advisorPhone} />
                <Meta k="Funding" v={protocol.submission.funding === "Other:" ? protocol.submission.fundingOther : protocol.submission.funding} />
                <Meta k="Budget (ETB)" v={protocol.submission.budget} />
                <Meta k="Review type" v={protocol.reviewType || "Not classified"} />
              </dl>
            </section>

            <section className="mt-4 border-t border-line pt-4">
              <h3 className="text-sm font-semibold tracking-wide text-muted uppercase">Research protocol content</h3>
              <dl className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Meta k="Study title" v={protocol.submission.studyTitle} />
                <Meta k="Health focus" v={protocol.submission.healthFocus === "Other:" ? protocol.submission.healthFocusOther : protocol.submission.healthFocus} />
                <Meta k="Study design" v={protocol.submission.studyDesign === "Other:" ? protocol.submission.studyDesignOther : protocol.submission.studyDesign} />
                <Meta k="Research approach" v={protocol.submission.methods} />
                <Meta k="Sample size" v={protocol.submission.sampleSize} />
                <Meta k="Study period" v={[protocol.submission.dataStart, protocol.submission.dataEnd].filter(Boolean).join(" → ") || "—"} />
                <Meta k="Frequency" v={protocol.submission.frequency} />
                <Meta k="Geographic coverage" v={protocol.submission.geoCoverage === "Other:" ? protocol.submission.geoCoverageOther : protocol.submission.geoCoverage} />
                <Meta k="Specific site" v={protocol.submission.specificSite} />
                <Meta k="Sex / gender" v={protocol.submission.gender} />
                <Meta k="Target population" v={protocol.submission.targetGroup === "Other:" ? protocol.submission.targetGroupOther : protocol.submission.targetGroup} />
                <Meta k="Data collection" v={protocol.submission.tools === "Other:" ? protocol.submission.toolsOther : protocol.submission.tools} />
                <Meta k="Electronic data" v={protocol.submission.electronic} />
                <Meta k="GPS data" v={protocol.submission.gps} />
                <Meta k="Accessibility" v={protocol.submission.accessibility} />
                <Meta k="Cleaned data formats" v={protocol.submission.dataFormat.join(", ")} />
                <Meta k="Clinical trial attributes" v={protocol.submission.clinicalTrial.join(", ") || "—"} />
              </dl>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <TextBlock k="General objective" v={protocol.submission.generalObjective} />
                <TextBlock k="Specific objectives" v={protocol.submission.specificObjectives} />
                {protocol.submission.restrictionReason ? <TextBlock k="Reason data is not accessible" v={protocol.submission.restrictionReason} /> : null}
                {protocol.submission.activityType === "Project" ? <TextBlock k="Project outcomes" v={protocol.submission.projectOutcomesTangible} /> : null}
                {protocol.submission.activityType === "Project" ? <TextBlock k="Project sustainability" v={protocol.submission.projectSustainability} /> : null}
              </div>
            </section>

            <section className="mt-4 border-t border-line pt-4">
              <h3 className="text-sm font-semibold tracking-wide text-muted uppercase">Supporting documents and validation</h3>
              <DocList protocol={protocol} />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {protocol.scan ? (
                  <Chip tone={protocol.scan.completeness >= 95 ? "em" : "rose"}>
                    Proposal {protocol.scan.completeness}% · {protocol.scan.fileName}
                  </Chip>
                ) : (
                  <Chip tone="rose">Proposal not scanned</Chip>
                )}
                {protocol.declaration?.accepted ? (
                  <Chip tone="em">PI declaration accepted</Chip>
                ) : (
                  <Chip tone="rose">PI declaration missing</Chip>
                )}
              </div>
              {protocol.scan ? (
                <div className="mt-3">
                  <div className="h-2 overflow-hidden rounded-full bg-panel-2">
                    <div className="h-full rounded-full bg-sky" style={{ width: `${protocol.scan.completeness}%` }} />
                  </div>
                  {protocol.scan.missing.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {protocol.scan.missing.map((section) => (
                        <span key={section} className="rounded-full border border-amber/30 bg-amber/10 px-2 py-0.5 text-xs text-amber">{section}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-em">All 28 required sections were found.</p>
                  )}
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-semibold tracking-wide text-muted uppercase">28-section checklist</summary>
                    <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {protocol.scan.checklist.map((item) => (
                        <li key={item.section} className="flex items-center gap-2 text-xs">
                          <span className={item.present ? "text-em" : "text-rose"}>{item.present ? "✓" : "✕"}</span>
                          <span className={item.present ? "text-muted" : "text-rose"}>{item.section}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
              ) : null}
              {protocol.declaration?.accepted ? (
                <p className="mt-3 text-xs text-muted">
                  Declaration accepted by <span className="font-semibold text-fg">{protocol.declaration.piName}</span> on {protocol.declaration.acceptedAt}.
                </p>
              ) : null}
            </section>
          </Card>

          <DocumentReviewCard protocol={protocol} />
          {protocol.revision ? <RevisionPanel protocol={protocol} /> : null}
          <FinalProtocolPanel protocol={protocol} />

          <Card className="p-4 md:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Assessments</h2>
              <p className="text-sm tabular-nums text-muted">{protocol.reviews.length}/{protocol.reviewers.length || 0}</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-panel-2">
              <div className="h-full rounded-full bg-sky" style={{ width: `${pct}%` }} />
            </div>
            <ul className="mt-4 space-y-3">
              {protocol.reviewers.map((name, index) => {
                const review = protocol.reviews.find((r) => r.reviewer === name);
                const label = role === "investigator" ? `Reviewer ${String(index + 1).padStart(2, "0")}` : name;
                return (
                  <li key={name} className="rounded-xl border border-line bg-ink-2/50 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{label}</p>
                      {review ? (
                        <Chip tone={review.recommendation.includes("Not") ? "rose" : review.recommendation.includes("major") ? "amber" : "em"}>{review.recommendation}</Chip>
                      ) : (
                        <Chip tone={isOverdue(protocol, name) ? "rose" : "amber"}>{isOverdue(protocol, name) ? "Overdue" : "Pending"}</Chip>
                      )}
                      {review ? <span className="ml-auto text-xs text-muted">{review.date}</span> : null}
                    </div>
                    {review?.comments ? <p className="mt-2 text-sm text-muted">{review.comments}</p> : null}
                  </li>
                );
              })}
              {protocol.reviewers.length === 0 ? <li className="text-sm text-muted">No reviewers assigned yet.</li> : null}
            </ul>
          </Card>

          {protocol.decision ? (
            <Card className="p-4 md:p-5">
              <h2 className="text-lg font-semibold">Committee decision</h2>
              <div className="mt-3 rounded-xl border border-em/30 bg-em/10 p-3 text-sm">
                <p className="font-semibold text-em">{protocol.decision}</p>
                <p className="mt-1 text-fg">{protocol.decisionNote || "Recorded in the minutes."}</p>
                {protocol.votes ? (
                  <p className="mt-2 text-xs text-muted tabular-nums">
                    Votes {protocol.votes.for} for · {protocol.votes.against} against · {protocol.votes.abstain} abstained
                  </p>
                ) : null}
              </div>
              {protocol.letter ? <p className="mt-3 text-sm leading-relaxed text-muted">{protocol.letter}</p> : null}
              {protocol.continuingDue ? <p className="mt-2 text-sm">Continuing review due <span className="font-semibold tabular-nums">{protocol.continuingDue}</span></p> : null}
              {protocol.letter && protocol.decision?.startsWith("Approved") ? (
                <Btn className="mt-3" kind="primary" onClick={() => openModal({ type: "certificate", id: protocol.id })}>
                  View clearance certificate
                </Btn>
              ) : null}
            </Card>
          ) : null}

          {protocol.amendment ? (
            <Card className="p-4 md:p-5">
              <h2 className="text-lg font-semibold">Amendment</h2>
              <p className="mt-2 text-sm">{protocol.amendment.summary}</p>
              <p className="mt-2 text-xs text-muted">{protocol.amendment.date} · {protocol.amendment.status}</p>
            </Card>
          ) : null}

          <Card className="p-4 md:p-5">
            <h2 className="text-lg font-semibold">Audit trail</h2>
            <ol className="mt-4 space-y-4 border-l border-line pl-4">
              {[...protocol.history].reverse().map((x, i) => (
                <li key={`${x.date}-${x.action}-${i}`} className={`relative ${i === 0 ? "rounded-lg bg-sky/5 p-2" : ""}`}>
                  <span className={`absolute -left-[1.2rem] top-1 size-2.5 rounded-full border-2 ${i === 0 ? "border-em bg-em" : "border-sky bg-ink"}`} />
                  <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
                    {x.date}
                    {x.at ? <span className="font-normal text-muted">{new Date(x.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span> : null}
                    {i === 0 ? <Chip tone="em">Latest</Chip> : null}
                  </p>
                  <p className="text-sm font-semibold">{x.action}</p>
                  <p className="text-xs text-muted">{actorFor(x.actor, role)}{x.note ? ` — ${x.note}` : ""}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <Actions protocol={protocol} />
      </div>
    </div>
  );
}

function actorFor(actor: string, role: RoleKey | null): string {
  if (role !== "investigator") return actor;
  if (actor === ROLES.investigator.name) return actor;
  if (actor === ROLES.secretariat.name) return "Secretariat";
  if (actor === ROLES.chair.name) return "Chairperson";
  if (actor === ROLES.admin.name) return "System Administrator";
  if (/system/i.test(actor)) return "System";
  return "Reviewer";
}

function Meta({ k, v }: { k: string; v: string }) {  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{k}</dt>
      <dd className="mt-1 text-sm font-semibold">{v}</dd>
    </div>
  );
}

function TextBlock({ k, v }: { k: string; v: string }) {
  if (!v) return null;
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{k}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{v}</p>
    </div>
  );
}

function DocList({ protocol }: { protocol: Protocol }) {
  const role = useIrerc((s) => s.role)!;
  const setDoc = useIrerc((s) => s.setDoc);
  const editable = (role === "secretariat" || role === "admin") && protocol.status === "screening";
  const tone = { verified: "em", uploaded: "sky", missing: "rose", correction: "amber" } as const;
  return (
    <ul className="mt-3 divide-y divide-line">
      {protocol.docs.map((d) => (
        <li key={d.code} className="flex flex-wrap items-center gap-2 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{d.name}{d.required ? "" : " (optional)"}</p>
          </div>
          <Chip tone={tone[d.state]}>{d.state}</Chip>
          {d.code === "DOC_PROTOCOL" ? (
            protocol.initialProtocolLockedAt && !["submitted", "screening", "correction"].includes(protocol.status) ? (
              <Chip tone="muted"><Lock className="mr-1 size-3" /> Locked initial</Chip>
            ) : (
              <Chip tone="sky">Initial submission</Chip>
            )
          ) : null}
          <DocumentActions
            protocolId={protocol.id}
            code={d.code}
            versions={(protocol.documentVersions ?? []).filter((v) => v.code === d.code)}
          />
          {editable ? (
            <div className="flex gap-2">
              <Btn className="px-3" onClick={() => setDoc(protocol.id, d.code, "verified")}>Verify</Btn>
              <Btn className="px-3" kind="danger" onClick={() => setDoc(protocol.id, d.code, "correction")}>Correct</Btn>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function Actions({ protocol: p }: { protocol: Protocol }) {
  const role = useIrerc((s) => s.role)!;
  const acting = useIrerc((s) => s.actingReviewer);
  const startScreening = useIrerc((s) => s.startScreening);
  const passScreening = useIrerc((s) => s.passScreening);
  const returnForCorrection = useIrerc((s) => s.returnForCorrection);
  const resubmit = useIrerc((s) => s.resubmit);
  const placeOnAgenda = useIrerc((s) => s.placeOnAgenda);
  const openModal = useIrerc((s) => s.openModal);
  const decideAmendment = useIrerc((s) => s.decideAmendment);
  const archiveProtocol = useIrerc((s) => s.archiveProtocol);
  const [note, setNote] = useState("");
  const staff = role === "secretariat" || role === "admin";
  const own = p.pi === ROLES.investigator.name;
  const buttons: { key: string; node: ReactNode }[] = [];

  buttons.push({
    key: "review",
    node: (
      <Btn onClick={() => openModal({ type: "review", id: p.id })}>
        {role === "investigator" ? "Read reviewer comments" : "Review documents"}
      </Btn>
    ),
  });

  if (staff && p.status === "submitted")
    buttons.push({ key: "start", node: <Btn kind="primary" onClick={() => startScreening(p.id)}>Start administrative check</Btn> });
  if (staff && p.status === "screening") {
    buttons.push({ key: "pass", node: <Btn kind="primary" disabled={!requiredDocsOk(p)} onClick={() => passScreening(p.id)}>Mark submission complete</Btn> });
  }
  if ((staff || role === "chair") && (p.status === "complete" || p.status === "classified"))
    buttons.push({ key: "class", node: <Btn kind="primary" onClick={() => openModal({ type: "classify", id: p.id })}>{p.reviewType ? "Change review type" : "Classify review type"}</Btn> });
  if ((staff || role === "chair") && p.status === "classified" && p.reviewType !== "Exemption Review")
    buttons.push({ key: "assign", node: <Btn kind="primary" onClick={() => openModal({ type: "assign", id: p.id })}>Assign reviewers</Btn> });
  if (role === "reviewer" && myReviewPending(p, acting))
    buttons.push({ key: "assess", node: <Btn kind="primary" onClick={() => openModal({ type: "assess", id: p.id })}>Open assessment form</Btn> });
  if (staff && p.status === "reviews_complete")
    buttons.push({ key: "agenda", node: <Btn kind="primary" onClick={() => placeOnAgenda(p.id)}>Place on agenda</Btn> });
  if ((role === "secretariat" || role === "chair") && p.status === "reviews_complete")
    buttons.push({ key: "revise", node: <Btn onClick={() => openModal({ type: "revision", id: p.id })}>Request revisions (48h)</Btn> });
  if (canDecide(role, p))
    buttons.push({ key: "decide", node: <Btn kind="go" onClick={() => openModal({ type: "decide", id: p.id })}>Record committee decision</Btn> });
  if (staff && p.status === "decided")
    buttons.push({ key: "letter", node: <Btn kind="go" onClick={() => openModal({ type: "letter", id: p.id })}>Send action letter</Btn> });
  if (role === "investigator" && own && isSubmissionUpdateOpen(p))
    buttons.push({ key: "update", node: <Btn kind="primary" onClick={() => openModal({ type: "update", id: p.id })}>Update Submission</Btn> });
  if (role === "investigator" && own && p.status === "correction" && !isSubmissionUpdateOpen(p))
    buttons.push({ key: "resub", node: <Btn kind="primary" onClick={() => resubmit(p.id)}>Resubmit corrected package</Btn> });
  if (role === "investigator" && own && (p.status === "active" || p.status === "reviewing" || p.status === "agenda"))
    buttons.push({ key: "sae", node: <Btn onClick={() => openModal({ type: "sae", id: p.id })}>Report a safety event</Btn> });
  if (role === "investigator" && own && p.status === "active") {
    buttons.push({ key: "amend", node: <Btn onClick={() => openModal({ type: "amend", id: p.id })}>Submit amendment</Btn> });
    buttons.push({ key: "cont", node: <Btn onClick={() => openModal({ type: "continuing", id: p.id })}>File continuing review</Btn> });
  }
  if (role === "chair" && p.amendment?.status === "Pending review") {
    buttons.push({ key: "am-y", node: <Btn kind="go" onClick={() => decideAmendment(p.id, true)}>Approve amendment</Btn> });
    buttons.push({ key: "am-n", node: <Btn kind="danger" onClick={() => decideAmendment(p.id, false)}>Do not approve amendment</Btn> });
  }
  if (staff && p.status === "active")
    buttons.push({ key: "arch", node: <Btn onClick={() => archiveProtocol(p.id)}>Archive after close-out</Btn> });

  return (
    <Card className="p-4 md:p-5 lg:sticky lg:top-20">
      <h2 className="text-lg font-semibold">Your actions</h2>
      <p className="text-sm text-muted">{ROLES[role].title}</p>
      <div className="mt-4 flex flex-col gap-2">
        {buttons.map((b) => <div key={b.key}>{b.node}</div>)}
        {buttons.length === 0 ? (
          <p className="rounded-xl border border-line bg-ink-2/40 p-3 text-sm text-muted">
            Nothing for {ROLES[role].title} at this stage. {p.status === "archived" ? "The file is archived." : "The next step belongs to another role."}
          </p>
        ) : null}
      </div>
      {staff && p.status === "screening" ? (
        <div className="mt-4">
          <label className="text-xs font-semibold tracking-wide text-muted uppercase">
            Return note
            <textarea className={fieldClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What the investigator must fix" />
          </label>
          <Btn className="mt-2 w-full" kind="danger" onClick={() => returnForCorrection(p.id, note)}>Return for correction</Btn>
        </div>
      ) : null}
      <p className="mt-4 text-xs leading-relaxed text-muted">
        Decisions are taken by the committee, or by the chair where the committee's procedures allow expedited or exemption review. Secretariat and the digital system cannot approve a protocol.
      </p>
    </Card>
  );
}

function canDecide(role: RoleKey, p: Protocol) {
  if (role !== "chair") return false;
  if (p.status === "agenda" || p.status === "reviews_complete") return true;
  if (p.reviewType === "Exemption Review" && (p.status === "classified" || p.status === "complete")) return true;
  if (p.reviewType === "Expedited Review" && ["classified", "assigned", "reviewing", "reviews_complete"].includes(p.status)) return true;
  return false;
}

import { REMOTE } from "./remote-flag";
import type { TitleSimilarity } from "./title-similarity";

const now = new Date();
export const TODAY = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

export type RoleKey = "investigator" | "secretariat" | "reviewer" | "chair" | "admin";

export type Status =
  | "submitted"
  | "screening"
  | "correction"
  | "complete"
  | "classified"
  | "assigned"
  | "reviewing"
  | "reviews_complete"
  | "revision"
  | "agenda"
  | "decided"
  | "active"
  | "archived";

export type ReviewType = "Full Board Review" | "Expedited Review" | "Exemption Review";

export type DocState = "missing" | "uploaded" | "verified" | "correction";

export type CriterionResult = "Appropriate" | "Not appropriate" | "N/A";

export type Doc = {
  code: string;
  name: string;
  required: boolean;
  state: DocState;
};

export type Review = {
  reviewer: string;
  date: string;
  recommendation: string;
  comments: string;
  conflict: boolean;
};

export type HistoryItem = { date: string; at?: string; actor: string; action: string; note?: string };

export type Amendment = {
  summary: string;
  date: string;
  status: "Pending review" | "Approved" | "Not approved";
};

export type SubmissionFile = {
  name: string;
  size: number;
  type: string;
};

/** The eight-step Research Protocol Submission form used by AAPHREML-IRERC. */
export type OfficialSubmission = {
  code: string;
  college: string;
  collegeOther: string;
  department: string;
  departmentOther: string;
  activityType: string;
  activityTypeOther: string;
  educationLevel: string;
  educationLevelOther: string;
  projectOutcomesTangible: string;
  projectOutcomesPublications: string;
  projectIndicators: string;
  projectMonitoringFreq: string;
  projectFeedbackMechanisms: string;
  projectSustainability: string;
  projectBudgetBreakdown: string;
  projectBudgetJustification: string;
  advisorName: string;
  advisorEmail: string;
  advisorPhone: string;
  piName: string;
  piPhone: string;
  piEmail: string;
  studyTitle: string;
  healthFocus: string;
  healthFocusOther: string;
  dataStart: string;
  dataEnd: string;
  frequency: string;
  methods: string;
  sampleSize: string;
  studyDesign: string;
  studyDesignOther: string;
  clinicalTrial: string[];
  generalObjective: string;
  specificObjectives: string;
  geoCoverage: string;
  geoCoverageOther: string;
  specificSite: string;
  gender: string;
  targetGroup: string;
  targetGroupOther: string;
  electronic: string;
  gps: string;
  tools: string;
  toolsOther: string;
  dataFormat: string[];
  accessibility: string;
  restrictionReason: string;
  funding: string;
  fundingOther: string;
  budget: string;
  files: {
    supportingLetter: SubmissionFile | null;
    piId: SubmissionFile | null;
    proposalDoc: SubmissionFile | null;
    cv: SubmissionFile | null;
  };
  acknowledge: boolean;
  declarationAccepted: boolean;
};

export type DeclarationRecord = {
  accepted: boolean;
  acceptedAt: string;
  piName: string;
  text: string;
};

export type DocumentVersion = {
  code: string;
  version: number;
  name: string;
  size: number;
  type?: string;
  uploadedAt: string;
  uploadedBy: string;
  note: string;
};

export const FINAL_PROTOCOL_CODE = "DOC_FINAL_PROTOCOL";

export type FinalProtocolStatus = "not_started" | "draft" | "submitted" | "under_review" | "accepted" | "rejected";

export type FinalProtocolRecord = {
  status: FinalProtocolStatus;
  versions: DocumentVersion[];
  submittedAt: string | null;
  updatedAt: string | null;
};

export type DocumentComment = {
  id: string;
  protocolId: string;
  code: string;
  version: number;
  author: string;
  authorRole: RoleKey;
  text: string;
  quote: string;
  createdAt: string;
  resolved: boolean;
};

export type Revision = {
  status: "requested" | "submitted" | "expired" | "closed";
  requestedAt: string;
  dueAt: string;
  requestedBy: string;
  comments: string;
  reviews?: Review[];
  extendedAt: string | null;
  extendedBy: string | null;
  submittedAt: string | null;
};

export type NotificationType =
  | "submission"
  | "document"
  | "review"
  | "decision"
  | "revision"
  | "safety"
  | "system";

export type NotificationPriority = "high" | "normal" | "low";

export type AppNotification = {
  id: string;
  protocolId: string | null;
  recipientRole: RoleKey | "all";
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

export const DOC_CODE_BY_FILE = {
  supportingLetter: "DOC_SUPPORT",
  piId: "DOC_PI_ID",
  proposalDoc: "DOC_PROTOCOL",
  cv: "DOC_CV",
} as const;

export type SubmissionFileKey = keyof typeof DOC_CODE_BY_FILE;

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  submission: "Submission",
  document: "Document",
  review: "Review",
  decision: "Decision",
  revision: "Revision",
  safety: "Safety",
  system: "System",
};

export const NOTIFICATION_PRIORITY_LABEL: Record<NotificationPriority, string> = {
  high: "High",
  normal: "Normal",
  low: "Low",
};

export type ScanChecklistItem = { section: string; present: boolean };

export type ScanResult = {
  fileName: string;
  scannedAt: string;
  total: number;
  present: number;
  completeness: number;
  missing: string[];
  checklist: ScanChecklistItem[];
  extracted: {
    title?: string;
    institution?: string;
    sampleSize?: string;
    studyPeriod?: string;
    email?: string;
    phoneNumber?: string;
  };
};

export type Protocol = {
  id: string;
  title: string;
  type: string;
  focus: string;
  category: string;
  pi: string;
  institution: string;
  sponsor: string;
  site: string;
  submitted: string;
  status: Status;
  reviewType: ReviewType | null;
  decision: string | null;
  decisionNote: string;
  votes: { for: number; against: number; abstain: number } | null;
  reviewers: string[];
  reviews: Review[];
  docs: Doc[];
  history: HistoryItem[];
  summary: string;
  consentLanguages: string;
  vulnerable: string;
  continuingDue: string | null;
  letter: string | null;
  amendment: Amendment | null;
  assignedOn: string | null;
  submission: OfficialSubmission;
  declaration: DeclarationRecord;
  scan: ScanResult | null;
  revision?: Revision | null;
  documentVersions?: DocumentVersion[];
  documentComments?: DocumentComment[];
  titleSimilarity?: TitleSimilarity;
  initialProtocolLockedAt?: string | null;
  submissionUpdateUntil?: string | null;
  submissionUpdatedAt?: string | null;
  finalProtocol?: FinalProtocolRecord | null;
};

export const BRAND = {
  short: "AAPHREML-IRERC",
  portal: "Institutional Research Ethics Review Portal",
  bureau: "Addis Ababa City Administration Health Bureau",
  directorate: "Public Health Emergency Management Laboratory & Research Directorate",
  title: "AAPHREML-IRERC Institutional Research Ethics Review Portal",
  full: "AAPHREML-IRERC Institutional Research Ethics Review Portal — Addis Ababa City Administration Health Bureau Public Health Emergency Management Laboratory & Research Directorate",
} as const;

export type SafetyReport = {
  id: string;
  protocolId: string;
  event: string;
  date: string;
  relatedness: string;
  seriousness: string;
  status: string;
  note: string;
};

export type ViewKey =
  | "dashboard"
  | "protocols"
  | "detail"
  | "reviews"
  | "screening"
  | "committee"
  | "safety"
  | "monitor"
  | "archive"
  | "system"
  | "roster"
  | "settings";

export const ROLES: Record<
  RoleKey,
  { name: string; title: string; initials: string; blurb: string }
> = {
  investigator: {
    name: "Principal Investigator",
    title: "Investigator / PI",
    initials: "PI",
    blurb: "Submits protocols, amendments, safety reports, and continuing review.",
  },
  secretariat: {
    name: "IRERC Secretariat",
    title: "IRERC Secretariat",
    initials: "SEC",
    blurb: "Receives, screens, assigns, schedules, communicates, and archives. No decision authority.",
  },
  reviewer: {
    name: "IRERC Reviewer",
    title: "IRERC Member / Reviewer",
    initials: "REV",
    blurb: "Completes the 20-point assessment for assigned protocols only.",
  },
  chair: {
    name: "Chairperson",
    title: "Chairperson",
    initials: "CH",
    blurb: "Chairs meetings, records the committee decision, and signs expedited items.",
  },
  admin: {
    name: "System Administrator",
    title: "Digital system support",
    initials: "SA",
    blurb: "Access control, audit, and document control. No independent decision authority.",
  },
};

export type MemberSeat = "Chairperson" | "Member" | "Lay member";

export type Member = {
  id: string;
  name: string;
  category: string;
  seat: MemberSeat;
  institution: string;
  email: string;
  phone: string;
  active: boolean;
  lay: boolean;
};

export type MemberInput = Omit<Member, "id" | "lay">;

export const MEMBER_CATEGORIES = [
  "Public Health Expert",
  "Clinical Expert",
  "Laboratory Scientist",
  "Ethics / Legal Expert",
  "Environmental Health Professional",
  "Community Representative",
] as const;

export const MEMBER_SEATS: MemberSeat[] = ["Chairperson", "Member", "Lay member"];

export function isReviewerSeat(seat: MemberSeat): boolean {
  return seat === "Member" || seat === "Lay member";
}

export const DOC_DEFS: { code: string; name: string; required: boolean }[] = [
  { code: "DOC_SUPPORT", name: "Institutional Supporting Letter", required: true },
  { code: "DOC_PI_ID", name: "PI Identification", required: true },
  { code: "DOC_PROTOCOL", name: "Complete Proposal Document", required: true },
  { code: "DOC_CV", name: "Principal Investigator CV", required: true },
];

export const CRITERIA: { code: string; section: string; question: string }[] = [
  { code: "CRIT_01", section: "Science", question: "Is the research rationale clearly described and scientifically sound?" },
  { code: "CRIT_02", section: "Science", question: "Is the study design appropriate to the stated objectives?" },
  { code: "CRIT_03", section: "Science", question: "Is the sample size justified?" },
  { code: "CRIT_04", section: "Science", question: "Are inclusion and exclusion criteria clear and fair?" },
  { code: "CRIT_05", section: "Science", question: "Are data collection tools and procedures appropriate?" },
  { code: "CRIT_06", section: "Science", question: "Are data verification and quality controls adequate?" },
  { code: "CRIT_07", section: "Consent", question: "Is informed consent voluntary, comprehensible, and properly documented?" },
  { code: "CRIT_08", section: "Consent", question: "Are information sheets and consent forms accurate in local languages?" },
  { code: "CRIT_09", section: "Risk", question: "Are physical, psychological, social, and legal risks identified and minimized?" },
  { code: "CRIT_10", section: "Risk", question: "Are risks reasonable relative to anticipated benefits?" },
  { code: "CRIT_11", section: "Risk", question: "Are vulnerable participants adequately safeguarded?" },
  { code: "CRIT_12", section: "Protection", question: "Are privacy, de-identification, and confidentiality provisions adequate?" },
  { code: "CRIT_13", section: "Protection", question: "Is compensation fair and non-coercive?" },
  { code: "CRIT_14", section: "Protection", question: "Are investigator qualifications and ethics training documented?" },
  { code: "CRIT_15", section: "Protection", question: "Are the proposed sites adequate?" },
  { code: "CRIT_16", section: "Oversight", question: "Is community engagement or local dissemination planned?" },
  { code: "CRIT_17", section: "Oversight", question: "Are conflicts of interest disclosed and managed?" },
  { code: "CRIT_18", section: "Oversight", question: "Is the timeline feasible?" },
  { code: "CRIT_19", section: "Oversight", question: "Is the budget itemized and free of coercive inducements?" },
  { code: "CRIT_20", section: "Oversight", question: "Does the study meet Ethiopian research guidance and the Declaration of Helsinki?" },
];

export const SECTIONS = ["Science", "Consent", "Risk", "Protection", "Oversight"] as const;

export const FOCUS_TO_CATEGORY: Record<string, string> = {
  "Communicable diseases": "Biomedical & Laboratory",
  "Non-communicable diseases": "Clinical Trial / Interventional",
  "Reproductive, maternal, newborn, and child health": "Observational / Epidemiological",
  "Food and nutrition": "Public Health & Health Systems",
  "Neglected tropical diseases": "Biomedical & Laboratory",
  "Water, Sanitation & Hygiene": "Environmental & Occupational Health",
  "Mental health and well-being": "Socio-behavioral & Qualitative",
  "Environmental and workplace health": "Environmental & Occupational Health",
  "Health service planning & management": "Health Systems & Policy",
  "Digital health technology": "Health Systems & Policy",
  "Prevention and detection of diseases/PHEM": "Public Health & Health Systems",
  "Health and Human Services/Health Workforce": "Health Systems & Policy",
  "Disability & Rehabilitation": "Public Health & Health Systems",
  "Health systems and services": "Health Systems & Policy",
  "Biomedical / laboratory research": "Biomedical & Laboratory",
};

export const CATEGORY_EXPERTISE: Record<string, string> = {
  "Biomedical & Laboratory": "Laboratory Scientist",
  "Clinical Trial / Interventional": "Clinical Expert",
  "Observational / Epidemiological": "Public Health Expert",
  "Public Health & Health Systems": "Public Health Expert",
  "Environmental & Occupational Health": "Environmental Health Professional",
  "Health Systems & Policy": "Public Health Expert",
  "Socio-behavioral & Qualitative": "Ethics / Legal Expert",
};

export const STUDY_TYPES = [
  "Clinical Trial — Phase I",
  "Clinical Trial — Phase II",
  "Clinical Trial — Phase III",
  "Observational — Cohort",
  "Observational — Community Survey",
  "Genetic Study — Stored Specimens",
  "Medical Device Study — NSR",
  "Medical Device Study — SR",
  "Community Intervention",
  "Socio-behavioral Study",
];

export const DECISIONS = [
  "Approved",
  "Approved with Conditions",
  "Modifications Required",
  "Deferred",
  "Not Approved",
] as const;

export const RECOMMENDATIONS = [
  "Approved",
  "Approved with minor modification",
  "Approved with major modification",
  "Not Approved",
] as const;

export const PIPE: { key: string; label: string; match: Status[] }[] = [
  { key: "in", label: "Submitted", match: ["submitted"] },
  { key: "screen", label: "Screening", match: ["screening", "correction"] },
  { key: "class", label: "Classified", match: ["complete", "classified"] },
  { key: "assign", label: "Assigned", match: ["assigned"] },
  { key: "review", label: "Review", match: ["reviewing", "reviews_complete", "revision"] },
  { key: "agenda", label: "Agenda", match: ["agenda"] },
  { key: "decide", label: "Decision", match: ["decided"] },
  { key: "live", label: "Clearance", match: ["active", "archived"] },
];

export const STATUS_LABEL: Record<Status, string> = {
  submitted: "Submitted",
  screening: "Administrative check",
  correction: "Correction required",
  complete: "Submission complete",
  classified: "Review type set",
  assigned: "Reviewers assigned",
  reviewing: "Under review",
  reviews_complete: "Reviews complete",
  revision: "Revision requested",
  agenda: "On committee agenda",
  decided: "Decision recorded",
  active: "Clearance active",
  archived: "Archived",
};

export type ChipTone = "sky" | "em" | "amber" | "rose" | "muted";

export const STATUS_TONE: Record<Status, ChipTone> = {
  submitted: "muted",
  screening: "sky",
  correction: "rose",
  complete: "sky",
  classified: "sky",
  assigned: "sky",
  reviewing: "amber",
  reviews_complete: "em",
  revision: "amber",
  agenda: "amber",
  decided: "sky",
  active: "em",
  archived: "muted",
};

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function h(date: string, actor: string, action: string, note = ""): HistoryItem {
  return { date, at: new Date().toISOString(), actor, action, note };
}

export function requiredDocsOk(p: Protocol) {
  return p.docs.filter((d) => d.required).every((d) => d.state === "verified");
}

export function stageIndex(status: Status) {
  const i = PIPE.findIndex((s) => s.match.includes(status));
  return i < 0 ? 0 : i;
}

export function reviewDue(p: Protocol) {
  if (!p.assignedOn) return null;
  return addDays(p.assignedOn, 9);
}

export function revisionRemainingMs(p: Protocol, now = Date.now()): number {
  if (!p.revision) return 0;
  return Math.max(0, new Date(p.revision.dueAt).getTime() - now);
}

export function isRevisionOpen(p: Protocol, now = Date.now()): boolean {
  return p.revision?.status === "requested" && revisionRemainingMs(p, now) > 0;
}

export function submissionUpdateDeadline(p: Protocol): number {
  if (p.submissionUpdateUntil) return new Date(p.submissionUpdateUntil).getTime();
  if (!p.submitted) return 0;
  // Older local records stored only a calendar date. Give them the same
  // 48-hour window from the start of that submission day.
  return new Date(`${p.submitted}T00:00:00`).getTime() + 48 * 60 * 60 * 1000;
}

export function submissionUpdateRemainingMs(p: Protocol, now = Date.now()): number {
  return Math.max(0, submissionUpdateDeadline(p) - now);
}

/**
 * The PI can correct the submitted answers and supporting files during the
 * 48-hour update window. The initial protocol file becomes read-only once it is
 * forwarded to reviewers; the final-protocol PDF workflow handles protocol
 * replacements after that point.
 */
export function isSubmissionUpdateOpen(p: Protocol, now = Date.now()): boolean {
  if (!["submitted", "screening", "correction", "assigned", "reviewing"].includes(p.status)) return false;
  return submissionUpdateRemainingMs(p, now) > 0;
}

export function isOverdue(p: Protocol, reviewer: string) {
  const due = reviewDue(p);
  if (!due) return false;
  if (!["assigned", "reviewing"].includes(p.status)) return false;
  if (p.reviews.some((r) => r.reviewer === reviewer)) return false;
  return due < TODAY;
}

export function myReviewPending(p: Protocol, name: string) {
  return (
    p.reviewers.includes(name) &&
    !p.reviews.some((r) => r.reviewer === name) &&
    (p.status === "assigned" || p.status === "reviewing")
  );
}

export function visibleTo(role: RoleKey, p: Protocol) {
  // Server mode: the server already returned only what this person may see.
  if (REMOTE) return true;
  if (role === "investigator") return p.pi === ROLES.investigator.name;
  return true;
}

export function actorName(role: RoleKey, acting: string) {
  if (role === "reviewer") return acting;
  return ROLES[role].name;
}

export const NAV: { key: ViewKey; label: string; roles: RoleKey[]; important?: boolean }[] = [
  { key: "dashboard", label: "Dashboard", roles: ["investigator", "secretariat", "reviewer", "chair", "admin"] },
  { key: "protocols", label: "Protocols", roles: ["investigator", "secretariat", "reviewer", "chair", "admin"] },
  { key: "screening", label: "Screening desk", roles: ["secretariat", "admin"] },
  { key: "reviews", label: "My reviews", roles: ["reviewer"] },
  { key: "committee", label: "Committee", roles: ["chair", "secretariat", "admin"] },
  { key: "safety", label: "Safety reports", roles: ["investigator", "secretariat", "reviewer", "chair", "admin"] },
  { key: "monitor", label: "After clearance", roles: ["investigator", "secretariat", "chair", "admin"] },
  { key: "archive", label: "Archive", roles: ["secretariat", "chair", "admin"] },
  { key: "system", label: "System & audit", roles: ["admin", "secretariat"] },
  { key: "roster", label: "Roster", roles: ["secretariat", "reviewer", "chair", "admin"] },
  { key: "settings", label: "Settings & role guide", roles: ["investigator", "secretariat", "reviewer", "chair", "admin"], important: true },
];

export function nextProtocolId(list: Protocol[]) {
  const n = list.reduce((max, p) => {
    const m = /(\d+)$/.exec(p.id);
    return Math.max(max, m ? Number(m[1]) : 0);
  }, 0);
  return `AAPHREML-IRERC-${new Date().getFullYear()}-${String(n + 1).padStart(4, "0")}`;
}

export function clone<T>(v: T): T {
  return structuredClone(v);
}

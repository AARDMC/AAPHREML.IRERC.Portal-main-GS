import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  TODAY,
  actorName,
  addDays,
  DOC_DEFS,
  DOC_CODE_BY_FILE,
  FOCUS_TO_CATEGORY,
  h,
  isReviewerSeat,
  isRevisionOpen,
  isSubmissionUpdateOpen,
  type HistoryItem,
  myReviewPending,
  nextProtocolId,
  type OfficialSubmission,
  type Member,
  type MemberInput,
  type Protocol,
  type Revision,
  type DocumentVersion,
  type DocumentComment,
  FINAL_PROTOCOL_CODE,
  type AppNotification,
  type SubmissionFileKey,
  type ReviewType,
  type RoleKey,
  ROLES,
  requiredDocsOk,
  type SafetyReport,
  type ScanResult,
  type Status,
  type ViewKey,
} from "@/lib/irerc/model";
import { DECLARATION_TEXT } from "@/lib/irerc/submission-template";
import { assessTitleSimilarity } from "@/lib/irerc/title-similarity";
import { REMOTE } from "@/lib/irerc/remote-flag";

export type ModalState =
  | { type: "submit" }
  | { type: "assign"; id: string }
  | { type: "assess"; id: string }
  | { type: "decide"; id: string }
  | { type: "letter"; id: string }
  | { type: "certificate"; id: string }
  | { type: "classify"; id: string }
  | { type: "safety"; id: string }
  | { type: "sae"; id: string }
  | { type: "amend"; id: string }
  | { type: "continuing"; id: string }
  | { type: "revision"; id: string }
  | { type: "update"; id: string }
  | { type: "review"; id: string; code?: string }
  | null;

type Toast = { id: number; msg: string; kind: "ok" | "warn" };

export type SubmissionInput = {
  form: OfficialSubmission;
  scan: ScanResult | null;
};

export type SubmissionUpdateInput = {
  form: OfficialSubmission;
  scan: ScanResult | null;
  versions: DocumentVersion[];
};

type IrercState = {
  role: RoleKey | null;
  actingReviewer: string;
  view: ViewKey;
  returnView: ViewKey;
  selectedId: string | null;
  filter: string;
  query: string;
  navOpen: boolean;
  protocols: Protocol[];
  safety: SafetyReport[];
  members: Member[];
  notifications: AppNotification[];
  profilePhotos: Partial<Record<RoleKey, string>>;
  modal: ModalState;
  toasts: Toast[];
  celebrate: number;
  login: (role: RoleKey) => void;
  logout: () => void;
  go: (view: ViewKey) => void;
  openProtocol: (id: string) => void;
  setFilter: (f: string) => void;
  setQuery: (q: string) => void;
  setNav: (open: boolean) => void;
  setActing: (name: string) => void;
  openModal: (modal: ModalState) => void;
  closeModal: () => void;
  dismissToast: (id: number) => void;
  submitProtocol: (input: SubmissionInput) => void;
  updateSubmission: (id: string, input: SubmissionUpdateInput) => void;
  addDocumentComment: (id: string, input: { code: string; version: number; text: string; quote: string }) => void;
  toggleDocumentComment: (id: string, commentId: string) => void;
  addMember: (input: MemberInput) => void;
  updateMember: (id: string, input: MemberInput) => void;
  removeMember: (id: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  setProfilePhoto: (role: RoleKey, dataUrl: string | null) => void;
  requestRevision: (id: string, comments: string) => void;
  extendRevision: (id: string, hours?: number) => void;
  recordDocumentRevision: (id: string, version: DocumentVersion) => void;
  uploadFinalProtocol: (id: string, version: DocumentVersion) => void;
  submitFinalProtocol: (id: string) => void;
  submitRevision: (id: string) => void;
  checkRevisionWindows: () => void;
  startScreening: (id: string) => void;
  setDoc: (id: string, code: string, state: Protocol["docs"][number]["state"]) => void;
  passScreening: (id: string) => void;
  returnForCorrection: (id: string, note: string) => void;
  resubmit: (id: string) => void;
  classify: (id: string, reviewType: ReviewType) => void;
  assignReviewers: (id: string, names: string[]) => void;
  placeOnAgenda: (id: string) => void;
  saveAssessment: (id: string, recommendation: string, comments: string, conflict: boolean, failed: string[]) => void;
  saveDecision: (id: string, decision: string, note: string, votes: { for: number; against: number; abstain: number }) => void;
  sendLetter: (id: string, message: string, continuingDue: string) => void;
  reviewSafety: (id: string, action: string, note: string) => void;
  fileSae: (protocolId: string, event: string, relatedness: string, seriousness: string) => void;
  fileAmendment: (id: string, summary: string) => void;
  decideAmendment: (id: string, approved: boolean) => void;
  fileContinuing: (id: string, summary: string) => void;
  archiveProtocol: (id: string) => void;
};

let toastSeq = 1;

function toastOf(msg: string, kind: Toast["kind"] = "ok"): Toast {
  return { id: ++toastSeq, msg, kind };
}

export const useIrerc = create<IrercState>()(
  persist(
    (set, get) => {
      const push = (msg: string, kind: Toast["kind"] = "ok") => {
        const t = toastOf(msg, kind);
        set((s) => ({ toasts: [...s.toasts, t] }));
        setTimeout(() => get().dismissToast(t.id), 3600);
      };

      const patch = (id: string, fn: (p: Protocol) => Protocol) => {
        set((s) => ({
          protocols: s.protocols.map((p) => (p.id === id ? fn(p) : p)),
        }));
      };

      const actor = () => {
        const s = get();
        return s.role ? actorName(s.role, s.actingReviewer) : "System";
      };

      const note = (p: Protocol, action: string, extra = ""): Protocol => ({
        ...p,
        history: [...p.history, h(TODAY, actor(), action, extra)],
      });

      const notify = (input: Omit<AppNotification, "id" | "createdAt" | "read">) => {
        const notification: AppNotification = {
          ...input,
          id: `N-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: new Date().toISOString(),
          read: false,
        };
        set((s) => ({ notifications: [notification, ...s.notifications].slice(0, 250) }));
      };

      const makeRevision = (comments: string, hours = 48): Revision => {
        const requested = new Date();
        return {
          status: "requested",
          requestedAt: requested.toISOString(),
          dueAt: new Date(requested.getTime() + hours * 60 * 60 * 1000).toISOString(),
          requestedBy: actor(),
          comments: comments.trim(),
          extendedAt: null,
          extendedBy: null,
          submittedAt: null,
        };
      };

      return {
        role: null,
        actingReviewer: "",
        view: "dashboard",
        returnView: "protocols",
        selectedId: null,
        filter: "all",
        query: "",
        navOpen: false,
        protocols: [],
        safety: [],
        members: [],
        notifications: [],
        profilePhotos: {},
        modal: null,
        toasts: [],
        celebrate: 0,
        login: (role) => {
          const reviewer = get().members.find((m) => m.active && isReviewerSeat(m.seat))?.name ?? "";
          set({
            role,
            view: "dashboard",
            selectedId: null,
            filter: "all",
            query: "",
            modal: null,
            navOpen: false,
            actingReviewer: role === "reviewer" ? reviewer : get().actingReviewer,
          });
          push(`Signed in as ${ROLES[role].title}`);
        },
        logout: () => set({ role: null, modal: null, navOpen: false, view: "dashboard" }),
        go: (view) => set({ view, navOpen: false }),
        openProtocol: (id) => {
          const view = get().view;
          const role = get().role;
          set((s) => ({
            selectedId: id,
            view: "detail",
            returnView: view === "detail" ? s.returnView : view,
            navOpen: false,
            notifications: s.notifications.map((n) =>
              n.protocolId === id &&
              (n.recipientRole === "all" || n.recipientRole === role || role === "admin")
                ? { ...n, read: true }
                : n,
            ),
          }));
        },
        setFilter: (filter) => set({ filter }),
        setQuery: (query) => set({ query }),
        setNav: (navOpen) => set({ navOpen }),
        setActing: (actingReviewer) => set({ actingReviewer }),
        openModal: (modal) => set({ modal }),
        closeModal: () => set({ modal: null }),
        dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
        submitProtocol: (input) => {
          const form = input.form;
          const scan = input.scan;
          const title = form.studyTitle.trim();
          if (!title || !form.piName.trim() || !form.piEmail.trim() || !form.college) {
            push("Complete the protocol, investigator and institution fields before submitting.", "warn");
            return;
          }
          if (!scan || scan.completeness < 95) {
            push("The complete proposal must pass the 28-section check at 95% or above.", "warn");
            return;
          }
          if (!form.acknowledge || !form.declarationAccepted) {
            push("Confirm the data sharing terms and the PI declaration before submitting.", "warn");
            return;
          }
          const college = form.college === "Other:" ? form.collegeOther.trim() : form.college;
          const design = form.studyDesign === "Other:" ? form.studyDesignOther.trim() : form.studyDesign;
          const focus = form.healthFocus === "Other:" ? form.healthFocusOther.trim() : form.healthFocus;
          const funding = form.funding === "Other:" ? form.fundingOther.trim() : form.funding;
          const target = form.targetGroup === "Other:" ? form.targetGroupOther.trim() : form.targetGroup;
          const id = form.code.trim() || nextProtocolId(get().protocols);
          const acceptedAt = new Date().toISOString();
          const titleSimilarity = assessTitleSimilarity(
            title,
            get().protocols.map((p) => ({ id: p.id, title: p.title })),
          );
          const declaration = {
            accepted: true,
            acceptedAt,
            piName: form.piName.trim(),
            text: DECLARATION_TEXT,
          };
          const uploaded = (code: string) =>
            code === "DOC_SUPPORT"
              ? Boolean(form.files.supportingLetter)
              : code === "DOC_PI_ID"
                ? Boolean(form.files.piId)
                : code === "DOC_PROTOCOL"
                  ? Boolean(scan)
                  : code === "DOC_CV"
                    ? Boolean(form.files.cv)
                    : false;
          const submittedAt = new Date().toISOString();
          const documentVersions: DocumentVersion[] = (Object.keys(DOC_CODE_BY_FILE) as SubmissionFileKey[])
            .flatMap((fileKey) => {
              const file = form.files[fileKey];
              if (!file) return [];
              return [{
                code: DOC_CODE_BY_FILE[fileKey],
                version: 1,
                name: file.name,
                size: file.size,
                uploadedAt: submittedAt,
                uploadedBy: form.piName.trim(),
                note: "Initial submission",
              }];
            });
          const protocol: Protocol = {
            id,
            title,
            type: design,
            focus,
            category: FOCUS_TO_CATEGORY[focus] ?? "Public Health & Health Systems",
            pi: get().role === "investigator" ? ROLES.investigator.name : form.piName.trim(),
            institution: college,
            sponsor: funding || "—",
            site: form.specificSite.trim() || "—",
            submitted: TODAY,
            status: "submitted",
            reviewType: null,
            decision: null,
            decisionNote: "",
            votes: null,
            reviewers: [],
            reviews: [],
            docs: DOC_DEFS.map((doc) => ({
              ...doc,
              state: uploaded(doc.code) ? "uploaded" : "missing",
            })),
            history: [
              h(
                TODAY,
                actor(),
                "Protocol submitted",
                `Proposal scanned at ${scan.completeness}% (${scan.fileName}); PI declaration accepted ${acceptedAt}; title similarity ${Math.round(titleSimilarity.score * 100)}% against ${titleSimilarity.corpusSize} existing title(s)`,
              ),
            ],
            summary: form.generalObjective.trim(),
            consentLanguages: "—",
            vulnerable: target || "—",
            continuingDue: null,
            letter: null,
            amendment: null,
            assignedOn: null,
            submission: form,
            declaration,
            scan,
            revision: null,
            documentVersions,
            documentComments: [],
            titleSimilarity,
            initialProtocolLockedAt: null,
            submissionUpdateUntil: new Date(new Date(submittedAt).getTime() + 48 * 60 * 60 * 1000).toISOString(),
            submissionUpdatedAt: null,
            finalProtocol: null,
          };
          set((s) => ({
            protocols: [protocol, ...s.protocols],
            modal: null,
            selectedId: id,
            view: "detail",
            returnView: "protocols",
          }));
          notify({
            protocolId: id,
            recipientRole: "secretariat",
            type: "submission",
            priority: "high",
            title: "New protocol submitted",
            body: `${id} — ${title}. Screening is required.`,
          });
          notify({
            protocolId: id,
            recipientRole: "investigator",
            type: "submission",
            priority: "normal",
            title: "Submission received",
            body: `${id} has been received and is awaiting secretariat screening.`,
          });
          push("Protocol submitted — awaiting secretariat screening");
        },
        updateSubmission: (id, input) => {
          const p = get().protocols.find((x) => x.id === id);
          if (!p) return;
          if (get().role !== "investigator") {
            push("Only the Principal Investigator can update this submission.", "warn");
            return;
          }
          if (!isSubmissionUpdateOpen(p)) {
            push("The 48-hour submission update window has closed or the application has been forwarded.", "warn");
            return;
          }
          const title = input.form.studyTitle.trim();
          if (!title || !input.form.piName.trim() || !input.form.college) {
            push("Complete the required submission fields before saving.", "warn");
            return;
          }
          if (!input.scan || input.scan.completeness < 95) {
            push("The proposal must still pass the 28-section check at 95% or above.", "warn");
            return;
          }
          const college = input.form.college === "Other:" ? input.form.collegeOther.trim() : input.form.college;
          const design = input.form.studyDesign === "Other:" ? input.form.studyDesignOther.trim() : input.form.studyDesign;
          const focus = input.form.healthFocus === "Other:" ? input.form.healthFocusOther.trim() : input.form.healthFocus;
          const funding = input.form.funding === "Other:" ? input.form.fundingOther.trim() : input.form.funding;
          const target = input.form.targetGroup === "Other:" ? input.form.targetGroupOther.trim() : input.form.targetGroup;
          const updatedAt = new Date().toISOString();
          const versions = input.versions;
          const titleSimilarity = assessTitleSimilarity(
            title,
            get().protocols.filter((p) => p.id !== id).map((p) => ({ id: p.id, title: p.title })),
          );
          if (p.initialProtocolLockedAt && versions.some((version) => version.code === "DOC_PROTOCOL")) {
            push("The initial protocol is locked after forwarding. Use the revised/final protocol PDF workflow.", "warn");
            return;
          }
          const underReview = p.status === "assigned" || p.status === "reviewing";
          const replacedCodes = new Set(versions.map((version) => version.code));
          patch(id, (row) =>
            note(
              {
                ...row,
                title,
                type: design,
                focus,
                category: FOCUS_TO_CATEGORY[focus] ?? "Public Health & Health Systems",
                institution: college,
                sponsor: funding || "—",
                site: input.form.specificSite.trim() || "—",
                summary: input.form.generalObjective.trim(),
                vulnerable: target || "—",
                submission: input.form,
                scan: input.scan,
                documentVersions: [...(row.documentVersions ?? []), ...versions],
                titleSimilarity,
                docs: row.docs.map((doc) =>
                  replacedCodes.has(doc.code) ? { ...doc, state: "uploaded" } : doc,
                ),
                status: underReview ? "reviewing" : row.status === "correction" ? "submitted" : row.status,
                reviews: underReview ? [] : row.reviews,
                assignedOn: underReview ? TODAY : row.assignedOn,
                submissionUpdatedAt: updatedAt,
              },
              "Submission updated",
              versions.length
                ? `${versions.length} document version(s) replaced · submission ${id}`
                : `Submission answers updated · title similarity ${Math.round(titleSimilarity.score * 100)}%`,
            ),
          );
          notify({
            protocolId: id,
            recipientRole: "secretariat",
            type: "submission",
            priority: "high",
            title: "Submission updated by the PI",
            body: `${id}: the PI updated the submission answers or documents during the 48-hour window. Please re-check the file.`,
          });
          if (underReview) {
            notify({
              protocolId: id,
              recipientRole: "reviewer",
              type: "review",
              priority: "high",
              title: "Submission changed during review",
              body: `${id}: the PI updated the submission during the 48-hour window. Please reassess the current version.`,
            });
          }
          set({ modal: null });
          push("Submission updated");
        },
        addDocumentComment: (id, input) => {
          const p = get().protocols.find((x) => x.id === id);
          if (!p) return;
          const role = get().role;
          if (role !== "reviewer") {
            push("Document comments are added by assigned reviewers. The Secretariat and Chair have view-only access.", "warn");
            return;
          }
          if (!p.reviewers.includes(get().actingReviewer)) {
            push("You can comment only on protocols assigned to you.", "warn");
            return;
          }
          const text = input.text.trim();
          if (!text) {
            push("Write the review comment first.", "warn");
            return;
          }
          const comment: DocumentComment = {
            id: `C-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
            protocolId: id,
            code: input.code,
            version: input.version,
            author: actor(),
            authorRole: role,
            text,
            quote: input.quote.trim().slice(0, 500),
            createdAt: new Date().toISOString(),
            resolved: false,
          };
          patch(id, (row) =>
            note(
              { ...row, documentComments: [...(row.documentComments ?? []), comment] },
              "Document review comment added",
              `${input.code} v${input.version}`,
            ),
          );
          notify({
            protocolId: id,
            recipientRole: "investigator",
            type: "review",
            priority: "normal",
            title: "New reviewer comment on a document",
            body: `${id}: a comment was added to ${input.code} version ${input.version}. Open the document review workspace to read it.`,
          });
          push("Document comment added");
        },
        toggleDocumentComment: (id, commentId) => {
          if (get().role !== "reviewer") {
            push("Only assigned reviewers can resolve or reopen comments.", "warn");
            return;
          }
          const protocol = get().protocols.find((p) => p.id === id);
          if (!protocol?.reviewers.includes(get().actingReviewer)) {
            push("You can resolve comments only on protocols assigned to you.", "warn");
            return;
          }
          patch(id, (row) => {
            const target = (row.documentComments ?? []).find((comment) => comment.id === commentId);
            if (!target) return row;
            return note(
              {
                ...row,
                documentComments: (row.documentComments ?? []).map((comment) =>
                  comment.id === commentId ? { ...comment, resolved: !comment.resolved } : comment,
                ),
              },
              target.resolved ? "Document comment reopened" : "Document comment resolved",
              `${target.code} v${target.version}`,
            );
          });
        },
        addMember: (input) => {
          const name = input.name.trim();
          if (!name || !input.category || !input.institution.trim()) {
            push("Member name, category and institution are required.", "warn");
            return;
          }
          if (input.email.trim() && !/^\S+@\S+\.\S+$/.test(input.email.trim())) {
            push("Enter a valid member email address.", "warn");
            return;
          }
          if (get().members.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
            push("A member or reviewer with that name already exists.", "warn");
            return;
          }
          const member: Member = {
            ...input,
            id: `M-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            name,
            category: input.category,
            seat: input.seat,
            institution: input.institution.trim(),
            email: input.email.trim(),
            phone: input.phone.trim(),
            active: input.active,
            lay: input.seat === "Lay member",
          };
          set((s) => ({ members: [...s.members, member] }));
          push(`${member.seat === "Lay member" ? "Lay member" : "Member"} registered`);
        },
        updateMember: (id, input) => {
          const current = get().members.find((m) => m.id === id);
          if (!current) return;
          const name = input.name.trim();
          if (!name || !input.category || !input.institution.trim()) {
            push("Member name, category and institution are required.", "warn");
            return;
          }
          if (input.email.trim() && !/^\S+@\S+\.\S+$/.test(input.email.trim())) {
            push("Enter a valid member email address.", "warn");
            return;
          }
          if (get().members.some((m) => m.id !== id && m.name.toLowerCase() === name.toLowerCase())) {
            push("A member or reviewer with that name already exists.", "warn");
            return;
          }
          set((s) => ({
            members: s.members.map((m) =>
              m.id === id
                ? {
                    ...m,
                    ...input,
                    name,
                    category: input.category,
                    seat: input.seat,
                    institution: input.institution.trim(),
                    email: input.email.trim(),
                    phone: input.phone.trim(),
                    active: input.active,
                    lay: input.seat === "Lay member",
                  }
                : m,
            ),
            protocols: s.protocols.map((p) => ({
              ...p,
              reviewers: p.reviewers.map((reviewer) => (reviewer === current.name ? name : reviewer)),
              reviews: p.reviews.map((review) =>
                review.reviewer === current.name ? { ...review, reviewer: name } : review,
              ),
            })),
            actingReviewer: s.actingReviewer === current.name ? name : s.actingReviewer,
          }));
          push("Member record updated");
        },
        removeMember: (id) => {
          const member = get().members.find((m) => m.id === id);
          if (!member) return;
          if (get().protocols.some((p) => p.reviewers.includes(member.name))) {
            push("This member has assigned reviews. Mark them inactive instead of deleting the record.", "warn");
            return;
          }
          set((s) => ({ members: s.members.filter((m) => m.id !== id) }));
          push("Member removed");
        },
        markNotificationRead: (id) =>
          set((s) => ({
            notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
          })),
        markAllNotificationsRead: () =>
          set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
        setProfilePhoto: (roleKey, dataUrl) =>
          set((s) => {
            const profilePhotos = { ...s.profilePhotos };
            if (dataUrl) profilePhotos[roleKey] = dataUrl;
            else delete profilePhotos[roleKey];
            return { profilePhotos };
          }),
        requestRevision: (id, comments) => {
          const text = comments.trim();
          if (!text) {
            push("Describe the revisions the PI must make.", "warn");
            return;
          }
          const p = get().protocols.find((x) => x.id === id);
          if (!p) return;
          if (get().role !== "secretariat" && get().role !== "chair") {
            push("Only the Secretariat or Chairperson can request revisions.", "warn");
            return;
          }
          const revision = { ...makeRevision(text), reviews: p.reviews };
          patch(id, (row) =>
            note(
              {
                ...row,
                status: "revision",
                revision,
                finalProtocol: row.finalProtocol
                  ? { ...row.finalProtocol, status: "rejected", updatedAt: new Date().toISOString() }
                  : row.finalProtocol ?? null,
              },
              "Revision requested",
              `48-hour window · due ${new Date(revision.dueAt).toLocaleString()}`,
            ),
          );
          notify({
            protocolId: id,
            recipientRole: "investigator",
            type: "revision",
            priority: "high",
            title: "Document revision required",
            body: `${id}: ${text} Deadline: ${new Date(revision.dueAt).toLocaleString()} (48-hour window).`,
          });
          notify({
            protocolId: id,
            recipientRole: "reviewer",
            type: "revision",
            priority: "normal",
            title: "Revision requested",
            body: `${id} is with the PI for revision. You will be notified when the revised package is ready.`,
          });
          set({ modal: null });
          push("Revision requested — the 48-hour PI window is open");
        },
        extendRevision: (id, hours = 48) => {
          if (get().role !== "admin") {
            push("Only the System Administrator can extend a revision window.", "warn");
            return;
          }
          const p = get().protocols.find((x) => x.id === id);
          if (!p?.revision) return;
          const base = Math.max(Date.now(), new Date(p.revision.dueAt).getTime());
          const dueAt = new Date(base + hours * 60 * 60 * 1000).toISOString();
          patch(id, (row) =>
            note(
              {
                ...row,
                status: "revision",
                revision: row.revision
                  ? {
                      ...row.revision,
                      status: "requested",
                      dueAt,
                      extendedAt: new Date().toISOString(),
                      extendedBy: actor(),
                    }
                  : row.revision ?? null,
              },
              "Revision window extended",
              `${hours} added hours · due ${new Date(dueAt).toLocaleString()} by ${actor()}`,
            ),
          );
          notify({
            protocolId: id,
            recipientRole: "investigator",
            type: "revision",
            priority: "high",
            title: "Revision window extended",
            body: `${id}: the System Administrator added ${hours} hours. New deadline ${new Date(dueAt).toLocaleString()}.`,
          });
          push("Revision window extended");
        },
        recordDocumentRevision: (id, version) => {
          if (version.code === "DOC_PROTOCOL" || version.code === FINAL_PROTOCOL_CODE) {
            push("The initial protocol is locked. Upload a revised protocol in the Final Protocol workflow.", "warn");
            return;
          }
          if (get().role !== "investigator") {
            push("Only the Principal Investigator can upload revised documents.", "warn");
            return;
          }
          const p = get().protocols.find((x) => x.id === id);
          if (!p) return;
          if (!isRevisionOpen(p)) {
            push("The revision window is closed. Ask the System Administrator for an extension.", "warn");
            return;
          }
          patch(id, (row) =>
            note(
              {
                ...row,
                documentVersions: [...(row.documentVersions ?? []), version],
                docs: row.docs.map((d) => (d.code === version.code ? { ...d, state: "uploaded" } : d)),
              },
              "Revised document uploaded",
              `${version.code} v${version.version} · ${version.name}`,
            ),
          );
          notify({
            protocolId: id,
            recipientRole: "reviewer",
            type: "document",
            priority: "normal",
            title: "Revised document uploaded",
            body: `${id}: ${version.code} version ${version.version} was uploaded by the PI.`,
          });
          push("Revised document uploaded");
        },
        uploadFinalProtocol: (id, version) => {
          if (get().role !== "investigator") {
            push("Only the Principal Investigator can upload the final protocol.", "warn");
            return;
          }
          const p = get().protocols.find((x) => x.id === id);
          if (!p) return;
          if (!p.revision && !p.finalProtocol) {
            push("A reviewer revision request must be issued before a final protocol can be uploaded.", "warn");
            return;
          }
          if (!/\.pdf$/i.test(version.name) || (version.type && version.type !== "application/pdf")) {
            push("The revised/final research protocol must be a PDF file.", "warn");
            return;
          }
          patch(id, (row) => {
            const current = row.finalProtocol ?? {
              status: "draft" as const,
              versions: [],
              submittedAt: null,
              updatedAt: null,
            };
            return note(
              {
                ...row,
                finalProtocol: {
                  ...current,
                  status: "draft",
                  versions: [...current.versions, version],
                  updatedAt: new Date().toISOString(),
                },
              },
              "Revised protocol PDF uploaded",
              `v${version.version} · ${version.name}`,
            );
          });
          notify({
            protocolId: id,
            recipientRole: "reviewer",
            type: "document",
            priority: "normal",
            title: "Revised protocol uploaded",
            body: `${id}: version ${version.version} of the final protocol was uploaded as PDF.`,
          });
          push("Revised protocol PDF uploaded");
        },
        submitFinalProtocol: (id) => {
          if (get().role !== "investigator") {
            push("Only the Principal Investigator can submit the final protocol.", "warn");
            return;
          }
          const p = get().protocols.find((x) => x.id === id);
          if (!p?.finalProtocol?.versions.length) {
            push("Upload at least one PDF version of the revised protocol first.", "warn");
            return;
          }
          const now = new Date().toISOString();
          patch(id, (row) =>
            note(
              {
                ...row,
                status: "reviewing",
                reviews: [],
                assignedOn: TODAY,
                finalProtocol: row.finalProtocol
                  ? { ...row.finalProtocol, status: "submitted", submittedAt: now, updatedAt: now }
                  : row.finalProtocol ?? null,
                revision: row.revision
                  ? { ...row.revision, status: "submitted", submittedAt: now }
                  : row.revision ?? null,
              },
              "Revised protocol submitted for review",
              `Final protocol v${row.finalProtocol?.versions.length ?? 0} · application ${id}`,
            ),
          );
          notify({
            protocolId: id,
            recipientRole: "reviewer",
            type: "revision",
            priority: "high",
            title: "Revised protocol ready for review",
            body: `${id}: the PI submitted the revised/final protocol as PDF. Please reassess.`,
          });
          notify({
            protocolId: id,
            recipientRole: "secretariat",
            type: "revision",
            priority: "normal",
            title: "Revised protocol submitted",
            body: `${id}: the final protocol PDF is available for the review workflow.`,
          });
          push("Revised protocol submitted to reviewers");
        },
        submitRevision: (id) => {
          if (get().role !== "investigator") {
            push("Only the Principal Investigator can submit a revised package.", "warn");
            return;
          }
          const p = get().protocols.find((x) => x.id === id);
          if (!p?.revision) return;
          if (!isRevisionOpen(p)) {
            push("The revision window is closed. Ask the System Administrator for an extension.", "warn");
            return;
          }
          const revised = (p.documentVersions ?? []).some((v) => v.version > 1);
          if (!revised) {
            push("Upload at least one revised document before submitting the revision.", "warn");
            return;
          }
          patch(id, (row) =>
            note(
              {
                ...row,
                status: "reviewing",
                reviews: [],
                assignedOn: TODAY,
                revision: {
                  ...row.revision!,
                  status: "submitted",
                  submittedAt: new Date().toISOString(),
                  reviews: row.reviews,
                },
              },
              "Revised package submitted for reassessment",
              "Reviewers must assess the revised documents",
            ),
          );
          notify({
            protocolId: id,
            recipientRole: "reviewer",
            type: "revision",
            priority: "high",
            title: "Revised package ready for reassessment",
            body: `${id}: the PI has submitted revised documents. Please reassess.`,
          });
          notify({
            protocolId: id,
            recipientRole: "secretariat",
            type: "revision",
            priority: "normal",
            title: "Revision submitted",
            body: `${id}: revised documents are back with the reviewers.`,
          });
          push("Revision submitted — reviewers will reassess");
        },
        checkRevisionWindows: () => {
          const expired = get().protocols.filter(
            (p) =>
              p.revision?.status === "requested" &&
              new Date(p.revision.dueAt).getTime() <= Date.now(),
          );
          for (const p of expired) {
            patch(p.id, (row) =>
              note(
                {
                  ...row,
                  revision: row.revision ? { ...row.revision, status: "expired" } : row.revision ?? null,
                },
                "Revision window expired",
                "Document editing and uploading are now restricted until an administrator extends access",
              ),
            );
            notify({
              protocolId: p.id,
              recipientRole: "investigator",
              type: "revision",
              priority: "high",
              title: "Revision window expired",
              body: `${p.id}: the 48-hour revision window has closed. Contact the System Administrator if you need more time.`,
            });
            notify({
              protocolId: p.id,
              recipientRole: "admin",
              type: "revision",
              priority: "high",
              title: "Revision window expired",
              body: `${p.id}: the PI's revision window has closed. Extend access if required.`,
            });
          }
        },
        startScreening: (id) => {
          patch(id, (p) => {
            if (p.status !== "submitted") return p;
            return note({ ...p, status: "screening" }, "Administrative check started");
          });
          push("Administrative check started");
        },
        setDoc: (id, code, state) => {
          patch(id, (p) => ({
            ...p,
            docs: p.docs.map((d) => (d.code === code ? { ...d, state } : d)),
          }));
        },
        passScreening: (id) => {
          const p = get().protocols.find((x) => x.id === id);
          if (!p) return;
          if (!requiredDocsOk(p)) {
            push("Verify every required document before completing screening", "warn");
            return;
          }
          patch(id, (row) => note({ ...row, status: "complete" }, "Completeness verified", "All required documents verified"));
          notify({
            protocolId: id,
            recipientRole: "investigator",
            type: "submission",
            priority: "normal",
            title: "Screening complete",
            body: `${id}: the secretariat has verified the submission package.`,
          });
          push("Submission marked complete");
        },
        returnForCorrection: (id, noteText) => {
          const text = noteText.trim();
          if (!text) {
            push("Say what must be corrected", "warn");
            return;
          }
          patch(id, (p) => note({ ...p, status: "correction" }, "Returned for correction", text));
          notify({
            protocolId: id,
            recipientRole: "investigator",
            type: "review",
            priority: "high",
            title: "Correction required",
            body: `${id}: ${text}`,
          });
          set({ modal: null });
          push("Returned to the investigator");
        },
        resubmit: (id) => {
          patch(id, (p) =>
            note(
              {
                ...p,
                status: "screening",
                docs: p.docs.map((d) => (d.state === "correction" ? { ...d, state: "uploaded" } : d)),
              },
              "Corrected package resubmitted",
            ),
          );
          push("Resubmitted for screening");
          notify({
            protocolId: id,
            recipientRole: "secretariat",
            type: "submission",
            priority: "normal",
            title: "Corrected package resubmitted",
            body: `${id} is ready for screening again.`,
          });
        },
        classify: (id, reviewType) => {
          patch(id, (p) => {
            const status: Status = p.status === "complete" || p.status === "classified" ? "classified" : p.status;
            return note({ ...p, reviewType, status }, "Review type classified", reviewType);
          });
          set({ modal: null });
          notify({
            protocolId: id,
            recipientRole: "investigator",
            type: "review",
            priority: "normal",
            title: "Review type set",
            body: `${id}: ${reviewType}.`,
          });
          push(`Classified as ${reviewType}`);
        },
        assignReviewers: (id, names) => {
          const p = get().protocols.find((x) => x.id === id);
          if (!p) return;
          const min = p.reviewType === "Full Board Review" ? 2 : 1;
          if (names.length < min) {
            push(
              p.reviewType === "Full Board Review"
                ? "Full board review needs at least two reviewers, including a lay member when possible"
                : "Select at least one reviewer",
              "warn",
            );
            return;
          }
          const lay = names.some((n) => get().members.find((m) => m.name === n)?.seat === "Lay member");
          patch(id, (row) =>
            note(
              { ...row, reviewers: names, status: "assigned", assignedOn: TODAY, reviews: [], initialProtocolLockedAt: row.initialProtocolLockedAt ?? new Date().toISOString() },
              "Reviewers assigned",
              names.join(", "),
            ),
          );
          set({ modal: null });
          notify({
            protocolId: id,
            recipientRole: "reviewer",
            type: "review",
            priority: "high",
            title: "New review assignment",
            body: `${id} has been assigned to you. Review the protocol and submit the assessment.`,
          });
          push(lay ? "Reviewers assigned" : "Assigned — consider adding a lay member", lay ? "ok" : "warn");
        },
        placeOnAgenda: (id) => {
          patch(id, (p) =>
            note(
              {
                ...p,
                status: "agenda",
                initialProtocolLockedAt: p.initialProtocolLockedAt ?? new Date().toISOString(),
              },
              "Placed on committee agenda",
              "Next committee meeting",
            ),
          );
          notify({
            protocolId: id,
            recipientRole: "chair",
            type: "review",
            priority: "normal",
            title: "Protocol placed on agenda",
            body: `${id} is ready for the committee meeting.`,
          });
          push("Added to the next committee meeting");
        },
        saveAssessment: (id, recommendation, comments, conflict, failed) => {
          if (!conflict) {
            push("Declare that you have no unmanaged conflict before submitting", "warn");
            return;
          }
          if (failed.length && !comments.trim()) {
            push("Comment on every criterion marked not appropriate", "warn");
            return;
          }
          const who = get().actingReviewer;
          if (!who) {
            push("The Secretary must register a reviewer before an assessment can be recorded.", "warn");
            return;
          }
          let advanced = false;
          patch(id, (p) => {
            if (!myReviewPending(p, who)) return p;
            const reviews = [
              ...p.reviews,
              { reviewer: who, date: TODAY, recommendation, comments: comments.trim(), conflict: false },
            ];
            let status: Status = p.status === "assigned" ? "reviewing" : p.status;
            let history: HistoryItem[] = [...p.history, h(TODAY, who, "Assessment submitted", recommendation)];
            if (p.reviewers.length > 0 && reviews.length >= p.reviewers.length) {
              status = "reviews_complete";
              advanced = true;
              history = [
                ...history,
                h(TODAY, "System", "All assigned assessments received", "Ready for the committee agenda. The system does not decide."),
              ];
            }
            return { ...p, reviews, status, history };
          });
          set({ modal: null });
          if (advanced) {
            notify({
              protocolId: id,
              recipientRole: "secretariat",
              type: "review",
              priority: "high",
              title: "All assessments received",
              body: `${id} is ready for the committee agenda or a revision request.`,
            });
            notify({
              protocolId: id,
              recipientRole: "chair",
              type: "review",
              priority: "high",
              title: "All assessments received",
              body: `${id} is ready for the committee decision.`,
            });
            notify({
              protocolId: id,
              recipientRole: "investigator",
              type: "review",
              priority: "normal",
              title: "Review completed",
              body: `${id}: all assigned assessments have been received.`,
            });
          }
          push(advanced ? "Assessment submitted — file is ready for agenda" : "Assessment submitted");
        },
        saveDecision: (id, decision, noteText, votes) => {
          const total = votes.for + votes.against + votes.abstain;
          if (total < 4) {
            push("Quorum is not met — at least half the committee must vote", "warn");
            return;
          }
          if (!decision) {
            push("Choose a decision", "warn");
            return;
          }
          patch(id, (p) =>
            note(
              { ...p, decision, decisionNote: noteText.trim(), votes, status: "decided", initialProtocolLockedAt: p.initialProtocolLockedAt ?? new Date().toISOString() },
              "Committee decision recorded",
              `${decision} · ${votes.for} for, ${votes.against} against, ${votes.abstain} abstained`,
            ),
          );
          const approved = decision.startsWith("Approved");
          set((s) => ({ modal: null, celebrate: approved ? s.celebrate + 1 : s.celebrate }));
          notify({
            protocolId: id,
            recipientRole: "investigator",
            type: "decision",
            priority: "high",
            title: "Committee decision recorded",
            body: `${id}: ${decision}. The secretariat will issue the letter.`,
          });
          notify({
            protocolId: id,
            recipientRole: "secretariat",
            type: "decision",
            priority: "normal",
            title: "Decision ready for letter",
            body: `${id}: ${decision}. Issue the action or clearance letter.`,
          });
          push("Decision recorded — secretariat must issue the action letter");
        },
        sendLetter: (id, message, continuingDue) => {
          const p = get().protocols.find((x) => x.id === id);
          if (!p?.decision) return;
          const text = message.trim();
          if (!text) {
            push("The action letter needs a message", "warn");
            return;
          }
          let status: Status = "archived";
          let due: string | null = null;
          let action = "Action letter issued";
          let revision: Revision | null = null;
          if (p.decision === "Approved" || p.decision === "Approved with Conditions") {
            status = "active";
            due = continuingDue || addDays(TODAY, 365);
            action = "Action letter issued — clearance active";
          } else if (p.decision === "Modifications Required" || p.decision === "Deferred") {
            status = "revision";
            revision = { ...makeRevision(text), reviews: p.reviews };
            action = "Action letter issued — 48-hour revision window opened";
          }
          patch(id, (row) =>
            note(
              {
                ...row,
                status,
                continuingDue: due,
                letter: text,
                revision: revision ?? row.revision ?? null,
                finalProtocol: row.finalProtocol
                  ? {
                      ...row.finalProtocol,
                      status: status === "active" ? "accepted" : status === "revision" ? "rejected" : row.finalProtocol.status,
                      updatedAt: new Date().toISOString(),
                    }
                  : row.finalProtocol ?? null,
              },
              action,
              due ? `Continuing review ${due}` : row.decision || "",
            ),
          );
          const celebrate = status === "active";
          set((s) => ({ modal: null, celebrate: celebrate ? s.celebrate + 1 : s.celebrate }));
          notify({
            protocolId: id,
            recipientRole: "investigator",
            type: "decision",
            priority: "high",
            title: status === "active" ? "Clearance letter issued" : "Action letter issued",
            body:
              status === "active"
                ? `${id}: the clearance letter has been issued. ${
                    p.decision === "Approved with Conditions" ? "Review the conditions before starting." : ""
                  }`
                : `${id}: the action letter has been issued. ${
                    p.decision === "Modifications Required" || p.decision === "Deferred"
                      ? `A 48-hour revision window is open until ${new Date(revision?.dueAt ?? "").toLocaleString()}.`
                      : ""
                  }`,
          });
          push(status === "active" ? "Clearance letter sent" : "Action letter sent");
        },
        reviewSafety: (id, action, noteText) => {
          set((s) => ({
            safety: s.safety.map((r) =>
              r.id === id ? { ...r, status: `Reviewed — ${action}`, note: noteText.trim() } : r,
            ),
            modal: null,
          }));
          const report = get().safety.find((r) => r.id === id);
          if (report) {
            patch(report.protocolId, (p) =>
              note(p, "Safety report reviewed", `${report.id}: ${action}`),
            );
          }
          push("Safety action recorded");
        },
        fileSae: (protocolId, event, relatedness, seriousness) => {
          if (!event.trim()) {
            push("Describe the event", "warn");
            return;
          }
          const n = get().safety.length + 1;
          const id = `SAE-${String(n).padStart(3, "0")}`;
          const report: SafetyReport = {
            id,
            protocolId,
            event: event.trim(),
            date: TODAY,
            relatedness,
            seriousness,
            status: "Pending review",
            note: "",
          };
          set((s) => ({ safety: [report, ...s.safety], modal: null }));
          patch(protocolId, (p) => note(p, "Safety report filed", `${id}: ${event.trim()}`));
          notify({
            protocolId,
            recipientRole: "secretariat",
            type: "safety",
            priority: "high",
            title: "New safety report",
            body: `${id}: ${event.trim()} (${relatedness}, ${seriousness}).`,
          });
          notify({
            protocolId,
            recipientRole: "chair",
            type: "safety",
            priority: "high",
            title: "New safety report",
            body: `${id}: ${event.trim()} requires committee review.`,
          });
          push("Safety report filed for committee review");
        },
        fileAmendment: (id, summary) => {
          if (!summary.trim()) {
            push("Describe the amendment", "warn");
            return;
          }
          patch(id, (p) =>
            note(
              { ...p, amendment: { summary: summary.trim(), date: TODAY, status: "Pending review" } },
              "Amendment submitted",
              "Not to be implemented before approval",
            ),
          );
          set({ modal: null });
          notify({
            protocolId: id,
            recipientRole: "chair",
            type: "review",
            priority: "normal",
            title: "Amendment submitted",
            body: `${id}: ${summary.trim()} — pending committee review.`,
          });
          push("Amendment submitted to the secretariat");
        },
        decideAmendment: (id, approved) => {
          patch(id, (p) => {
            if (!p.amendment) return p;
            return note(
              {
                ...p,
                amendment: { ...p.amendment, status: approved ? "Approved" : "Not approved" },
              },
              approved ? "Amendment approved" : "Amendment not approved",
              p.amendment.summary,
            );
          });
          if (approved) set((s) => ({ celebrate: s.celebrate + 1 }));
          push(approved ? "Amendment approved" : "Amendment not approved");
        },
        fileContinuing: (id, summary) => {
          if (!summary.trim()) {
            push("Summarise progress since the last review", "warn");
            return;
          }
          patch(id, (p) =>
            note(
              { ...p, continuingDue: addDays(TODAY, 365) },
              "Continuing review report submitted",
              summary.trim(),
            ),
          );
          set({ modal: null });
          push("Continuing review filed — next due in one year");
        },
        archiveProtocol: (id) => {
          patch(id, (p) => note({ ...p, status: "archived", continuingDue: null }, "Study archived", "Active file moved to the archive"));
          push("Protocol archived");
        },
      };
    },
    {
      name: "aaphreml-irerc-portal-v3",
      partialize: (s) => ({
        role: REMOTE ? null : s.role,
        actingReviewer: s.actingReviewer,
        // Research records must never be cached in the browser in server mode.
        protocols: REMOTE ? [] : s.protocols,
        safety: REMOTE ? [] : s.safety,
        members: REMOTE ? [] : s.members,
        notifications: REMOTE ? [] : s.notifications,
        profilePhotos: s.profilePhotos,
      }),
    },
  ),
);

export function useProtocol(id: string | null) {
  return useIrerc((s) => s.protocols.find((p) => p.id === id) ?? null);
}

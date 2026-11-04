/**
 * GAS (Google Apps Script) mode — replaces the old server-function based
 * remote store. All calls go to the Apps Script backend via fetch().
 */

import {
  gasRunAction,
  gasCreateDraft,
  gasUploadDocument,
  gasProtocols,
  gasMembers,
  gasSafetyReports,
  gasNotifications,
  gasMarkNotificationRead,
  gasMarkAllNotificationsRead,
  gasSubmitProtocol,
  gasUpdateSubmission,
  gasFileSae,
} from "@/lib/gas/api";
import type {
  DocumentVersion,
  MemberInput,
  OfficialSubmission,
  Protocol,
  ReviewType,
} from "@/lib/irerc/model";
import { useIrerc } from "./store";

export const REMOTE = true;

// ── Session bootstrap ──────────────────────────────────────────────────────

export async function bootstrapRemoteSession(): Promise<void> {
  installGasActions();
  await refreshProtocols();
}

export async function refreshProtocols(): Promise<void> {
  const [protoRes, memberRes, safetyRes, notifRes] = await Promise.all([
    gasProtocols(),
    gasMembers(),
    gasSafetyReports(),
    gasNotifications(),
  ]);

  useIrerc.setState({
    protocols: (protoRes.protocols as Protocol[]) ?? [],
    members: (memberRes.members as any[]) ?? [],
    safety: (safetyRes.reports as any[]) ?? [],
    notifications: (notifRes.notifications as any[]) ?? [],
  });
}

// ── Toast helper ────────────────────────────────────────────────────────────

let toastSeq = 1_000_000;
function toast(msg: string, kind: "ok" | "warn" = "ok") {
  if (!msg) return;
  const t = { id: ++toastSeq, msg, kind };
  useIrerc.setState((s) => ({ toasts: [...s.toasts, t] }));
  setTimeout(() => useIrerc.getState().dismissToast(t.id), 3600);
}

// ── File helpers ────────────────────────────────────────────────────────────

export async function fileToBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// ── GAS-backed actions ─────────────────────────────────────────────────────

type Opts = { keepModal?: boolean; silent?: boolean };

function gasAction<A extends unknown[]>(
  action: string,
  toInput: (...a: A) => Record<string, unknown>,
  opts: Opts = {},
) {
  return (...args: A): void => {
    void (async () => {
      try {
        const res = await gasRunAction(action, toInput(...args));
        if (res.ok) {
          await refreshProtocols();
          useIrerc.setState((s) => ({
            modal: opts.keepModal ? s.modal : null,
          }));
        }
        if (!opts.silent) toast(res.message ?? res.error ?? "Done", res.ok ? "ok" : "warn");
      } catch (cause) {
        toast(cause instanceof Error ? cause.message : "The action could not be completed.", "warn");
      }
    })();
  };
}

let installed = false;

export function installGasActions(): void {
  if (installed) return;
  installed = true;
  const orig = useIrerc.getState();
  const mark = (ids: string[]) => {
    for (const nid of ids) void gasMarkNotificationRead(nid);
  };

  useIrerc.setState({
    // Protocol workflow
    startScreening: gasAction("startScreening", (id: string) => ({ id })),
    setDoc: gasAction("setDoc", (id: string, code: string, state: string) => ({ id, code, state }), { keepModal: true, silent: true }),
    passScreening: gasAction("passScreening", (id: string) => ({ id })),
    returnForCorrection: gasAction("returnForCorrection", (id: string, note: string) => ({ id, note })),
    resubmit: gasAction("resubmit", (id: string) => ({ id })),
    classify: gasAction("classify", (id: string, reviewType: ReviewType) => ({ id, reviewType })),
    assignReviewers: gasAction("assignReviewers", (id: string, names: string[]) => ({ id, names })),
    placeOnAgenda: gasAction("placeOnAgenda", (id: string) => ({ id })),
    saveAssessment: gasAction(
      "saveAssessment",
      (id: string, recommendation: string, comments: string, _conflict: boolean, failed: string[]) => ({ id, recommendation, comments, conflict: true, failed }),
    ),
    saveDecision: gasAction(
      "saveDecision",
      (id: string, decision: string, note: string, votes: { for: number; against: number; abstain: number }) => ({ id, decision, note, votes }),
    ),
    sendLetter: gasAction("sendLetter", (id: string, message: string, continuingDue: string) => ({ id, message, continuingDue })),
    requestRevision: gasAction("requestRevision", (id: string, comments: string) => ({ id, comments })),
    extendRevision: gasAction("extendRevision", (id: string, hours?: number) => ({ id, hours: hours ?? 48 }), { keepModal: true }),
    recordDocumentRevision: gasAction("recordDocumentRevision", (id: string, v: DocumentVersion) => ({ id, code: v.code, version: v.version }), { keepModal: true }),
    uploadFinalProtocol: gasAction("uploadFinalProtocol", (id: string, _v: DocumentVersion) => ({ id }), { keepModal: true }),
    submitFinalProtocol: gasAction("submitFinalProtocol", (id: string) => ({ id })),
    submitRevision: gasAction("submitRevision", (id: string) => ({ id })),
    addDocumentComment: gasAction(
      "addDocumentComment",
      (id: string, i: { code: string; version: number; text: string; quote: string }) => ({ id, ...i }),
      { keepModal: true },
    ),
    toggleDocumentComment: gasAction("toggleDocumentComment", (id: string, commentId: string) => ({ id, commentId }), { keepModal: true, silent: true }),
    // After clearance
    fileSae: async (protocolId: string, event: string, relatedness: string, seriousness: string) => {
      try {
        await gasFileSae(protocolId, event, relatedness, seriousness);
        await refreshProtocols();
        toast("Safety report filed for committee review");
      } catch (cause) {
        toast(cause instanceof Error ? cause.message : "Could not file the report.", "warn");
      }
    },
    reviewSafety: gasAction("reviewSafety", (id: string, action: string, note: string) => ({ id, action, note })),
    fileAmendment: gasAction("fileAmendment", (id: string, summary: string) => ({ id, summary })),
    decideAmendment: gasAction("decideAmendment", (id: string, approved: boolean) => ({ id, approved }), { keepModal: true }),
    fileContinuing: gasAction("fileContinuing", (id: string, summary: string) => ({ id, summary })),
    archiveProtocol: gasAction("archiveProtocol", (id: string) => ({ id }), { keepModal: true }),
    // Roster
    addMember: async (m: MemberInput) => {
      try {
        await gasRunAction("addMember", { member: m });
        await refreshProtocols();
        toast("Member registered");
      } catch (cause) {
        toast(cause instanceof Error ? cause.message : "Could not add member.", "warn");
      }
    },
    updateMember: async (id: string, m: MemberInput) => {
      try {
        await gasRunAction("updateMember", { id, member: m });
        await refreshProtocols();
        toast("Member updated");
      } catch (cause) {
        toast(cause instanceof Error ? cause.message : "Could not update member.", "warn");
      }
    },
    removeMember: async (id: string) => {
      try {
        await gasRunAction("removeMember", { id });
        await refreshProtocols();
      } catch (cause) {
        toast(cause instanceof Error ? cause.message : "Could not remove member.", "warn");
      }
    },
    // Inbox + housekeeping
    checkRevisionWindows: () => void refreshProtocols().catch(() => undefined),
    markNotificationRead: (nid: string) => {
      orig.markNotificationRead(nid);
      mark([nid]);
    },
    markAllNotificationsRead: () => {
      orig.markAllNotificationsRead();
      void gasMarkAllNotificationsRead();
    },
    openProtocol: (pid: string) => {
      const unread = useIrerc.getState().notifications.filter((n) => n.protocolId === pid && !n.read).map((n) => n.id);
      orig.openProtocol(pid);
      mark(unread);
    },
  });
}

// ── Submit / update helpers ─────────────────────────────────────────────────

export async function uploadRemote(protocolId: string, code: string, file: File, note?: string) {
  return gasUploadDocument(protocolId, code, file.name, file.type, await fileToBase64(file), file.size, note);
}

export async function submitRemote(
  form: OfficialSubmission,
  files: Record<string, File | null | undefined>,
  codes: Record<string, string>,
  draftId?: string | null,
  onDraft?: (id: string) => void,
): Promise<Protocol> {
  const protocolId = draftId ?? (await gasCreateDraft()).protocolId;
  onDraft?.(protocolId);
  for (const key of Object.keys(files)) {
    const file = files[key];
    if (file) await uploadRemote(protocolId, codes[key]!, file);
  }
  const res = await gasSubmitProtocol(protocolId, form as unknown as Record<string, unknown>);
  if (!res.ok) throw new Error(res.error ?? "Submission failed");
  await refreshProtocols();
  const protocol = useIrerc.getState().protocols.find((p) => p.id === protocolId);
  if (!protocol) throw new Error("Protocol not found after submission");
  return protocol;
}

export async function updateRemote(
  protocolId: string,
  form: OfficialSubmission,
  files: Record<string, File | null | undefined>,
  codes: Record<string, string>,
): Promise<Protocol> {
  for (const key of Object.keys(files)) {
    const file = files[key];
    if (file) await uploadRemote(protocolId, codes[key]!, file, "Submission update");
  }
  const res = await gasUpdateSubmission(protocolId, form as unknown as Record<string, unknown>);
  if (!res.ok) throw new Error(res.error ?? "Update failed");
  await refreshProtocols();
  const protocol = useIrerc.getState().protocols.find((p) => p.id === protocolId);
  if (!protocol) throw new Error("Protocol not found after update");
  return protocol;
}

export function ingestProtocol(protocol: Protocol): void {
  useIrerc.setState((s) => ({
    protocols: [protocol, ...s.protocols.filter((p) => p.id !== protocol.id)],
  }));
}

export async function fetchRemoteDocument(
  _protocolId: string,
  _code: string,
  _version?: number,
): Promise<{ name: string; mime: string; blob: Blob }> {
  // Document download via GAS — will call gasDownloadDocument once the
  // backend endpoint is fully wired. For now it throws so the file-store
  // falls back gracefully.
  throw new Error("Document download will be available after the Apps Script backend is deployed.");
}

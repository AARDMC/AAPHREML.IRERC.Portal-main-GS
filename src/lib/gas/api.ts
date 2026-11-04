/**
 * Google Apps Script API client.
 *
 * Every call goes through this single fetch() to the Apps Script web app.
 * The backend reads the JSON body, dispatches on `action`, and returns JSON.
 *
 * Auth: the session token (from login) is sent in every request body.
 * The backend validates it against the IRERC Sessions sheet.
 */

import { BACKEND_URL, TOKEN_KEY, USER_KEY } from "./config";

export type GasUser = {
  email: string;
  name: string;
  role: string;
};

export type GasResponse<T = Record<string, unknown>> = T & {
  ok: boolean;
  error?: string;
};

/** Read the stored session token. */
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Read the stored user info. */
export function getStoredUser(): GasUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as GasUser) : null;
  } catch {
    return null;
  }
}

function setSession(token: string, user: GasUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Core API call — POST JSON to the Apps Script backend.
 * Automatically includes the session token if one is stored.
 */
export async function gasCall<T = GasResponse>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const token = getToken();
  const body = JSON.stringify({ action, token, ...payload });

  // Apps Script web apps need a form-encoded POST with a text payload for
  // CORS to work from a cross-origin static site.
  const response = await fetch(BACKEND_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body,
  });

  if (!response.ok) {
    throw new Error(`Backend error (HTTP ${response.status})`);
  }

  const data = (await response.json()) as T;
  return data;
}

// ── Auth ───────────────────────────────────────────────────────────────────

export async function gasLogin(email: string, password: string): Promise<GasUser> {
  const res = await gasCall<GasResponse<{ token: string; role: string; name: string; email: string }>>(
    "login",
    { email, password },
  );
  if (!res.ok) throw new Error(res.error ?? "Login failed");
  const user: GasUser = { email: res.email, name: res.name, role: res.role };
  setSession(res.token, user);
  return user;
}

export async function gasSession(): Promise<GasUser | null> {
  const token = getToken();
  if (!token) return null;
  const res = await gasCall<GasResponse<{ valid: boolean; role: string; name: string; email: string }>>(
    "session",
  );
  if (!res.ok || !res.valid) {
    clearSession();
    return null;
  }
  const user: GasUser = { email: res.email, name: res.name, role: res.role };
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

export async function gasLogout(): Promise<void> {
  try {
    await gasCall("logout");
  } finally {
    clearSession();
  }
}

// ── Data operations ────────────────────────────────────────────────────────

export async function gasProtocols() {
  return gasCall<GasResponse<{ protocols: unknown[] }>>("protocols");
}

export async function gasProtocol(id: string) {
  return gasCall<GasResponse<{ protocol: unknown }>>("protocol", { id });
}

export async function gasCreateDraft() {
  return gasCall<GasResponse<{ protocolId: string }>>("createDraft");
}

export async function gasSubmitProtocol(protocolId: string, form: Record<string, unknown>) {
  return gasCall<GasResponse>("submitProtocol", { protocolId, form });
}

export async function gasUpdateSubmission(protocolId: string, form: Record<string, unknown>) {
  return gasCall<GasResponse>("updateSubmission", { protocolId, form });
}

export async function gasRunAction(action: string, input: Record<string, unknown>) {
  return gasCall<GasResponse<{ message: string }>>("runAction", { action, input });
}

export async function gasMembers() {
  return gasCall<GasResponse<{ members: unknown[] }>>("members");
}

export async function gasSafetyReports() {
  return gasCall<GasResponse<{ reports: unknown[] }>>("safetyReports");
}

export async function gasNotifications() {
  return gasCall<GasResponse<{ notifications: unknown[] }>>("notifications");
}

export async function gasMarkNotificationRead(id: string) {
  return gasCall("markNotificationRead", { id });
}

export async function gasMarkAllNotificationsRead() {
  return gasCall("markAllNotificationsRead");
}

export async function gasAuditLog() {
  return gasCall<GasResponse<{ entries: unknown[] }>>("auditLog");
}

export async function gasUsers() {
  return gasCall<GasResponse<{ users: unknown[] }>>("users");
}

export async function gasSetUserRole(userId: string, role: string, active: boolean) {
  return gasCall("setUserRole", { userId, role, active });
}

export async function gasScanResult(protocolId: string, scan: Record<string, unknown>) {
  return gasCall<GasResponse>("scanResult", { protocolId, scan });
}

export async function gasUploadDocument(
  protocolId: string,
  code: string,
  name: string,
  mime: string,
  base64: string,
  size: number,
  note?: string,
) {
  return gasCall<GasResponse>("uploadDocument", { protocolId, code, name, mime, base64, size, note });
}

export async function gasFileSae(
  protocolId: string,
  event: string,
  relatedness: string,
  seriousness: string,
) {
  return gasCall<GasResponse<{ id: string }>>("fileSae", { protocolId, event, relatedness, seriousness });
}

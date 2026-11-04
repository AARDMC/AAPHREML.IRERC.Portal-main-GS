/**
 * AAPHREML-IRERC Backend — Google Apps Script Web App API
 * =========================================================
 * Serves as the FULL backend for the static GitHub Pages portal.
 * All data lives in Google Sheets. No Vercel, no Neon, no Postgres.
 *
 * ── DEPLOY ──────────────────────────────────────────────────────────────────
 * 1. Open the Database Table sheet → Extensions → Apps Script
 * 2. Paste this file (replace any existing content)
 * 3. Create two extra sheets if they don't exist:
 *      "IRERC Users"     — login accounts
 *      "IRERC Sessions"  — active session tokens
 *      "IRERC Protocols" — full protocol data (can be the Database Table)
 *      "IRERC Scanner"   — scan results
 *      "IRERC Audit"     — append-only audit log
 * 4. Run setupBackend() once to create sheet headers + bootstrap admin
 * 5. Deploy → New deployment → Web app
 *      Execute as: Me
 *      Who has access: Anyone
 * 6. Copy the deployment URL (ends in /exec) — this is your BACKEND_URL
 * 7. Put BACKEND_URL in the portal's config (src/lib/gas/config.ts)
 *
 * ── API CONTRACT ────────────────────────────────────────────────────────────
 * All requests are POST with JSON body: { action, token?, ...payload }
 * Response: { ok: boolean, ...data } or { ok: false, error: string }
 *
 * Actions:
 *   login          { email, password }               → { ok, token, role, name }
 *   session        { token }                          → { ok, valid, role, name }
 *   logout         { token }                          → { ok }
 *   protocols      { token }                           → { ok, protocols: [] }
 *   protocol       { token, id }                       → { ok, protocol: {} }
 *   createDraft    { token }                           → { ok, protocolId }
 *   submitProtocol { token, protocolId, form }        → { ok, protocol }
 *   runAction      { token, action, input }           → { ok, message }
 *   scanResult     { token, protocolId, scan }        → { ok }
 *   members        { token }                           → { ok, members: [] }
 *   addMember      { token, member }                  → { ok }
 *   updateMember   { token, id, member }              → { ok }
 *   removeMember   { token, id }                      → { ok }
 *   safetyReports  { token }                           → { ok, reports: [] }
 *   fileSae        { token, protocolId, ... }         → { ok, id }
 *   notifications  { token }                           → { ok, notifications: [] }
 *   markNotificationRead { token, id }                → { ok }
 *   auditLog       { token }                           → { ok, entries: [] }
 *   users          { token }                           → { ok, users: [] }
 *   setUserRole    { token, userId, role, ... }       → { ok }
 *   sync           { token }                           → { ok, protocols: [] }
 *
 * ── SHEET STRUCTURES ────────────────────────────────────────────────────────
 *
 * IRERC Users:
 *   email | passwordHash | name | role | active | emailVerified | createdAt
 *
 * IRERC Sessions:
 *   token | userId | email | role | name | createdAt | expiresAt
 *
 * IRERC Protocols:
 *   id | piEmail | title | status | reviewType | decision | submittedAt |
 *   data(JSON) | createdAt | updatedAt
 *
 * IRERC Scanner:
 *   protocolId | fileName | completeness | present | total | missing |
 *   title | institution | sampleSize | studyPeriod | email | phone |
 *   scannedAt | sentAt | status
 *
 * IRERC Audit:
 *   id | protocolId | at | actor | role | action | note
 *
 * IRERC Members:
 *   id | name | category | seat | institution | email | phone | active | userId
 *
 * IRERC Safety:
 *   id | protocolId | event | eventDate | relatedness | seriousness | status | note | filedBy
 *
 * IRERC Notifications:
 *   id | protocolId | recipientRole | type | priority | title | body | createdAt | readBy
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════

var SHEET_USERS = "IRERC Users";
var SHEET_SESSIONS = "IRERC Sessions";
var SHEET_PROTOCOLS = "IRERC Protocols";
var SHEET_SCANNER = "IRERC Scanner";
var SHEET_AUDIT = "IRERC Audit";
var SHEET_MEMBERS = "IRERC Members";
var SHEET_SAFETY = "IRERC Safety";
var SHEET_NOTIFICATIONS = "IRERC Notifications";

var SESSION_HOURS = 12; // session token validity
var BOOTSTRAP_EMAIL = "addisrdmc@gmail.com";
var BOOTSTRAP_PASSWORD = "Admin123!";
var BOOTSTRAP_NAME = "System Administrator";

// ═══════════════════════════════════════════════════════════════════════════
// WEB APP ENTRY POINTS
// ═══════════════════════════════════════════════════════════════════════════

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    if (!action) return json({ ok: false, error: "Missing 'action' field" });

    switch (action) {
      case "login": return actionLogin(body);
      case "session": return actionSession(body);
      case "logout": return actionLogout(body);
      case "protocols": return actionProtocols(body);
      case "protocol": return actionProtocol(body);
      case "createDraft": return actionCreateDraft(body);
      case "submitProtocol": return actionSubmitProtocol(body);
      case "updateSubmission": return actionUpdateSubmission(body);
      case "runAction": return actionRunAction(body);
      case "scanResult": return actionScanResult(body);
      case "members": return actionMembers(body);
      case "addMember": return actionAddMember(body);
      case "updateMember": return actionUpdateMember(body);
      case "removeMember": return actionRemoveMember(body);
      case "safetyReports": return actionSafetyReports(body);
      case "fileSae": return actionFileSae(body);
      case "notifications": return actionNotifications(body);
      case "markNotificationRead": return actionMarkNotificationRead(body);
      case "markAllNotificationsRead": return actionMarkAllNotificationsRead(body);
      case "auditLog": return actionAuditLog(body);
      case "users": return actionUsers(body);
      case "setUserRole": return actionSetUserRole(body);
      case "sync": return actionSync(body);
      case "uploadDocument": return actionUploadDocument(body);
      case "downloadDocument": return actionDownloadDocument(body);
      default: return json({ ok: false, error: "Unknown action: " + action });
    }
  } catch (err) {
    return json({ ok: false, error: err.message || String(err) });
  }
}

function doGet(e) {
  // Health check / simple status
  return json({ ok: true, service: "AAPHREML-IRERC Backend", time: new Date().toISOString() });
}

// ═══════════════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════════════

function setupBackend() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Create sheets with headers
  ensureSheet(ss, SHEET_USERS, ["email", "passwordHash", "name", "role", "active", "emailVerified", "createdAt"]);
  ensureSheet(ss, SHEET_SESSIONS, ["token", "userId", "email", "role", "name", "createdAt", "expiresAt"]);
  ensureSheet(ss, SHEET_PROTOCOLS, ["id", "piEmail", "title", "status", "reviewType", "decision", "submittedAt", "data", "createdAt", "updatedAt"]);
  ensureSheet(ss, SHEET_SCANNER, ["protocolId", "fileName", "completeness", "present", "total", "missing", "title", "institution", "sampleSize", "studyPeriod", "email", "phone", "scannedAt", "sentAt", "status"]);
  ensureSheet(ss, SHEET_AUDIT, ["id", "protocolId", "at", "actor", "role", "action", "note"]);
  ensureSheet(ss, SHEET_MEMBERS, ["id", "name", "category", "seat", "institution", "email", "phone", "active", "userId"]);
  ensureSheet(ss, SHEET_SAFETY, ["id", "protocolId", "event", "eventDate", "relatedness", "seriousness", "status", "note", "filedBy"]);
  ensureSheet(ss, SHEET_NOTIFICATIONS, ["id", "protocolId", "recipientRole", "recipientEmail", "type", "priority", "title", "body", "createdAt", "readBy"]);

  // Create bootstrap admin
  var userSheet = ss.getSheetByName(SHEET_USERS);
  var existing = findRow(userSheet, "email", BOOTSTRAP_EMAIL);
  if (!existing) {
    var hash = hashPassword(BOOTSTRAP_PASSWORD);
    userSheet.appendRow([BOOTSTRAP_EMAIL, hash, BOOTSTRAP_NAME, "admin", true, true, new Date().toISOString()]);
    SpreadsheetApp.getActiveSpreadsheet().toast("Backend setup complete. Bootstrap admin: " + BOOTSTRAP_EMAIL, "Setup ✓");
  } else {
    SpreadsheetApp.getActiveSpreadsheet().toast("Backend already set up. Bootstrap admin exists.", "Setup");
  }
}

function ensureSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#1a5276").setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════════════

function hashPassword(password) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password, Utilities.Charset.UTF_8).map(function(b) {
    return ("0" + (b & 0xff).toString(16)).slice(-2);
  }).join("");
}

function generateToken() {
  return Utilities.getUuid() + "-" + Date.now().toString(36);
}

function actionLogin(body) {
  if (!body.email || !body.password) return json({ ok: false, error: "Email and password are required" });
  var sheet = getSheet(SHEET_USERS);
  var user = findRow(sheet, "email", body.email.toLowerCase().trim());
  if (!user) return json({ ok: false, error: "Email or password is not correct" });
  if (user.active !== true && user.active !== "true") return json({ ok: false, error: "This account has been deactivated" });
  if (user.passwordHash !== hashPassword(body.password)) return json({ ok: false, error: "Email or password is not correct" });

  // Create session
  var token = generateToken();
  var now = new Date();
  var expires = new Date(now.getTime() + SESSION_HOURS * 3600000);
  var sessSheet = getSheet(SHEET_SESSIONS);
  sessSheet.appendRow([token, user.email, user.email, user.role, user.name, now.toISOString(), expires.toISOString()]);

  return json({ ok: true, token: token, role: user.role, name: user.name, email: user.email });
}

function actionSession(body) {
  var session = validateToken(body.token);
  if (!session) return json({ ok: false, valid: false });
  return json({ ok: true, valid: true, role: session.role, name: session.name, email: session.email });
}

function actionLogout(body) {
  if (!body.token) return json({ ok: true });
  var sheet = getSheet(THEET_SESSIONS);
  var row = findRowIndex(sheet, "token", body.token);
  if (row) sheet.deleteRow(row);
  return json({ ok: true });
}

function validateToken(token) {
  if (!token) return null;
  var sheet = getSheet(SHEET_SESSIONS);
  var session = findRow(sheet, "token", token);
  if (!session) return null;
  var expires = new Date(session.expiresAt);
  if (expires < new Date()) {
    // Expired — clean up
    var row = findRowIndex(sheet, "token", token);
    if (row) sheet.deleteRow(row);
    return null;
  }
  return session;
}

/** Returns the authenticated user's role or throws. */
function requireAuth(body, roles) {
  var session = validateToken(body.token);
  if (!session) throw new Error("Not authenticated");
  if (roles && roles.indexOf(session.role) === -1) throw new Error("Forbidden — your role cannot perform this action");
  return session;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROTOCOLS
// ═══════════════════════════════════════════════════════════════════════════

function actionProtocols(body) {
  var session = requireAuth(body);
  var sheet = getSheet(SHEET_PROTOCOLS);
  var rows = sheet.getDataRange().getValues();
  var protocols = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    var data = {};
    try { data = JSON.parse(r[7] || "{}"); } catch(e) {}
    // Scope by role
    if (session.role === "investigator" && r[1] !== session.email) continue;
    if (session.role === "reviewer") {
      var reviewers = (data.reviewers || []).join(",");
      var memberName = getMemberNameByEmail(session.email);
      if (reviewers.indexOf(memberName) === -1) continue;
    }
    protocols.push(rowToProtocol(r, data));
  }
  return json({ ok: true, protocols: protocols });
}

function actionProtocol(body) {
  var session = requireAuth(body);
  var sheet = getSheet(SHEET_PROTOCOLS);
  var row = findRow(sheet, "id", body.id);
  if (!row) return json({ ok: false, error: "Protocol not found" });
  var data = {};
  try { data = JSON.parse(row.data || "{}"); } catch(e) {}
  return json({ ok: true, protocol: rowToProtocol(row, data) });
}

function actionCreateDraft(body) {
  var session = requireAuth(body, ["investigator"]);
  var year = new Date().getFullYear();
  var sheet = getSheet(SHEET_PROTOCOLS);
  var seq = 1;
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] && String(rows[i][0]).indexOf("AAPHREML-IRERC-" + year + "-") === 0) seq++;
  }
  var id = "AAPHREML-IRERC-" + year + "-" + ("0000" + seq).slice(-4);
  var now = new Date().toISOString();
  var emptyProtocol = {
    id: id, title: "", status: "draft", reviewType: null, decision: null,
    submitted: "", pi: "", institution: "", reviewers: [], reviews: [],
    docs: [], history: [], summary: "", scan: null, submission: {},
    declaration: { accepted: false, acceptedAt: "", piName: "", text: "" }
  };
  sheet.appendRow([id, session.email, "", "draft", "", "", "", JSON.stringify(emptyProtocol), now, now]);
  return json({ ok: true, protocolId: id });
}

function actionSubmitProtocol(body) {
  var session = requireAuth(body, ["investigator"]);
  var sheet = getSheet(SHEET_PROTOCOLS);
  var rowIndex = findRowIndex(sheet, "id", body.protocolId);
  if (!rowIndex) return json({ ok: false, error: "Protocol not found" });
  var row = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (row[1] !== session.email) return json({ ok: false, error: "Not your protocol" });
  var data = {};
  try { data = JSON.parse(row[7] || "{}"); } catch(e) {}
  var form = body.form || {};
  data.submission = form;
  data.title = form.studyTitle || "";
  data.pi = form.piName || "";
  data.status = "submitted";
  data.submitted = new Date().toISOString().slice(0, 10);
  data.piEmail = session.email;
  // Add to history
  data.history = data.history || [];
  data.history.push({ date: data.submitted, at: new Date().toISOString(), actor: session.name, action: "Protocol submitted" });
  var now = new Date().toISOString();
  sheet.getRange(rowIndex, 3, 1, 1).setValue(data.title); // title
  sheet.getRange(rowIndex, 4, 1, 1).setValue("submitted"); // status
  sheet.getRange(rowIndex, 7, 1, 1).setValue(data.submitted); // submittedAt
  sheet.getRange(rowIndex, 8, 1, 1).setValue(JSON.stringify(data)); // data JSON
  sheet.getRange(rowIndex, 10, 1, 1).setValue(now); // updatedAt
  addAudit(body.protocolId, session.name, session.role, "Protocol submitted");
  return json({ ok: true, protocol: rowToProtocol([row[0], row[1], data.title, "submitted", row[4], row[5], data.submitted, JSON.stringify(data), row[8], now], data) });
}

function actionUpdateSubmission(body) {
  var session = requireAuth(body, ["investigator"]);
  var sheet = getSheet(SHEET_PROTOCOLS);
  var rowIndex = findRowIndex(sheet, "id", body.protocolId);
  if (!rowIndex) return json({ ok: false, error: "Protocol not found" });
  var row = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (row[1] !== session.email) return json({ ok: false, error: "Not your protocol" });
  var data = {};
  try { data = JSON.parse(row[7] || "{}"); } catch(e) {}
  data.submission = body.form || data.submission;
  data.title = body.form.studyTitle || data.title;
  data.pi = body.form.piName || data.pi;
  var now = new Date().toISOString();
  data.history = data.history || [];
  data.history.push({ date: now.slice(0,10), at: now, actor: session.name, action: "Submission updated" });
  sheet.getRange(rowIndex, 3, 1, 1).setValue(data.title);
  sheet.getRange(rowIndex, 8, 1, 1).setValue(JSON.stringify(data));
  sheet.getRange(rowIndex, 10, 1, 1).setValue(now);
  addAudit(body.protocolId, session.name, session.role, "Submission updated");
  return json({ ok: true, protocol: rowToProtocol([row[0], row[1], data.title, row[3], row[4], row[5], row[6], JSON.stringify(data), row[8], now], data) });
}

function actionSync(body) {
  var session = requireAuth(body);
  var sheet = getSheet(SHEET_PROTOCOLS);
  var rows = sheet.getDataRange().getValues();
  var protocols = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0] || r[3] === "draft") continue;
    if (session.role === "investigator" && r[1] !== session.email) continue;
    var data = {};
    try { data = JSON.parse(r[7] || "{}"); } catch(e) {}
    protocols.push(rowToProtocol(r, data));
  }
  return json({ ok: true, protocols: protocols, syncedAt: new Date().toISOString() });
}

// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

function actionRunAction(body) {
  var session = requireAuth(body);
  var action = body.action;
  var input = body.input || {};
  var id = input.id || input.protocolId;

  // Role-based access for common actions
  var roleRules = {
    "startScreening": ["secretariat", "admin"],
    "setDoc": ["secretariat", "admin"],
    "passScreening": ["secretariat", "admin"],
    "returnForCorrection": ["secretariat", "admin"],
    "resubmit": ["investigator"],
    "classify": ["secretariat", "admin"],
    "assignReviewers": ["secretariat", "chair", "admin"],
    "placeOnAgenda": ["secretariat", "chair", "admin"],
    "saveAssessment": ["reviewer"],
    "saveDecision": ["chair", "secretariat", "admin"],
    "sendLetter": ["secretariat", "admin"],
    "requestRevision": ["secretariat", "chair"],
    "extendRevision": ["admin"],
    "recordDocumentRevision": ["investigator"],
    "uploadFinalProtocol": ["investigator"],
    "submitFinalProtocol": ["investigator"],
    "submitRevision": ["investigator"],
    "addDocumentComment": ["reviewer"],
    "toggleDocumentComment": ["reviewer"],
    "reviewSafety": ["secretariat", "chair", "admin"],
    "fileSae": ["investigator"],
    "fileAmendment": ["investigator"],
    "decideAmendment": ["chair", "admin"],
    "fileContinuing": ["investigator"],
    "archiveProtocol": ["secretariat", "chair", "admin"],
  };

  var allowed = roleRules[action];
  if (allowed && allowed.indexOf(session.role) === -1) {
    return json({ ok: false, error: "Your role cannot perform: " + action });
  }

  var sheet = getSheet(SHEET_PROTOCOLS);
  var rowIndex = findRowIndex(sheet, "id", id);
  if (!rowIndex) return json({ ok: false, error: "Protocol not found" });
  var row = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
  var data = {};
  try { data = JSON.parse(row[7] || "{}"); } catch(e) {}

  var now = new Date().toISOString();
  var today = now.slice(0, 10);
  var msg = "Action completed";

  switch (action) {
    case "startScreening":
      data.status = "screening";
      data.history.push({ date: today, at: now, actor: session.name, action: "Administrative check started" });
      msg = "Administrative check started";
      break;

    case "setDoc":
      data.docs = data.docs || [];
      for (var d = 0; d < data.docs.length; d++) {
        if (data.docs[d].code === input.code) data.docs[d].state = input.state;
      }
      break;

    case "passScreening":
      data.status = "complete";
      data.history.push({ date: today, at: now, actor: session.name, action: "Completeness verified" });
      msg = "Submission marked complete";
      break;

    case "returnForCorrection":
      data.status = "correction";
      data.history.push({ date: today, at: now, actor: session.name, action: "Returned for correction", note: input.note || "" });
      msg = "Returned to the investigator";
      break;

    case "resubmit":
      data.status = "screening";
      data.history.push({ date: today, at: now, actor: session.name, action: "Corrected package resubmitted" });
      msg = "Resubmitted for screening";
      break;

    case "classify":
      data.reviewType = input.reviewType;
      data.status = "classified";
      data.history.push({ date: today, at: now, actor: session.name, action: "Review type classified", note: input.reviewType });
      msg = "Classified as " + input.reviewType;
      break;

    case "assignReviewers":
      data.reviewers = input.names || [];
      data.status = "assigned";
      data.assignedOn = today;
      data.reviews = [];
      data.initialProtocolLockedAt = data.initialProtocolLockedAt || now;
      data.history.push({ date: today, at: now, actor: session.name, action: "Reviewers assigned", note: (input.names || []).join(", ") });
      msg = "Reviewers assigned";
      break;

    case "placeOnAgenda":
      data.status = "agenda";
      data.history.push({ date: today, at: now, actor: session.name, action: "Placed on committee agenda" });
      msg = "Added to the next committee meeting";
      break;

    case "saveAssessment":
      var reviewerName = session.name;
      data.reviews = data.reviews || [];
      data.reviews.push({
        reviewer: reviewerName, date: today,
        recommendation: input.recommendation || "",
        comments: input.comments || "", conflict: false
      });
      data.status = data.reviews.length >= (data.reviewers || []).length ? "reviews_complete" : "reviewing";
      data.history.push({ date: today, at: now, actor: reviewerName, action: "Assessment submitted", note: input.recommendation || "" });
      msg = "Assessment submitted";
      break;

    case "saveDecision":
      data.decision = input.decision;
      data.decisionNote = input.note || "";
      data.votes = input.votes || { for: 0, against: 0, abstain: 0 };
      data.status = "decided";
      data.history.push({ date: today, at: now, actor: session.name, action: "Committee decision recorded", note: input.decision });
      msg = "Decision recorded";
      break;

    case "sendLetter":
      data.letter = input.message || "";
      if (data.decision === "Approved" || data.decision === "Approved with Conditions") {
        data.status = "active";
        data.continuingDue = addDaysStr(today, 365);
        msg = "Clearance letter sent";
      } else {
        data.status = "archived";
        msg = "Action letter sent";
      }
      data.history.push({ date: today, at: now, actor: session.name, action: "Action letter issued" });
      break;

    case "requestRevision":
      data.status = "revision";
      data.revision = {
        status: "requested", requestedAt: now,
        dueAt: new Date(Date.now() + 48 * 3600000).toISOString(),
        requestedBy: session.name, comments: input.comments || "",
        extendedAt: null, extendedBy: null, submittedAt: null
      };
      data.history.push({ date: today, at: now, actor: session.name, action: "Revision requested" });
      msg = "Revision requested — 48-hour window open";
      break;

    case "extendRevision":
      if (data.revision) {
        var base = Math.max(Date.now(), new Date(data.revision.dueAt).getTime());
        var hours = input.hours || 48;
        data.revision.dueAt = new Date(base + hours * 3600000).toISOString();
        data.revision.extendedAt = now;
        data.revision.extendedBy = session.name;
        data.history.push({ date: today, at: now, actor: session.name, action: "Revision window extended", note: hours + " hours" });
        msg = "Revision window extended";
      }
      break;

    case "submitRevision":
      data.status = "reviewing";
      data.reviews = [];
      data.assignedOn = today;
      if (data.revision) { data.revision.status = "submitted"; data.revision.submittedAt = now; }
      data.history.push({ date: today, at: now, actor: session.name, action: "Revised package submitted" });
      msg = "Revision submitted — reviewers will reassess";
      break;

    case "submitFinalProtocol":
      data.status = "reviewing";
      data.reviews = [];
      data.assignedOn = today;
      if (data.revision) { data.revision.status = "submitted"; data.revision.submittedAt = now; }
      if (data.finalProtocol) { data.finalProtocol.status = "submitted"; data.finalProtocol.submittedAt = now; }
      data.history.push({ date: today, at: now, actor: session.name, action: "Revised protocol submitted" });
      msg = "Revised protocol submitted to reviewers";
      break;

    case "uploadFinalProtocol":
      data.finalProtocol = data.finalProtocol || { status: "draft", versions: [], submittedAt: null, updatedAt: null };
      data.finalProtocol.status = "draft";
      data.finalProtocol.updatedAt = now;
      data.history.push({ date: today, at: now, actor: session.name, action: "Revised protocol PDF uploaded" });
      msg = "Revised protocol PDF uploaded";
      break;

    case "archiveProtocol":
      data.status = "archived";
      data.continuingDue = null;
      data.history.push({ date: today, at: now, actor: session.name, action: "Study archived" });
      msg = "Protocol archived";
      break;

    case "fileSae":
      return actionFileSae({ token: body.token, protocolId: id, event: input.event, relatedness: input.relatedness, seriousness: input.seriousness });

    case "fileAmendment":
      data.amendment = { summary: input.summary || "", date: today, status: "Pending review" };
      data.history.push({ date: today, at: now, actor: session.name, action: "Amendment submitted", note: input.summary || "" });
      msg = "Amendment submitted to the secretariat";
      break;

    case "decideAmendment":
      if (data.amendment) {
        data.amendment.status = input.approved ? "Approved" : "Not approved";
        data.history.push({ date: today, at: now, actor: session.name, action: input.approved ? "Amendment approved" : "Amendment not approved" });
        msg = input.approved ? "Amendment approved" : "Amendment not approved";
      }
      break;

    case "fileContinuing":
      data.continuingDue = addDaysStr(today, 365);
      data.history.push({ date: today, at: now, actor: session.name, action: "Continuing review report submitted" });
      msg = "Continuing review filed — next due in one year";
      break;

    case "addDocumentComment":
      data.documentComments = data.documentComments || [];
      data.documentComments.push({
        id: "C-" + Date.now().toString(36), protocolId: id,
        code: input.code, version: input.version,
        author: session.name, authorRole: session.role,
        text: input.text || "", quote: input.quote || "",
        createdAt: now, resolved: false
      });
      msg = "Document comment added";
      break;

    case "toggleDocumentComment":
      data.documentComments = data.documentComments || [];
      for (var c = 0; c < data.documentComments.length; c++) {
        if (data.documentComments[c].id === input.commentId) {
          data.documentComments[c].resolved = !data.documentComments[c].resolved;
          msg = data.documentComments[c].resolved ? "Comment resolved" : "Comment reopened";
        }
      }
      break;

    case "recordDocumentRevision":
      data.documentVersions = data.documentVersions || [];
      data.documentVersions.push({ code: input.code, version: input.version, uploadedAt: now, uploadedBy: session.name });
      msg = "Revised document uploaded";
      break;

    default:
      return json({ ok: false, error: "Unknown workflow action: " + action });
  }

  // Persist
  sheet.getRange(rowIndex, 4, 1, 1).setValue(data.status); // status
  if (data.reviewType) sheet.getRange(rowIndex, 5, 1, 1).setValue(data.reviewType);
  if (data.decision) sheet.getRange(rowIndex, 6, 1, 1).setValue(data.decision);
  sheet.getRange(rowIndex, 8, 1, 1).setValue(JSON.stringify(data)); // data JSON
  sheet.getRange(rowIndex, 10, 1, 1).setValue(now); // updatedAt

  addAudit(id, session.name, session.role, action, input.note || "");
  return json({ ok: true, message: msg });
}

// ═══════════════════════════════════════════════════════════════════════════
// SCANNER RESULTS
// ═══════════════════════════════════════════════════════════════════════════

function actionScanResult(body) {
  var session = requireAuth(body);
  var sheet = getSheet(SHEET_PROTOCOLS);
  var rowIndex = findRowIndex(sheet, "id", body.protocolId);
  if (!rowIndex) return json({ ok: false, error: "Protocol not found" });
  var row = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
  var data = {};
  try { data = JSON.parse(row[7] || "{}"); } catch(e) {}
  var scan = body.scan || {};
  data.scan = {
    fileName: scan.fileName || "", scannedAt: new Date().toISOString(),
    total: scan.total || 28, present: scan.present || 0,
    completeness: scan.completeness || 0, missing: scan.missing || [],
    checklist: scan.checklist || [],
    extracted: scan.extracted || {}
  };
  data.history = data.history || [];
  data.history.push({ date: new Date().toISOString().slice(0,10), at: new Date().toISOString(), actor: "Scanner", action: "Document scan completed", note: (scan.completeness||0) + "% completeness" });
  sheet.getRange(rowIndex, 8, 1, 1).setValue(JSON.stringify(data));
  sheet.getRange(rowIndex, 10, 1, 1).setValue(new Date().toISOString());
  addAudit(body.protocolId, session.name, session.role, "Scan result received", (scan.completeness||0) + "%");
  return json({ ok: true, completeness: scan.completeness || 0 });
}

// ═══════════════════════════════════════════════════════════════════════════
// MEMBERS / ROSTER
// ═══════════════════════════════════════════════════════════════════════════

function actionMembers(body) {
  var session = requireAuth(body);
  var sheet = getSheet(SHEET_MEMBERS);
  var rows = sheet.getDataRange().getValues();
  var members = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    members.push({
      id: rows[i][0], name: rows[i][1], category: rows[i][2], seat: rows[i][3],
      institution: rows[i][4], email: rows[i][5], phone: rows[i][6],
      active: rows[i][7] === true || rows[i][7] === "true",
      lay: rows[i][3] === "Lay member",
      userId: rows[i][8] || null
    });
  }
  return json({ ok: true, members: members });
}

function actionAddMember(body) {
  var session = requireAuth(body, ["secretariat", "admin"]);
  var sheet = getSheet(SHEET_MEMBERS);
  var m = body.member || {};
  var id = "M-" + Date.now().toString(36);
  sheet.appendRow([id, m.name || "", m.category || "", m.seat || "Member", m.institution || "", m.email || "", m.phone || "", true, m.userId || ""]);
  addAudit(null, session.name, session.role, "Member added", m.name || "");
  return json({ ok: true, id: id });
}

function actionUpdateMember(body) {
  var session = requireAuth(body, ["secretariat", "admin"]);
  var sheet = getSheet(SHEET_MEMBERS);
  var rowIndex = findRowIndex(sheet, "id", body.id);
  if (!rowIndex) return json({ ok: false, error: "Member not found" });
  var m = body.member || {};
  sheet.getRange(rowIndex, 2, 1, 8).setValues([[m.name || "", m.category || "", m.seat || "Member", m.institution || "", m.email || "", m.phone || "", m.active !== false, m.userId || ""]]);
  return json({ ok: true });
}

function actionRemoveMember(body) {
  var session = requireAuth(body, ["secretariat", "admin"]);
  var sheet = getSheet(SHEET_MEMBERS);
  var rowIndex = findRowIndex(sheet, "id", body.id);
  if (!rowIndex) return json({ ok: false, error: "Member not found" });
  // Don't delete — mark inactive
  sheet.getRange(rowIndex, 8, 1, 1).setValue(false);
  return json({ ok: true });
}

// ═══════════════════════════════════════════════════════════════════════════
// SAFETY REPORTS
// ═══════════════════════════════════════════════════════════════════════════

function actionSafetyReports(body) {
  var session = requireAuth(body);
  var sheet = getSheet(SHEET_SAFETY);
  var rows = sheet.getDataRange().getValues();
  var reports = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    reports.push({
      id: rows[i][0], protocolId: rows[i][1], event: rows[i][2],
      date: rows[i][3], relatedness: rows[i][4], seriousness: rows[i][5],
      status: rows[i][6], note: rows[i][7] || ""
    });
  }
  return json({ ok: true, reports: reports });
}

function actionFileSae(body) {
  var session = requireAuth(body, ["investigator"]);
  var sheet = getSheet(SHEET_SAFETY);
  var seq = sheet.getLastRow();
  var id = "SAE-" + ("000" + seq).slice(-3);
  var today = new Date().toISOString().slice(0, 10);
  sheet.appendRow([id, body.protocolId, body.event || "", today, body.relatedness || "", body.seriousness || "", "Pending review", "", session.email]);
  addAudit(body.protocolId, session.name, session.role, "Safety report filed", id + ": " + (body.event || ""));
  return json({ ok: true, id: id });
}

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════

function actionNotifications(body) {
  var session = requireAuth(body);
  var sheet = getSheet(SHEET_NOTIFICATIONS);
  var rows = sheet.getDataRange().getValues();
  var notifications = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    var recipientRole = rows[i][2];
    var recipientEmail = rows[i][3];
    // Show if role matches or "all", or if email matches
    if (recipientRole !== "all" && recipientRole !== session.role && recipientEmail !== session.email) continue;
    var readBy = (rows[i][9] || "").split(",").filter(function(s) { return s.trim(); });
    notifications.push({
      id: rows[i][0], protocolId: rows[i][1], recipientRole: recipientRole,
      type: rows[i][4], priority: rows[i][5], title: rows[i][6],
      body: rows[i][7], createdAt: rows[i][8], read: readBy.indexOf(session.email) !== -1
    });
  }
  return json({ ok: true, notifications: notifications });
}

function actionMarkNotificationRead(body) {
  var session = requireAuth(body);
  var sheet = getSheet(SHEET_NOTIFICATIONS);
  var rowIndex = findRowIndex(sheet, "id", body.id);
  if (!rowIndex) return json({ ok: false, error: "Notification not found" });
  var readBy = sheet.getRange(rowIndex, 10, 1, 1).getValue() || "";
  var readers = readBy.split(",").filter(function(s) { return s.trim(); });
  if (readers.indexOf(session.email) === -1) {
    readers.push(session.email);
    sheet.getRange(rowIndex, 10, 1, 1).setValue(readers.join(","));
  }
  return json({ ok: true });
}

function actionMarkAllNotificationsRead(body) {
  var session = requireAuth(body);
  var sheet = getSheet(SHEET_NOTIFICATIONS);
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    var readBy = rows[i][9] || "";
    var readers = readBy.split(",").filter(function(s) { return s.trim(); });
    if (readers.indexOf(session.email) === -1) {
      readers.push(session.email);
      sheet.getRange(i + 1, 10, 1, 1).setValue(readers.join(","));
    }
  }
  return json({ ok: true });
}

// ═══════════════════════════════════════════════════════════════════════════
// USERS (admin)
// ═══════════════════════════════════════════════════════════════════════════

function actionUsers(body) {
  var session = requireAuth(body, ["admin"]);
  var sheet = getSheet(SHEET_USERS);
  var rows = sheet.getDataRange().getValues();
  var users = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    users.push({
      userId: String(i), name: rows[i][2], email: rows[i][0],
      emailVerified: rows[i][5] === true || rows[i][5] === "true",
      role: rows[i][3], active: rows[i][4] === true || rows[i][4] === "true"
    });
  }
  return json({ ok: true, users: users });
}

function actionSetUserRole(body) {
  var session = requireAuth(body, ["admin"]);
  var sheet = getSheet(SHEET_USERS);
  var rowIndex = findRowIndex(sheet, "email", body.userId);
  if (!rowIndex) return json({ ok: false, error: "User not found" });
  sheet.getRange(rowIndex, 4, 1, 1).setValue(body.role); // role
  sheet.getRange(rowIndex, 5, 1, 1).setValue(body.active !== false); // active
  addAudit(null, session.name, session.role, "Role changed", body.userId + ": " + body.role);
  // Also update member sheet if reviewer/chair
  if (body.role === "reviewer" || body.role === "chair") {
    var mSheet = getSheet(SHEET_MEMBERS);
    var mRow = findRowIndex(mSheet, "email", body.userId);
    if (mRow) {
      mSheet.getRange(mRow, 4, 1, 1).setValue(body.role === "chair" ? "Chairperson" : "Member");
      mSheet.getRange(mRow, 8, 1, 1).setValue(body.active !== false);
    }
  }
  return json({ ok: true });
}

// ═══════════════════════════════════════════════════════════════════════════
// AUDIT LOG
// ═══════════════════════════════════════════════════════════════════════════

function actionAuditLog(body) {
  var session = requireAuth(body, ["admin", "secretariat"]);
  var sheet = getSheet(SHEET_AUDIT);
  var rows = sheet.getDataRange().getValues();
  var entries = [];
  for (var i = rows.length - 1; i >= 1; i--) { // newest first
    if (!rows[i][0]) continue;
    entries.push({
      id: rows[i][0], protocolId: rows[i][1], at: rows[i][2],
      actor: rows[i][3], role: rows[i][4], action: rows[i][5], note: rows[i][6] || ""
    });
  }
  return json({ ok: true, entries: entries.slice(0, 200) });
}

// ═══════════════════════════════════════════════════════════════════════════
// DOCUMENTS (metadata only — store in Drive folder for full files)
// ═══════════════════════════════════════════════════════════════════════════

function actionUploadDocument(body) {
  var session = requireAuth(body, ["investigator"]);
  var sheet = getSheet(SHEET_PROTOCOLS);
  var rowIndex = findRowIndex(sheet, "id", body.protocolId);
  if (!rowIndex) return json({ ok: false, error: "Protocol not found" });
  var row = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
  var data = {};
  try { data = JSON.parse(row[7] || "{}"); } catch(e) {}
  data.documentVersions = data.documentVersions || [];
  var version = 1;
  for (var v = 0; v < data.documentVersions.length; v++) {
    if (data.documentVersions[v].code === body.code) version = Math.max(version, data.documentVersions[v].version + 1);
  }
  data.documentVersions.push({
    code: body.code, version: version, name: body.name || "",
    size: body.size || 0, type: body.mime || "", uploadedAt: new Date().toISOString(),
    uploadedBy: session.name, note: body.note || ""
  });
  // Store file content in a Drive folder if base64 is provided
  if (body.base64) {
    try {
      var folder = getOrCreateDriveFolder("AAPHREML-IRERC Documents/" + body.protocolId);
      var blob = Utilities.newBlob(Utilities.base64Decode(body.base64), body.mime || "application/octet-stream", body.name || body.code);
      folder.createFile(blob);
    } catch(e) { /* Drive storage optional */ }
  }
  sheet.getRange(rowIndex, 8, 1, 1).setValue(JSON.stringify(data));
  sheet.getRange(rowIndex, 10, 1, 1).setValue(new Date().toISOString());
  addAudit(body.protocolId, session.name, session.role, "Document uploaded", body.code + " v" + version);
  return json({ ok: true, code: body.code, version: version });
}

function actionDownloadDocument(body) {
  var session = requireAuth(body);
  var sheet = getSheet(SHEET_PROTOCOLS);
  var rowIndex = findRowIndex(sheet, "id", body.protocolId);
  if (!rowIndex) return json({ ok: false, error: "Protocol not found" });
  var row = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
  var data = {};
  try { data = JSON.parse(row[7] || "{}"); } catch(e) {}
  // Find the document version
  var versions = data.documentVersions || [];
  var target = null;
  for (var v = versions.length - 1; v >= 0; v--) {
    if (versions[v].code === body.code) {
      if (body.version && versions[v].version === body.version) { target = versions[v]; break; }
      if (!body.version) { target = versions[v]; break; }
    }
  }
  if (!target) return json({ ok: false, error: "Document not found" });
  // Try to find in Drive
  try {
    var folder = DriveApp.getFolder("AAPHREML-IRERC Documents/" + body.protocolId);
    var files = folder.getFilesByName(target.name);
    if (files.hasNext()) {
      var file = files.next();
      var base64 = Utilities.base64Encode(file.getBlob().getBytes());
      return json({ ok: true, name: target.name, mime: target.type, base64: base64 });
    }
  } catch(e) { /* Drive not available */ }
  return json({ ok: false, error: "File content not available" });
}

function getOrCreateDriveFolder(path) {
  var parts = path.split("/");
  var folder = DriveApp.getRootFolder();
  for (var p = 0; p < parts.length; p++) {
    var subs = folder.getFoldersByName(parts[p]);
    if (subs.hasNext()) folder = subs.next();
    else folder = folder.createFolder(parts[p]);
  }
  return folder;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Find a row by column value. Returns the row data as an object (using header names). */
function findRow(sheet, colName, value) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;
  var headers = data[0];
  var colIndex = headers.indexOf(colName);
  if (colIndex === -1) return null;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colIndex]) === String(value)) {
      var obj = {};
      for (var j = 0; j < headers.length; j++) obj[headers[j]] = data[i][j];
      return obj;
    }
  }
  return null;
}

/** Find a row INDEX (1-based) by column value. */
function findRowIndex(sheet, colName, value) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return 0;
  var headers = data[0];
  var colIndex = headers.indexOf(colName);
  if (colIndex === -1) return 0;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colIndex]) === String(value)) return i + 1; // 1-based row
  }
  return 0;
}

function addAudit(protocolId, actor, role, action, note) {
  var sheet = getSheet(SHEET_AUDIT);
  sheet.appendRow([Date.now().toString(36), protocolId || "", new Date().toISOString(), actor, role, action, note || ""]);
}

function getMemberNameByEmail(email) {
  var sheet = getSheet(SHEET_MEMBERS);
  var row = findRow(sheet, "email", email);
  return row ? row.name : email;
}

function addDaysStr(dateStr, days) {
  var d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Converts a sheet row array + parsed JSON data into a Protocol object the portal expects. */
function rowToProtocol(row, data) {
  data = data || {};
  return {
    id: row[0] || "",
    title: row[2] || data.title || "",
    type: data.type || "",
    focus: data.focus || "",
    category: data.category || "",
    pi: data.pi || "",
    piEmail: row[1] || data.piEmail || "",
    institution: data.institution || "",
    sponsor: data.sponsor || "",
    site: data.site || "",
    submitted: row[6] || data.submitted || "",
    status: row[3] || data.status || "submitted",
    reviewType: row[4] || data.reviewType || null,
    decision: row[5] || data.decision || null,
    decisionNote: data.decisionNote || "",
    votes: data.votes || null,
    reviewers: data.reviewers || [],
    reviews: data.reviews || [],
    docs: data.docs || [],
    history: data.history || [],
    summary: data.summary || "",
    consentLanguages: data.consentLanguages || "",
    vulnerable: data.vulnerable || "",
    continuingDue: data.continuingDue || null,
    letter: data.letter || null,
    amendment: data.amendment || null,
    assignedOn: data.assignedOn || null,
    submission: data.submission || {},
    declaration: data.declaration || { accepted: false, acceptedAt: "", piName: "", text: "" },
    scan: data.scan || null,
    revision: data.revision || null,
    documentVersions: data.documentVersions || [],
    documentComments: data.documentComments || [],
    initialProtocolLockedAt: data.initialProtocolLockedAt || null,
    submissionUpdateUntil: data.submissionUpdateUntil || null,
    submissionUpdatedAt: data.submissionUpdatedAt || null,
    finalProtocol: data.finalProtocol || null
  };
}

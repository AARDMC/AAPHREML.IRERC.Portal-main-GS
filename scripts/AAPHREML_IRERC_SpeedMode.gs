/**
 * AAPHREML-IRERC Google Apps Script — Speed Mode Integration
 * ===========================================================
 * Connects the two IRERC Google Sheets to the portal's webhook API so the
 * secretariat can manage the full review workflow without opening the web portal.
 *
 * ── SETUP (one-time) ────────────────────────────────────────────────────────
 * 1. Open this script in the Google Apps Script editor attached to EITHER sheet.
 * 2. Click Extensions → Apps Script (if not already open) and paste this file.
 * 3. Go to Project Settings → Script Properties and add:
 *      PORTAL_URL   →  https://your-portal-domain.com   (no trailing slash)
 *      API_KEY      →  <value of GS_API_KEY env var set on the portal server>
 * 4. Save and run onOpen() once to accept permissions.
 * 5. The "IRERC Speed Mode" menu will appear in both sheets.
 *
 * ── SHEET STRUCTURE EXPECTED ────────────────────────────────────────────────
 *
 * Scanner Table sheet (name contains "Scanner"):
 *   Col A  protocolId   e.g. AAPHREML-IRERC-2026-0001
 *   Col B  fileName
 *   Col C  completeness (number 0-100)
 *   Col D  present      (integer)
 *   Col E  total        (integer)
 *   Col F  missing      (comma-separated section names)
 *   Col G  title        (extracted)
 *   Col H  institution  (extracted)
 *   Col I  sampleSize   (extracted)
 *   Col J  studyPeriod  (extracted)
 *   Col K  email        (extracted)
 *   Col L  phone        (extracted)
 *   Col M  sentAt       (ISO timestamp — filled by script after push)
 *   Col N  status       (OK / Error / Pending)
 *
 * Database Table sheet (name contains "Database"):
 *   Row 1  = headers (auto-written on first sync)
 *   Rows 2+ = one protocol per row, columns as defined in DATABASE_COLS below.
 *   Col T   = "Action"  — type a speed-action verb here and run Speed > Execute
 *   Col U   = "Input"   — optional extra JSON or plain value for the action
 *   Col V   = "Result"  — filled by script after execution
 *
 * ── SPEED ACTIONS ───────────────────────────────────────────────────────────
 * Type one of these verbs in the "Action" column (Col R) of a protocol row,
 * then run  IRERC Speed Mode → Execute Selected Action.
 *
 *   startScreening      Start the administrative completeness check
 *   passScreening       Mark submission complete (all docs verified)
 *   correction          Return for correction  (put reason in Input col)
 *   classify            Set review type         (put type in Input col:
 *                         "Full Board Review" | "Expedited Review" | "Exemption Review")
 *   assignReviewers     Assign reviewers        (put names in Input col, comma-sep)
 *   placeOnAgenda       Add to committee meeting agenda
 *   saveDecision        Record committee decision (put JSON in Input col:
 *                         {"decision":"Approved","note":"","for":5,"against":0,"abstain":1})
 *   sendLetter          Issue action/clearance letter (put letter text in Input col)
 *   archiveProtocol     Archive a completed study
 *   requestRevision     Request PI revision     (put comments in Input col)
 *
 * ── NOTES ───────────────────────────────────────────────────────────────────
 * • The script acts as the role set in GS_SERVICE_ROLE on the portal server
 *   (default "secretariat"). The portal enforces all the same business rules.
 * • The API key is stored in Script Properties, never in the sheet cells.
 * • All timestamps are in UTC; the portal converts to Addis Ababa time.
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════

/** Column order for the Database Table. Must match gs-webhook.server.ts DatabaseRow. */
const DATABASE_COLS = [
  "protocolId",
  "title",
  "pi",
  "institution",
  "college",
  "email",
  "phone",
  "submitted",
  "status",
  "reviewType",
  "decision",
  "decisionNote",
  "reviewers",
  "scanCompleteness",
  "letter",
  "continuingDue",
  "lastAction",
  "lastActionDate",
  "lastActionActor",
  // Speed-mode columns (appended after data columns)
  "Action",
  "Input",
  "Result",
];

const ACTION_COL = DATABASE_COLS.indexOf("Action") + 1; // 1-based column index
const INPUT_COL = ACTION_COL + 1;
const RESULT_COL = ACTION_COL + 2;

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getPortalUrl() {
  const url = PropertiesService.getScriptProperties().getProperty("PORTAL_URL");
  if (!url) throw new Error("Script Property PORTAL_URL is not set. See setup instructions.");
  return url.replace(/\/$/, "");
}

function getApiKey() {
  const key = PropertiesService.getScriptProperties().getProperty("API_KEY");
  if (!key) throw new Error("Script Property API_KEY is not set. See setup instructions.");
  return key;
}

function portalPost(type, extraBody) {
  const url = getPortalUrl() + "/api/gs-webhook";
  const body = Object.assign({ type: type }, extraBody || {});
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(body),
    headers: { "X-GS-Api-Key": getApiKey() },
    muteHttpExceptions: true,
  };
  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();
  let json;
  try {
    json = JSON.parse(response.getContentText());
  } catch (e) {
    json = { error: response.getContentText() };
  }
  return { code: code, json: json };
}

function portalGet(params) {
  const url = getPortalUrl() + "/api/gs-webhook?" + Object.keys(params).map(function(k) {
    return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]);
  }).join("&");
  const options = {
    method: "get",
    headers: { "X-GS-Api-Key": getApiKey() },
    muteHttpExceptions: true,
  };
  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();
  let json;
  try {
    json = JSON.parse(response.getContentText());
  } catch (e) {
    json = { error: response.getContentText() };
  }
  return { code: code, json: json };
}

/** Find the sheet whose name contains the given keyword (case-insensitive). */
function findSheet(keyword) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().toLowerCase().indexOf(keyword.toLowerCase()) !== -1) {
      return sheets[i];
    }
  }
  return null;
}

function toast(msg, title, timeout) {
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, title || "IRERC Speed Mode", timeout || 4);
}

// ═══════════════════════════════════════════════════════════════════════════
// MENU
// ═══════════════════════════════════════════════════════════════════════════

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("⚡ IRERC Speed Mode")
    .addItem("🔄 Sync Database from Portal", "syncDatabaseFromPortal")
    .addSeparator()
    .addItem("📤 Push Scanner Results to Portal", "pushScannerResults")
    .addItem("🗂  Setup Scanner Sheet Headers", "setupScannerSheet")
    .addSeparator()
    .addItem("▶ Execute Selected Action (Database row)", "executeSelectedAction")
    .addSeparator()
    .addItem("🔁 Auto-sync every 10 min (toggle)", "toggleAutoSync")
    .addItem("📋 Setup instructions", "showSetupInstructions")
    .addToUi();
}

// ═══════════════════════════════════════════════════════════════════════════
// SYNC: Portal → Database Table sheet
// ═══════════════════════════════════════════════════════════════════════════

function syncDatabaseFromPortal() {
  toast("Pulling protocols from portal…", "Syncing…", 10);
  var result;
  try {
    result = portalGet({ type: "sync" });
  } catch (e) {
    SpreadsheetApp.getUi().alert("Network error: " + e.message);
    return;
  }

  if (result.code !== 200) {
    SpreadsheetApp.getUi().alert(
      "Sync failed (HTTP " + result.code + "): " + JSON.stringify(result.json)
    );
    return;
  }

  var protocols = result.json.protocols;
  if (!protocols || !protocols.length) {
    toast("No protocols returned from portal.", "Sync", 5);
    return;
  }

  var sheet = findSheet("Database");
  if (!sheet) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    sheet = ss.insertSheet("IRERC Database Table");
  }

  // Write header row
  sheet.getRange(1, 1, 1, DATABASE_COLS.length)
    .setValues([DATABASE_COLS])
    .setFontWeight("bold")
    .setBackground("#1a5276")
    .setFontColor("#ffffff");

  // Freeze header row
  sheet.setFrozenRows(1);

  // Build data rows preserving any existing Action/Input/Result values
  var existingData = sheet.getDataRange().getValues();
  var existingMap = {};
  for (var i = 1; i < existingData.length; i++) {
    var pid = existingData[i][0];
    if (pid) {
      existingMap[pid] = {
        action: existingData[i][ACTION_COL - 1] || "",
        input:  existingData[i][INPUT_COL - 1]  || "",
        result: existingData[i][RESULT_COL - 1] || "",
      };
    }
  }

  var rows = protocols.map(function(p) {
    var row = DATABASE_COLS.map(function(col) {
      if (col === "Action") return (existingMap[p.protocolId] || {}).action || "";
      if (col === "Input")  return (existingMap[p.protocolId] || {}).input  || "";
      if (col === "Result") return (existingMap[p.protocolId] || {}).result || "";
      return p[col] !== undefined && p[col] !== null ? String(p[col]) : "";
    });
    return row;
  });

  // Clear old data rows (keep header)
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, DATABASE_COLS.length).clearContent();
  }

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, DATABASE_COLS.length).setValues(rows);
  }

  // Colour-code status column (col 9 = "status")
  var statusCol = DATABASE_COLS.indexOf("status") + 1;
  applyStatusColors(sheet, rows.length, statusCol);

  // Auto-resize columns for readability
  sheet.autoResizeColumns(1, DATABASE_COLS.length);

  toast(
    "Synced " + protocols.length + " protocols (" + result.json.syncedAt + ")",
    "Sync complete ✓"
  );
}

var STATUS_COLORS = {
  "submitted":        "#d6eaf8",
  "screening":        "#d1f2eb",
  "correction":       "#fadbd8",
  "complete":         "#d1f2eb",
  "classified":       "#d1f2eb",
  "assigned":         "#d1f2eb",
  "reviewing":        "#fef9e7",
  "reviews_complete": "#d5f5e3",
  "revision":         "#fef9e7",
  "agenda":           "#fef9e7",
  "decided":          "#d6eaf8",
  "active":           "#d5f5e3",
  "archived":         "#f2f3f4",
};

function applyStatusColors(sheet, numRows, statusCol) {
  if (numRows < 1) return;
  var statusRange = sheet.getRange(2, statusCol, numRows, 1);
  var values = statusRange.getValues();
  var backgrounds = values.map(function(row) {
    var color = STATUS_COLORS[row[0]] || "#ffffff";
    return [color];
  });
  statusRange.setBackgrounds(backgrounds);
}

// ═══════════════════════════════════════════════════════════════════════════
// PUSH: Scanner Table → Portal
// ═══════════════════════════════════════════════════════════════════════════

var SCANNER_HEADERS = [
  "protocolId","fileName","completeness","present","total","missing",
  "title","institution","sampleSize","studyPeriod","email","phone",
  "sentAt","status"
];

/** Writes the Scanner Table header row if column A row 1 is empty. */
function ensureScannerHeaders(sheet) {
  if (!sheet.getRange(1, 1).getValue()) {
    sheet.getRange(1, 1, 1, SCANNER_HEADERS.length)
      .setValues([SCANNER_HEADERS])
      .setFontWeight("bold")
      .setBackground("#1a5276")
      .setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }
}

function pushScannerResults() {
  var sheet = findSheet("Scanner");
  if (!sheet) {
    SpreadsheetApp.getUi().alert(
      "No sheet with 'Scanner' in its name found.\n" +
      "Rename your Scanner Table sheet so the name contains the word 'Scanner'."
    );
    return;
  }

  ensureScannerHeaders(sheet);

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    toast("Scanner sheet is empty.", "Push", 4);
    return;
  }

  var pushed = 0;
  var errors = 0;

  // Start from row 2 (index 1) — skip header
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var protocolId   = String(row[0] || "").trim();
    var fileName     = String(row[1] || "").trim();
    var completeness = parseFloat(row[2]) || 0;
    var present      = parseInt(row[3])   || 0;
    var total        = parseInt(row[4])   || 0;
    var missingRaw   = String(row[5] || "").trim();
    var missing      = missingRaw ? missingRaw.split(",").map(function(s) { return s.trim(); }) : [];
    var sentAt       = row[12]; // Col M
    var status       = String(row[13] || "").trim(); // Col N

    // Skip rows that are already sent successfully or have no protocol ID
    if (!protocolId || status === "OK") continue;

    // Build checklist from missing list (best-effort reconstruction)
    var SECTION_NAMES = [
      "1. Title","2. Abstract","3. Background","4. Problem Statement","5. General Objective",
      "6. Specific Objectives","7. Literature Review","8. Study Area","9. Study Period",
      "10. Study Design","11. Source Population","12. Study Population","13. Inclusion Criteria",
      "14. Exclusion Criteria","15. Sample Size Determination","16. Sampling Technique",
      "17. Variables","18. Operational Definitions","19. Data Collection Tools",
      "20. Data Collection Procedure","21. Data Quality Assurance",
      "22. Data Processing and Analysis","23. Ethical Consideration",
      "24. Dissemination Plan","25. Work Plan / Time Schedule","26. Budget",
      "27. References","28. Annex / Appendix",
    ];
    var missingSet = {};
    missing.forEach(function(s) { missingSet[s] = true; });
    var checklist = SECTION_NAMES.map(function(s) {
      var bare = s.replace(/^\d+\.\s*/, "");
      return { section: s, present: !missingSet[bare] };
    });

    var payload = {
      protocolId: protocolId,
      fileName: fileName || "unknown",
      completeness: completeness,
      present: present,
      total: total || 28,
      missing: missing,
      checklist: checklist,
      extracted: {
        title:       String(row[6]  || "") || undefined,
        institution: String(row[7]  || "") || undefined,
        sampleSize:  String(row[8]  || "") || undefined,
        studyPeriod: String(row[9]  || "") || undefined,
        email:       String(row[10] || "") || undefined,
        phoneNumber: String(row[11] || "") || undefined,
      },
    };

    try {
      var result = portalPost("scan_result", payload);
      var rowNum = i + 1;
      if (result.code === 200 && result.json.ok) {
        sheet.getRange(rowNum, 13).setValue(new Date().toISOString()); // sentAt
        sheet.getRange(rowNum, 14).setValue("OK");
        sheet.getRange(rowNum, 14).setBackground("#d5f5e3");
        pushed++;
      } else {
        sheet.getRange(rowNum, 14).setValue("Error: " + (result.json.error || result.code));
        sheet.getRange(rowNum, 14).setBackground("#fadbd8");
        errors++;
      }
    } catch (e) {
      sheet.getRange(i + 1, 14).setValue("Error: " + e.message);
      errors++;
    }
  }

  toast(
    "Pushed " + pushed + " scan result(s). " + (errors > 0 ? errors + " error(s)." : ""),
    errors > 0 ? "Push complete with errors" : "Push complete ✓"
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SPEED ACTION: execute workflow action from Database Table row
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Maps the plain-English verb in the Action column to the portal action name
 * and builds the correct input object.
 */
function buildActionInput(verb, protocolId, inputRaw) {
  var v = verb.trim().toLowerCase().replace(/[^a-z]/g, "");
  var raw = (inputRaw || "").trim();

  // Helper: try to parse JSON, otherwise treat as plain string
  function tryJson(s, fallback) {
    try { return JSON.parse(s); } catch(e) { return fallback; }
  }

  switch (v) {
    case "startscreening":
      return { action: "startScreening", input: { id: protocolId } };

    case "passscreening":
      return { action: "passScreening", input: { id: protocolId } };

    case "correction":
    case "returnforcorrection":
      if (!raw) throw new Error("Put the correction note in the Input column.");
      return { action: "returnForCorrection", input: { id: protocolId, note: raw } };

    case "classify":
    case "classifyreviewtype": {
      var TYPES = ["Full Board Review", "Expedited Review", "Exemption Review"];
      var matched = TYPES.find(function(t) {
        return t.toLowerCase().indexOf(raw.toLowerCase()) !== -1 || raw.toLowerCase().indexOf(t.toLowerCase().split(" ")[0]) !== -1;
      });
      if (!matched) matched = raw || TYPES[0];
      return { action: "classify", input: { id: protocolId, reviewType: matched } };
    }

    case "assignreviewers": {
      if (!raw) throw new Error("Put reviewer names (comma-separated) in the Input column.");
      var names = raw.split(",").map(function(s) { return s.trim(); }).filter(Boolean);
      return { action: "assignReviewers", input: { id: protocolId, names: names } };
    }

    case "placeonagenda":
    case "agenda":
      return { action: "placeOnAgenda", input: { id: protocolId } };

    case "savedecision":
    case "decision": {
      // Accept plain decision name OR JSON object
      var decisionInput;
      if (raw.startsWith("{")) {
        decisionInput = tryJson(raw, null);
        if (!decisionInput) throw new Error("Input column JSON is invalid. Example: {\"decision\":\"Approved\",\"note\":\"\",\"for\":5,\"against\":0,\"abstain\":1}");
      } else {
        // plain: "Approved" / "Not Approved" etc. with default votes
        if (!raw) throw new Error("Put the decision (e.g. Approved) in the Input column.");
        decisionInput = { decision: raw, note: "", for: 4, against: 0, abstain: 0 };
      }
      return {
        action: "saveDecision",
        input: {
          id: protocolId,
          decision: decisionInput.decision,
          note: decisionInput.note || "",
          votes: {
            for:     decisionInput["for"]     || 0,
            against: decisionInput["against"] || 0,
            abstain: decisionInput["abstain"] || 0,
          },
        },
      };
    }

    case "sendletter":
    case "letter": {
      if (!raw) throw new Error("Put the letter text in the Input column.");
      return { action: "sendLetter", input: { id: protocolId, message: raw, continuingDue: "" } };
    }

    case "requestrevision":
    case "revision": {
      if (!raw) throw new Error("Put the revision comments in the Input column.");
      return { action: "requestRevision", input: { id: protocolId, comments: raw } };
    }

    case "archive":
    case "archiveprotocol":
      return { action: "archiveProtocol", input: { id: protocolId } };

    default:
      // Pass through raw action name + JSON input for advanced use
      return { action: verb.trim(), input: tryJson(raw, { id: protocolId }) };
  }
}

function executeSelectedAction() {
  var sheet = findSheet("Database");
  if (!sheet) {
    SpreadsheetApp.getUi().alert("No sheet with 'Database' in its name found. Run 'Sync Database from Portal' first.");
    return;
  }

  var activeRange = sheet.getActiveRange();
  if (!activeRange) {
    SpreadsheetApp.getUi().alert("Click a cell in the protocol row you want to action, then try again.");
    return;
  }

  var rowNum = activeRange.getRow();
  if (rowNum < 2) {
    SpreadsheetApp.getUi().alert("Select a data row (not the header row).");
    return;
  }

  var rowData = sheet.getRange(rowNum, 1, 1, DATABASE_COLS.length).getValues()[0];
  var protocolId = String(rowData[0] || "").trim();
  var verb       = String(rowData[ACTION_COL - 1] || "").trim();
  var inputRaw   = String(rowData[INPUT_COL - 1] || "").trim();

  if (!protocolId) {
    SpreadsheetApp.getUi().alert("Row " + rowNum + " has no protocol ID in column A.");
    return;
  }
  if (!verb) {
    SpreadsheetApp.getUi().alert(
      "Type an action verb in column " + columnLetter(ACTION_COL) + " of row " + rowNum + ".\n\n" +
      "Valid verbs:\n" +
      "startScreening, passScreening, correction, classify, assignReviewers,\n" +
      "placeOnAgenda, saveDecision, sendLetter, requestRevision, archiveProtocol"
    );
    return;
  }

  var ui = SpreadsheetApp.getUi();
  var confirm = ui.alert(
    "Confirm action",
    "Execute  "" + verb + ""  on  " + protocolId + "?" +
    (inputRaw ? "\n\nInput: " + inputRaw : ""),
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  // Build payload
  var mapped;
  try {
    mapped = buildActionInput(verb, protocolId, inputRaw);
  } catch (e) {
    sheet.getRange(rowNum, RESULT_COL).setValue("❌ " + e.message).setBackground("#fadbd8");
    SpreadsheetApp.getUi().alert("Input error: " + e.message);
    return;
  }

  toast("Running "" + mapped.action + "" on " + protocolId + "…", "Speed Mode", 8);

  var result;
  try {
    result = portalPost("speed_action", mapped);
  } catch (e) {
    sheet.getRange(rowNum, RESULT_COL).setValue("❌ Network: " + e.message).setBackground("#fadbd8");
    SpreadsheetApp.getUi().alert("Network error: " + e.message);
    return;
  }

  var resultCell = sheet.getRange(rowNum, RESULT_COL);
  if (result.code === 200 && result.json.ok) {
    resultCell.setValue("✓ " + (result.json.message || "OK") + " — " + new Date().toLocaleString());
    resultCell.setBackground("#d5f5e3");
    sheet.getRange(rowNum, ACTION_COL).clearContent(); // clear verb after success
    toast(result.json.message || "Action completed successfully.", "Done ✓", 5);
    // Trigger auto-refresh of the row from portal
    Utilities.sleep(1500);
    syncDatabaseFromPortal();
  } else {
    var errMsg = (result.json && result.json.message) || (result.json && result.json.error) || ("HTTP " + result.code);
    resultCell.setValue("❌ " + errMsg);
    resultCell.setBackground("#fadbd8");
    SpreadsheetApp.getUi().alert("Action failed:\n\n" + errMsg);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCANNER SHEET SETUP
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Writes the header row to the Scanner Table sheet.
 * Safe to run multiple times — only writes if row 1 col A is empty.
 */
function setupScannerSheet() {
  var sheet = findSheet("Scanner");
  if (!sheet) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    sheet = ss.insertSheet("IRERC Scanner Table");
  }
  // Always overwrite headers so they stay in sync with the script
  sheet.getRange(1, 1, 1, SCANNER_HEADERS.length)
    .setValues([SCANNER_HEADERS])
    .setFontWeight("bold")
    .setBackground("#154360")
    .setFontColor("#ffffff");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, SCANNER_HEADERS.length);

  // Add a note explaining each column
  var notes = [
    "Protocol ID (e.g. AAPHREML-IRERC-2026-0001)",
    "Original filename of scanned document",
    "Completeness % (0-100)",
    "Number of sections found",
    "Total sections checked (28)",
    "Missing section names (comma-separated)",
    "Extracted: study title",
    "Extracted: institution/affiliation",
    "Extracted: sample size",
    "Extracted: study period",
    "Extracted: contact email",
    "Extracted: phone number",
    "Auto-filled: timestamp when pushed to portal",
    "Auto-filled: OK / Error: <message>"
  ];
  for (var i = 0; i < notes.length; i++) {
    sheet.getRange(1, i + 1).setNote(notes[i]);
  }

  toast("Scanner sheet headers set up successfully.", "Setup ✓", 4);
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-SYNC TRIGGER
// ═══════════════════════════════════════════════════════════════════════════

function toggleAutoSync() {
  var triggers = ScriptApp.getProjectTriggers();
  var existing = triggers.filter(function(t) {
    return t.getHandlerFunction() === "syncDatabaseFromPortal";
  });

  if (existing.length > 0) {
    existing.forEach(function(t) { ScriptApp.deleteTrigger(t); });
    toast("Auto-sync disabled.", "Auto-sync", 4);
  } else {
    ScriptApp.newTrigger("syncDatabaseFromPortal")
      .timeBased()
      .everyMinutes(10)
      .create();
    toast("Auto-sync enabled — every 10 minutes.", "Auto-sync", 4);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════════════════

function columnLetter(n) {
  var s = "";
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function showSetupInstructions() {
  var msg =
    "AAPHREML-IRERC Speed Mode — Setup\n" +
    "═══════════════════════════════════\n\n" +
    "1. Open Extensions → Apps Script\n" +
    "2. Go to Project Settings → Script Properties\n" +
    "3. Add two properties:\n" +
    "     PORTAL_URL  →  https://your-deployed-portal.com\n" +
    "     API_KEY     →  (value of GS_API_KEY env var on the server)\n\n" +
    "4. On the portal server, set environment variable:\n" +
    "     GS_API_KEY=<any strong random string, e.g. 32 hex chars>\n" +
    "     GS_SERVICE_ROLE=secretariat  (or admin)\n\n" +
    "5. Run  ⚡ IRERC Speed Mode → Sync Database from Portal\n\n" +
    "Webhook URL:  https://your-portal.com/api/gs-webhook\n" +
    "Apps Script deployed URL (for push notifications from portal):\n" +
    "  " + ScriptApp.getService().getUrl();

  SpreadsheetApp.getUi().alert(msg);
}

// ═══════════════════════════════════════════════════════════════════════════
// OPTIONAL: receive push from portal (deploy as Web App to enable)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * If you deploy this script as a Web App (Publish → Deploy as Web App),
 * the portal can push protocol updates in real-time by calling:
 *   POST <web-app-url>?key=<PUSH_SECRET>
 * Set PUSH_SECRET in Script Properties and on the portal as GS_PUSH_SECRET.
 * The portal currently does not push automatically — this is available for
 * future use.
 */
function doPost(e) {
  var pushSecret = PropertiesService.getScriptProperties().getProperty("PUSH_SECRET") || "";
  var supplied   = (e.parameter && e.parameter.key) || "";
  if (pushSecret && supplied !== pushSecret) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Unauthorized" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var payload = JSON.parse(e.postData.contents);
    if (payload.type === "protocol_updated" || payload.type === "sync_push") {
      syncDatabaseFromPortal();
    }
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

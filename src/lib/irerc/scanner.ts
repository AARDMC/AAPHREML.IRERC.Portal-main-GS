import type { ScanChecklistItem, ScanResult } from "@/lib/irerc/model";

/**
 * Client-side equivalent of the IRERC Word-document scanner.
 *
 * The production Apps Script version converts the uploaded Word file to a
 * Google Doc and checks the same 28 required protocol sections. In the React
 * portal the document is parsed in the browser, so no file leaves the device.
 */
export const PROTOCOL_SECTIONS: Record<string, string[]> = {
  "1. Title": ["title page", "cover page", "research title", "study title", "project title", "thesis title"],
  "2. Abstract": ["abstract", "executive summary", "project summary", "research summary", "synopsis"],
  "3. Background": ["background", "background of the study", "study background", "introduction"],
  "4. Problem Statement": ["problem statement", "statement of the problem", "research problem", "problem justification"],
  "5. General Objective": ["general objective", "broad objective", "main objective", "overall objective", "aim of the study"],
  "6. Specific Objectives": ["specific objectives", "specific objective", "specific aims"],
  "7. Literature Review": ["literature review", "review of literature", "review of related literature", "conceptual framework", "theoretical framework"],
  "8. Study Area": ["study area", "study setting", "study site", "description of study area"],
  "9. Study Period": ["study area and period", "study setting and period", "study design and period", "study period", "period of study", "duration of study", "data collection period"],
  "10. Study Design": ["study design", "research design", "research methodology", "research approach"],
  "11. Source Population": ["source population", "reference population"],
  "12. Study Population": ["study population", "target population", "population of interest", "study subjects", "study participants"],
  "13. Inclusion Criteria": ["inclusion and exclusion criteria", "inclusion criteria", "eligibility criteria", "selection criteria"],
  "14. Exclusion Criteria": ["inclusion and exclusion criteria", "exclusion criteria", "ineligibility criteria"],
  "15. Sample Size Determination": ["sample size determination", "sample size calculation", "sample size", "power calculation", "power analysis"],
  "16. Sampling Technique": ["sampling technique", "sampling procedure", "sampling method", "sampling strategy", "participant recruitment"],
  "17. Variables": ["study variables", "variables of the study", "dependent and independent variables", "dependent variables", "independent variables", "outcome variables"],
  "18. Operational Definitions": ["operational definition", "definition of terms", "definitions of terms", "working definitions"],
  "19. Data Collection Tools": ["data collection tools", "data collection instrument", "study instrument", "research instrument", "survey instrument"],
  "20. Data Collection Procedure": ["data collection procedure", "data collection method", "methods of data collection", "field procedures", "study procedures"],
  "21. Data Quality Assurance": ["data quality assurance", "data quality management", "data quality control", "quality assurance", "quality control", "validity and reliability"],
  "22. Data Processing and Analysis": ["data processing and analysis", "data analysis", "statistical analysis", "data management", "data analysis plan", "data entry and analysis"],
  "23. Ethical Consideration": ["ethical consideration", "ethical clearance", "ethical approval", "ethical issues", "research ethics", "informed consent"],
  "24. Dissemination Plan": ["dissemination plan", "dissemination of results", "dissemination", "publication plan", "knowledge translation"],
  "25. Work Plan / Time Schedule": ["work plan", "time schedule", "timeline", "gantt chart", "activity schedule", "work schedule"],
  "26. Budget": ["budget", "cost estimate", "budget breakdown", "estimated budget", "project budget"],
  "27. References": ["references", "bibliography", "reference list"],
  "28. Annex / Appendix": ["annex", "appendix", "appendices", "questionnaire", "consent form", "interview guide", "data collection form"],
};

export const SECTION_NAMES = Object.keys(PROTOCOL_SECTIONS);
export const SECTION_TOTAL = SECTION_NAMES.length;

const STOP_TITLE = /^(by|submitted|prepared by|presented by|a (proposal|thesis|research|dissertation)|proposal submitted|name|advisor|date)\b/i;
const INSTITUTION_WORD = /\b(college|university|institute|school|department|faculty|ministry|republic)\b/i;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeScanText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function detectTitle(text: string): string | null {
  const normalized = normalizeScanText(text).toLowerCase();
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 40);

  const block: string[] = [];
  for (const line of lines) {
    if (STOP_TITLE.test(line)) {
      if (block.length) break;
      continue;
    }
    if (/^(table of contents|contents|abstract|acknowledg)/i.test(line)) break;
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length >= 4 && !INSTITUTION_WORD.test(line)) block.push(line);
    else if (block.length) break;
  }

  const title = block.join(" ").trim();
  return title.split(/\s+/).length >= 6 ? title : null;
}

function sectionPresent(normalized: string, section: string, patterns: string[]): boolean {
  if (section === "1. Title") {
    const title = detectTitle(normalized);
    if (title) return true;
  }

  const lines = normalized.split("\n").map((line) => line.trim());
  for (const pattern of patterns) {
    const clean = pattern.replace(/[^a-z0-9\s]/gi, " ").trim();
    if (!clean) continue;

    // Match a heading line such as "3. Background" or "Background of the study"
    const headingPattern = new RegExp(
      `(?:^|\\n|\\s)(?:\\d+\\.?\\s*)?(?:[-•*]\\s*)?${escapeRegex(clean).replace(/\\s+/g, "\\s+")}(?:\\s*[:.-])?(?:\\s|$)`,
      "i",
    );
    if (lines.some((line) => line.length > 0 && line.length <= 120 && headingPattern.test(line))) {
      return true;
    }

    // Match the phrase anywhere in the document body, allowing for line-wraps
    const words = clean.split(/\s+/).map((word) => escapeRegex(word));
    const flexible = words.join("\\s+");
    if (new RegExp(`\\b${flexible}\\b`, "i").test(normalized)) return true;
  }

  return false;
}

function findLabelValue(text: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const escaped = escapeRegex(label);
    const match = new RegExp(`(?:^|\\n)\\s*(?:[\\d.]+\\s*)?${escaped}\\s*[:\\-]\\s*([^\\n]+)`, "i").exec(text);
    if (match?.[1]) {
      const value = match[1].replace(/[\r\n]+/g, " ").replace(/[\s,;:.-]+$/, "").trim();
      if (value.length > 1 && value.length < 300) return value;
    }
  }
  return undefined;
}

function extractFields(text: string): ScanResult["extracted"] {
  const email = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.exec(text)?.[0];
  const phone = /(?:\+?\d{1,3}[-\s.]?)?\(?\d{2,3}\)?[-\s.]?\d{3}[-\s.]?\d{3,4}/.exec(text)?.[0];
  const sample =
    findLabelValue(text, ["sample size", "number of participants", "sample size determination"]) ??
    /(?:n\s*=\s*|sample of\s+)(\d[\d,]{1,7})/i.exec(text)?.[1];
  return {
    title: detectTitle(text) ?? undefined,
    institution: findLabelValue(text, ["institution", "host institution", "affiliation", "organization", "university"]),
    sampleSize: sample?.replace(/,/g, ""),
    studyPeriod: findLabelValue(text, ["study area and period", "study period", "period of study", "duration of study", "time frame"]),
    email,
    phoneNumber: phone,
  };
}

/** Scans plain text extracted from a complete protocol document. */
export function scanProtocolText(text: string, fileName: string): ScanResult {
  const normalized = normalizeScanText(text).toLowerCase();
  const checklist: ScanChecklistItem[] = SECTION_NAMES.map((section) => ({
    section,
    present: sectionPresent(normalized, section, PROTOCOL_SECTIONS[section]!),
  }));
  const present = checklist.filter((item) => item.present).length;
  const missing = checklist.filter((item) => !item.present).map((item) => item.section.replace(/^\d+\.\s*/, ""));
  return {
    fileName,
    scannedAt: new Date().toISOString(),
    total: SECTION_TOTAL,
    present,
    completeness: Math.round((present / SECTION_TOTAL) * 1000) / 10,
    missing,
    checklist,
    extracted: extractFields(text),
  };
}

/**
 * Extracts text from the uploaded complete protocol. Word (.docx) and plain
 * text are accepted; the production scanner also rejects PDF and legacy .doc.
 */
export async function scanProtocolFile(file: File): Promise<ScanResult> {
  const name = file.name;
  if (/\.(docx)$/i.test(name)) {
    const mammoth = (await import("mammoth")).default;
    const arrayBuffer = await file.arrayBuffer();
    let text = "";

    try {
      const result = await mammoth.extractRawText({ arrayBuffer, buffer: arrayBuffer } as {
        arrayBuffer: ArrayBuffer;
      });
      text = result.value?.trim() ?? "";
    } catch {
      text = "";
    }

    // Some Word documents render headings/tables better in HTML conversion than in
    // raw-text extraction. Use the fallback when the raw text is too short to be
    // reliable.
    if (!text || text.length < 100) {
      try {
        const htmlResult = await mammoth.convertToHtml({ arrayBuffer, buffer: arrayBuffer } as {
          arrayBuffer: ArrayBuffer;
        });
        text = (htmlResult.value ?? "")
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<li>/gi, "\n• ")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/gi, " ")
          .replace(/&amp;/gi, "&")
          .replace(/&lt;/gi, "<")
          .replace(/&gt;/gi, ">")
          .replace(/\s+/g, " ")
          .trim();
      } catch {
        // Ignore fallback failure and keep the raw text path.
      }
    }

    if (text.length < 100) {
      throw new Error("The Word document appears to be empty or unreadable. Upload the complete protocol with its text.");
    }
    return scanProtocolText(text, name);
  }
  if (/\.(txt|md)$/i.test(name)) {
    const text = (await file.text()).trim();
    if (text.length < 100) throw new Error("The text document is empty or too short to scan.");
    return scanProtocolText(text, name);
  }
  if (/\.(doc)$/i.test(name)) {
    throw new Error("Legacy .doc files cannot be scanned in the browser. Save the document as .docx and upload it again.");
  }
  if (/\.(pdf)$/i.test(name)) {
    throw new Error("The structural scanner needs a Word document. Upload the .docx file (PDF is not accepted).");
  }
  throw new Error("Upload the complete protocol as a .docx or .txt file.");
}

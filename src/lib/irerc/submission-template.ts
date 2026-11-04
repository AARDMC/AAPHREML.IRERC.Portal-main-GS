import type { OfficialSubmission, ScanResult } from "@/lib/irerc/model";

/** Exact option lists from the AAPHREML-IRERC Research Protocol Submission. */
export const COLLEGES = [
  "Yekatit 12 Hospital Medical College",
  "Menelik II Medical & Health Science College",
  "Addis Ababa University School of public health",
  "St.Paul Millinium Medical College",
  "Addis Ababa Medical & Bussiness College",
  "Africa Medical College",
  "kea-Med Medical College",
  "Ayer Tena health science college",
  "Atlas College of Health Sciences",
  "Addis Continental Institute of Public Health",
  "Rift Valley University",
  "Bethel Medical College",
  "Sante Medical College",
  "St. Lideta Health Science & Business College",
  "Tropical College of Medicine",
  "Universal Medical & Business College",
  "Seven Star Health Science & Business College",
  "Alkan Medical College",
  "GAMBY Medical & Business College",
  "Hayat Medical College",
  "Lorcan Medical College",
  "Yanet College",
  "Myungsung Medical College (MMC)",
  "Nordic Medical Center Learning Institute",
  "Ecusta Higher Learning Institute",
  "Addis Ababa Public Health Research and Emergency Management | AAPHREM",
  "KARVARD College",
  "UNISA",
  "Unity College",
  "Medico Biomedical College",
];

export const DEPARTMENTS = [
  "Nursing",
  "Health Officer",
  "Laboratory Technology",
  "Pharmacy",
  "Health Education",
  "Environmental Health",
  "Anesthesia",
  "Health Informatics",
  "General Public Health",
  "Human Nutrition",
  "Health Service Management",
  "Accelerated Medicine",
  "Field Epidemiology",
  "Biostatistics",
  "Dental Medicine",
  "Adult Health Nursing",
  "Medical Radiology",
  "Public Health in nutrition",
  "Epidemiology",
  "Microbiology",
  "Monitoring & Evaluation",
  "Integrated community and clinical mental health",
  "Medical Laboratory Science",
  "Reproductive Health",
];

export const HEALTH_FOCUS = [
  "Food and nutrition",
  "Communicable diseases",
  "Non-communicable diseases",
  "Reproductive, maternal, newborn, and child health",
  "Neglected tropical diseases",
  "Water, Sanitation & Hygiene",
  "Mental health and well-being",
  "Environmental and workplace health",
  "Health service planning & management",
  "Digital health technology",
  "Prevention and detection of diseases/PHEM",
  "Health and Human Services/Health Workforce",
  "Disability & Rehabilitation",
];

export const FREQUENCIES = [
  "Daily",
  "Weekly",
  "Monthly",
  "Quarterly",
  "Annual and biannual",
  "Real-time/Near real-time/Continuous",
  "Static/Single implementation",
  "Unknown/No info",
];

export const STUDY_DESIGNS = [
  "Cross-sectional study",
  "Case-control study",
  "Cohort study",
  "QUASI Experimental",
  "Mixed methods",
  "Randomized Controlled Trial",
  "Systematic Review & Meta Analysis",
  "Case series",
];

export const TRIAL_OPTIONS = [
  "Randomized",
  "Stratified Randomized",
  "Open-labeled",
  "Double blinded",
  "Placebo controlled",
  "Treatment controlled",
  "Cross-over",
  "Parallel",
  "Interim Analysis",
  "Use of Tissue samples",
  "Use of Blood samples",
  "Use of genetic materials",
  "Multicenter study",
  "Screening",
  "Descriptive",
];

export const GEO_OPTIONS = [
  "National",
  "Region | City",
  "Zone | Sub City",
  "Woreda",
  "Kebele",
  "Program/research implementation woreda or kebele",
  "Departmental",
  "Not representative",
  "Facility",
  "Global",
];

export const TARGET_GROUPS = [
  "Persons, individuals, and patients",
  "Health care providers/Doctors, nurses, etc",
  "Households",
  "Healthcare sites and systems/Hospitals, ambulatory care facilities, provider offices, etc.",
];

export const TOOL_OPTIONS = [
  "Self-administered questionnaires",
  "Paper-based face-to-face interviews",
  "In-person paper survey",
  "Telephone-based interviews",
  "Direct examinations",
  "Electronic data collection",
  "Record review",
  "FGD and KII",
];

export const FUNDING_OPTIONS = [
  "Public/Government",
  "Private | Non-governmental | organizations (NGOs) | Foundations",
  "Both public and private",
  "Self Sponsored",
];

export const DATA_FORMATS = [
  "Microsoft Excel files (.xls or .xlsx)",
  "Delimited files (csv, .tsv, .tab, or .txt)",
  "SPSS (.sav)",
  "Stata (.dta)",
  "R (.r)",
  "Atlas.ti",
  "Nvivo",
  "ODK",
  "Epi-info",
];

export const SUBMISSION_STEPS = [
  { title: "Investigator", detail: "Your institution, activity type, and contact details." },
  { title: "Study focus", detail: "What the study is about and when data will be collected." },
  { title: "Methodology", detail: "Approach, design, sample size, and study objectives." },
  { title: "Location and population", detail: "Where the study takes place and target population." },
  { title: "Data management", detail: "How data is collected, formatted, and shared." },
  { title: "Funding", detail: "Who finances the study and allocated budget." },
  { title: "Documents", detail: "Upload required files with the 28-section proposal check." },
  { title: "Review and submit", detail: "Confirm data sharing and the PI declaration." },
] as const;

export const DATA_SHARING_TEXT =
  "I formally acknowledge that upon completion of this health research project or academic thesis, I shall submit all cleaned datasets and final reports to my college and the Addis Ababa Public Health Research and Emergency Management (AAPHREM) repository. The bureau shall have authorized access to data for public health surveillance and policy under mutual agreement.";

/**
 * The exact PI declaration supplied by the institution. Do not paraphrase:
 * it is retained in the protocol record with the acceptance timestamp.
 */
export const DECLARATION_TEXT =
  "I hereby declare that the informed consent process for this study will be conducted in accordance with AAPHREML-IRERC requirements. I confirm that participants will receive clear information about the study, including its purpose, procedures, potential risks, benefits, privacy and confidentiality, and voluntary participation. Consent will be obtained by appropriately trained study personnel, before any study procedures, in a private and appropriate setting, using language understandable to participants. Adequate time will be provided for questions and consideration, without coercion or undue influence.";

export function blankSubmission(piName = "", piEmail = ""): OfficialSubmission {
  return {
    code: "",
    college: "",
    collegeOther: "",
    department: "",
    departmentOther: "",
    activityType: "",
    activityTypeOther: "",
    educationLevel: "",
    educationLevelOther: "",
    projectOutcomesTangible: "",
    projectOutcomesPublications: "",
    projectIndicators: "",
    projectMonitoringFreq: "",
    projectFeedbackMechanisms: "",
    projectSustainability: "",
    projectBudgetBreakdown: "",
    projectBudgetJustification: "",
    advisorName: "",
    advisorEmail: "",
    advisorPhone: "",
    piName,
    piPhone: "",
    piEmail,
    studyTitle: "",
    healthFocus: "",
    healthFocusOther: "",
    dataStart: "",
    dataEnd: "",
    frequency: "",
    methods: "",
    sampleSize: "",
    studyDesign: "",
    studyDesignOther: "",
    clinicalTrial: [],
    generalObjective: "",
    specificObjectives: "",
    geoCoverage: "",
    geoCoverageOther: "",
    specificSite: "",
    gender: "",
    targetGroup: "",
    targetGroupOther: "",
    electronic: "",
    gps: "",
    tools: "",
    toolsOther: "",
    dataFormat: [],
    accessibility: "",
    restrictionReason: "",
    funding: "",
    fundingOther: "",
    budget: "",
    files: { supportingLetter: null, piId: null, proposalDoc: null, cv: null },
    acknowledge: false,
    declarationAccepted: false,
  };
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Mirrors the production validator, including skip patterns and the 95% scan gate. */
export function validateSubmissionStep(step: number, form: OfficialSubmission, scan: ScanResult | null): string | null {
  if (step === 1) {
    if (!form.college) return "Please select your College or University.";
    if (form.college === "Other:" && !form.collegeOther.trim()) return "Please specify your College name.";
    if (!form.department) return "Please select your Department.";
    if (form.department === "Other:" && !form.departmentOther.trim()) return "Please specify your Department name.";
    if (!form.activityType) return "Please select the Type of Activity.";
    if (form.activityType === "Survey/Study" && !form.educationLevel) return "Please select your Education Level.";
    if (form.activityType === "Project") {
      if (!form.projectOutcomesTangible.trim()) return "Tangible results are required.";
      if (!form.projectOutcomesPublications.trim()) return "Publications/tools description is required.";
      if (!form.projectIndicators.trim()) return "Indicators are required.";
      if (!form.projectMonitoringFreq) return "Monitoring frequency is required.";
      if (!form.projectFeedbackMechanisms.trim()) return "Feedback mechanisms are required.";
      if (!form.projectSustainability.trim()) return "Sustainability plan is required.";
      if (!form.projectBudgetBreakdown.trim()) return "Budget breakdown is required.";
      if (!form.projectBudgetJustification.trim()) return "Budget justification is required.";
    }
    if (!form.advisorName.trim()) return "Advisor name is required.";
    if (!form.advisorEmail.trim() || !EMAIL.test(form.advisorEmail.trim())) return "A valid Advisor email address is required.";
    if (!form.advisorPhone.trim()) return "Advisor telephone is required.";
    if (!form.piName.trim()) return "Principal Investigator name is required.";
    if (!form.piPhone.trim()) return "PI telephone is required.";
    if (!form.piEmail.trim() || !EMAIL.test(form.piEmail.trim())) return "A valid PI email address is required.";
  }
  if (step === 2) {
    if (!form.studyTitle.trim() || form.studyTitle.trim().length < 5) return "Full Study Title is required.";
    if (!form.healthFocus) return "Health Focus Area is required.";
    if (form.healthFocus === "Other:" && !form.healthFocusOther.trim()) return "Please specify Health Focus Area.";
    if (!form.dataStart) return "Data collection start date is required.";
    if (!form.dataEnd) return "Data collection end date is required.";
    if (form.dataEnd < form.dataStart) return "Data collection cannot end before it begins.";
    if (!form.frequency) return "Frequency of data collection is required.";
  }
  if (step === 3) {
    if (!form.methods) return "Research approach is required.";
    if (!form.sampleSize || Number(form.sampleSize) < 1) return "Sample size must be at least 1.";
    if (!form.studyDesign) return "Study design is required.";
    if (form.studyDesign === "Other:" && !form.studyDesignOther.trim()) return "Please specify Study Design.";
    if ((form.studyDesign === "Randomized Controlled Trial" || form.studyDesign === "QUASI Experimental") && !form.clinicalTrial.length) {
      return "Please select at least one Clinical Trial attribute.";
    }
    if (!form.generalObjective.trim()) return "General objective is required.";
    if (!form.specificObjectives.trim()) return "Specific objectives are required.";
  }
  if (step === 4) {
    if (!form.geoCoverage) return "Geographic coverage is required.";
    if (form.geoCoverage === "Other:" && !form.geoCoverageOther.trim()) return "Please specify Geographic Coverage.";
    if (!form.specificSite.trim()) return "Specific study site is required.";
    if (!form.gender) return "Sex or gender specification is required.";
    if (!form.targetGroup) return "Target population group is required.";
  }
  if (step === 5) {
    if (!form.electronic) return "Electronic data collection answer is required.";
    if (!form.gps) return "GPS collection answer is required.";
    if (!form.tools) return "Data collection tools selection is required.";
    if (!form.dataFormat.length) return "Please select at least one cleaned data format.";
    if (!form.accessibility) return "Data sharing accessibility is required.";
    if (form.accessibility === "Not accessible" && !form.restrictionReason.trim()) {
      return "Please explain why data is restricted from sharing.";
    }
  }
  if (step === 6) {
    if (!form.funding) return "Funding source is required.";
    if (form.funding === "Other:" && !form.fundingOther.trim()) return "Please specify funding source.";
    if (form.budget === "" || Number(form.budget) < 0) return "Budget cannot be negative.";
  }
  if (step === 7) {
    if (!scan) return "Please upload the proposal Word document and wait for the structure check.";
    if (scan.completeness < 95) {
      return `The proposal is ${scan.completeness}% complete. At least 95% of the 28 required sections is required. Amend the document and scan again.`;
    }
    if (!form.files.supportingLetter) return "Please upload the institutional supporting letter.";
    if (!form.files.piId) return "Please upload PI identification.";
    if (!form.files.proposalDoc) return "Please upload a proposal Word document (.docx or .doc) that passes the structure check.";
    if (!form.files.cv) return "Please upload the investigator CV.";
  }
  if (step === 8) {
    if (!form.acknowledge) return "You must agree to the institutional data sharing terms before submitting.";
    if (!form.declarationAccepted) return "You must confirm the Principal Investigator's Informed Consent Declaration.";
  }
  return null;
}

export function displayValue(value: string, other?: string): string {
  return value === "Other:" ? other?.trim() || "Other" : value;
}

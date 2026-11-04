import { useState, type ReactNode } from "react";
import { Check, FileText, Paperclip, ShieldCheck } from "lucide-react";
import { useIrerc } from "@/lib/irerc/store";
import {
  isSubmissionUpdateOpen,
  nextProtocolId,
  type DocumentVersion,
  type OfficialSubmission,
  type Protocol,
  type ScanResult,
  type SubmissionFile,
} from "@/lib/irerc/model";
import {
  COLLEGES,
  DATA_FORMATS,
  DATA_SHARING_TEXT,
  DECLARATION_TEXT,
  DEPARTMENTS,
  FREQUENCIES,
  FUNDING_OPTIONS,
  GEO_OPTIONS,
  HEALTH_FOCUS,
  STUDY_DESIGNS,
  SUBMISSION_STEPS,
  TARGET_GROUPS,
  TOOL_OPTIONS,
  TRIAL_OPTIONS,
  blankSubmission,
  displayValue,
  validateSubmissionStep,
} from "@/lib/irerc/submission-template";
import { Btn, Field, Modal, fieldClass } from "@/components/irerc/ui";
import { ProposalScanner } from "@/components/irerc/proposal-scanner";
import { saveDocument } from "@/lib/irerc/file-store";
import { REMOTE, submitRemote, updateRemote } from "@/lib/irerc/remote";

// Keep the browser upload limit aligned with the server-side document cap in
// src/lib/irerc/server/protocols.server.ts (3 MB). The previous 5 MB browser
// limit allowed files that the server would reject during submission.
const MAX_FILE = 3 * 1024 * 1024;
const DOC_CODES = {
  supportingLetter: "DOC_SUPPORT",
  piId: "DOC_PI_ID",
  proposalDoc: "DOC_PROTOCOL",
  cv: "DOC_CV",
} as const;

export function SubmitModal({ onClose, editProtocol }: { onClose: () => void; editProtocol?: Protocol }) {
  const submit = useIrerc((s) => s.submitProtocol);
  const update = useIrerc((s) => s.updateSubmission);
  const protocols = useIrerc((s) => s.protocols);
  const editing = Boolean(editProtocol);
  const proposalLocked = Boolean(editProtocol?.initialProtocolLockedAt);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(editProtocol?.scan ?? null);
  const [rawFiles, setRawFiles] = useState<Partial<Record<"supportingLetter" | "piId" | "proposalDoc" | "cv", File>>>({});
  const [form, setForm] = useState<OfficialSubmission>(() =>
    editProtocol
      ? { ...editProtocol.submission, code: editProtocol.id }
      : { ...blankSubmission(), code: nextProtocolId(protocols) },
  );

  const set = <K extends keyof OfficialSubmission>(key: K, value: OfficialSubmission[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  function next() {
    const message = validateSubmissionStep(step + 1, form, scan);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setStep((value) => Math.min(7, value + 1));
  }

  function back() {
    setError(null);
    setStep((value) => Math.max(0, value - 1));
  }

  function doSubmit() {
    for (let i = 0; i < 8; i += 1) {
      const message = validateSubmissionStep(i + 1, form, scan);
      if (message) {
        setStep(i);
        setError(message);
        return;
      }
    }
    if (editing) {
      void saveAndUpdate();
      return;
    }
    if (!rawFiles.proposalDoc) {
      setStep(6);
      setError("Upload the Word proposal file itself, not only pasted text, so reviewers can open it.");
      return;
    }
    void saveAndSubmit();
  }

  async function saveAndSubmit() {
    setError(null);
    if (REMOTE) {
      try {
        const protocol = await submitRemote(form, rawFiles, DOC_CODES, draftId, setDraftId);
        useIrerc.setState({ modal: null, selectedId: protocol.id, view: "detail", returnView: "protocols" });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "The submission could not be saved on the server.");
      }
      return;
    }
    try {
      await Promise.all(
        (Object.keys(rawFiles) as (keyof typeof rawFiles)[]).map((key) => {
          const file = rawFiles[key];
          return file ? saveDocument(form.code, DOC_CODES[key], file) : Promise.resolve();
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The documents could not be stored in this browser.");
      return;
    }
    submit({ form, scan });
  }

  async function saveAndUpdate() {
    if (!editProtocol) return;
    if (!isSubmissionUpdateOpen(editProtocol)) {
      setError("The 48-hour update window has closed or the application has been forwarded to reviewers.");
      return;
    }
    if (scan?.fileName === "Pasted protocol text" && !rawFiles.proposalDoc) {
      setError("Upload the replacement Word proposal file when you rescan the proposal.");
      return;
    }
    setError(null);
    if (REMOTE) {
      try {
        await updateRemote(editProtocol.id, form, rawFiles, DOC_CODES);
        useIrerc.setState({ modal: null });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "The submission could not be updated on the server.");
      }
      return;
    }
    try {
      const versions: DocumentVersion[] = [];
      for (const key of Object.keys(rawFiles) as (keyof typeof rawFiles)[]) {
        const file = rawFiles[key];
        if (!file) continue;
        const code = DOC_CODES[key];
        const nextVersion =
          (editProtocol.documentVersions ?? [])
            .filter((version) => version.code === code)
            .reduce((max, version) => Math.max(max, version.version), 0) + 1;
        await saveDocument(editProtocol.id, code, file, nextVersion);
        versions.push({
          code,
          version: nextVersion,
          name: file.name,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString(),
          uploadedBy: form.piName.trim(),
          note: "Submission update",
        });
      }
      update(editProtocol.id, { form, scan, versions });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The updated documents could not be stored.");
    }
  }

  function pickFile(key: keyof OfficialSubmission["files"], file: File | undefined, accept: RegExp, label: string) {
    if (!file) return;
    if (file.size > MAX_FILE) {
      setError(`${label} must be 5 MB or smaller.`);
      return;
    }
    if (!accept.test(file.name)) {
      setError(`${label} has an unsupported file type.`);
      return;
    }
    const record: SubmissionFile = { name: file.name, size: file.size, type: file.type };
    setForm((prev) => ({ ...prev, files: { ...prev.files, [key]: record } }));
    setRawFiles((prev) => ({ ...prev, [key]: file }));
    setError(null);
  }

  function clearFile(key: keyof OfficialSubmission["files"]) {
    setForm((prev) => ({ ...prev, files: { ...prev.files, [key]: null } }));
    setRawFiles((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function handleScan(result: ScanResult | null) {
    setScan(result);
    setForm((prev) => ({
      ...prev,
      files: {
        ...prev.files,
        proposalDoc: result
          ? { name: result.fileName, size: 0, type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }
          : null,
      },
    }));
    if (!result || result.fileName === "Pasted protocol text") {
      setRawFiles((prev) => {
        const next = { ...prev };
        delete next.proposalDoc;
        return next;
      });
    }
  }

  function applyExtracted(extracted: ScanResult["extracted"]) {
    setForm((prev) => {
      const collegeMatch = extracted.institution
        ? COLLEGES.find((college) => college.toLowerCase() === extracted.institution?.toLowerCase())
        : undefined;
      return {
        ...prev,
        studyTitle: prev.studyTitle || extracted.title || "",
        piEmail: prev.piEmail || extracted.email || "",
        piPhone: prev.piPhone || extracted.phoneNumber || "",
        sampleSize: prev.sampleSize || extracted.sampleSize || "",
        college: prev.college || collegeMatch || (extracted.institution ? "Other:" : ""),
        collegeOther: prev.collegeOther || (collegeMatch ? "" : extracted.institution || ""),
      };
    });
  }

  return (
    <Modal
      title={editing ? "Update Submission" : "Research Protocol Submission"}
      onClose={onClose}
      wide
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          {step > 0 ? <Btn onClick={back}>Back</Btn> : null}
          {step < 7 ? (
            <Btn kind="primary" onClick={next}>Continue</Btn>
          ) : (
            <Btn kind="go" onClick={doSubmit}>{editing ? "Save updates" : "Submit protocol"}</Btn>
          )}
        </>
      }
    >
      <div className="mb-4 flex flex-wrap gap-1.5" aria-label="Submission steps">
        {SUBMISSION_STEPS.map((item, index) => (
          <button
            key={item.title}
            type="button"
            onClick={() => {
              if (index < step) setStep(index);
            }}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
              index === step
                ? "border-sky bg-sky/15 text-sky"
                : index < step
                  ? "border-em text-em"
                  : "border-line text-muted"
            }`}
          >
            {index + 1}. {item.title}
          </button>
        ))}
      </div>
      <div className="mb-4 rounded-2xl border border-sky/20 bg-gradient-to-br from-sky/15 via-panel to-em/10 p-4">
        <p className="text-xs font-bold tracking-[0.14em] text-sky uppercase">Step {step + 1} of 8</p>
        <h3 className="mt-1 text-xl font-semibold text-fg">{SUBMISSION_STEPS[step]!.title}</h3>
        <p className="mt-1 text-sm text-muted">{SUBMISSION_STEPS[step]!.detail}</p>
      </div>

      {step === 0 ? (
        <div>
          <SectionLabel>Institution and activity</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Protocol Code *">
              <input className={`${fieldClass} bg-panel-2 text-muted`} value={form.code} readOnly />
            </Field>
            <Field label="College or University *">
              <select className={fieldClass} value={form.college} onChange={(e) => set("college", e.target.value)}>
                <option value="">Select your college / university</option>
                {COLLEGES.map((college) => <option key={college}>{college}</option>)}
                <option value="Other:">Other (specify)</option>
              </select>
              {form.college === "Other:" ? (
                <input className={`${fieldClass} mt-2`} placeholder="Specify college name" value={form.collegeOther} onChange={(e) => set("collegeOther", e.target.value)} />
              ) : null}
            </Field>
            <Field label="Department *">
              <select className={fieldClass} value={form.department} onChange={(e) => set("department", e.target.value)}>
                <option value="">Select your academic department</option>
                {DEPARTMENTS.map((department) => <option key={department}>{department}</option>)}
                <option value="Other:">Other (specify)</option>
              </select>
              {form.department === "Other:" ? (
                <input className={`${fieldClass} mt-2`} placeholder="Specify department name" value={form.departmentOther} onChange={(e) => set("departmentOther", e.target.value)} />
              ) : null}
            </Field>
            <Field label="Type of Activity *">
              <Pills
                value={form.activityType}
                onChange={(value) => set("activityType", value)}
                options={["Survey/Study", "Project", "Other:"]}
                labels={{ "Other:": "Other" }}
              />
              {form.activityType === "Other:" ? (
                <input className={`${fieldClass} mt-2`} placeholder="Specify activity type" value={form.activityTypeOther} onChange={(e) => set("activityTypeOther", e.target.value)} />
              ) : null}
            </Field>
          </div>

          {form.activityType === "Survey/Study" ? (
            <Field label="Education Level *">
              <Pills
                value={form.educationLevel}
                onChange={(value) => set("educationLevel", value)}
                options={["PhD Degree", "Masters Degree", "Bachelors Degree"]}
                labels={{ "PhD Degree": "PhD", "Masters Degree": "Masters", "Bachelors Degree": "Bachelors" }}
              />
            </Field>
          ) : null}

          {form.activityType === "Project" ? (
            <div className="mt-4 rounded-2xl border border-line bg-panel-2/40 p-4">
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">Project expected outcomes, monitoring, sustainability and budget</p>
              <Field label="Tangible and Measurable Results *">
                <textarea className={fieldClass} rows={2} placeholder="List tangible milestones, beneficiaries, and operational targets..." value={form.projectOutcomesTangible} onChange={(e) => set("projectOutcomesTangible", e.target.value)} />
              </Field>
              <Field label="Publications, Reports, Dashboards or Tools *">
                <textarea className={fieldClass} rows={2} placeholder="Peer-reviewed papers, policy briefs, surveillance dashboards, manuals..." value={form.projectOutcomesPublications} onChange={(e) => set("projectOutcomesPublications", e.target.value)} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Progress and Success Indicators *">
                  <textarea className={fieldClass} rows={2} placeholder="Key performance indicators..." value={form.projectIndicators} onChange={(e) => set("projectIndicators", e.target.value)} />
                </Field>
                <Field label="Monitoring Frequency *">
                  <select className={fieldClass} value={form.projectMonitoringFreq} onChange={(e) => set("projectMonitoringFreq", e.target.value)}>
                    <option value="">Select monitoring frequency</option>
                    {["Daily", "Weekly", "Monthly", "Quarterly", "Annually"].map((frequency) => <option key={frequency}>{frequency}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Feedback and Reporting Mechanisms *">
                <textarea className={fieldClass} rows={2} placeholder="How results and stakeholder feedback will be shared with Addis Ababa Health Bureau..." value={form.projectFeedbackMechanisms} onChange={(e) => set("projectFeedbackMechanisms", e.target.value)} />
              </Field>
              <Field label="Long-term Maintenance and Scalability *">
                <textarea className={fieldClass} rows={2} placeholder="How outcomes will be maintained or transitioned to the health bureau after funding closes..." value={form.projectSustainability} onChange={(e) => set("projectSustainability", e.target.value)} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Cost Breakdown *">
                  <textarea className={fieldClass} rows={2} placeholder="Personnel, diagnostics, consumables, local travel" value={form.projectBudgetBreakdown} onChange={(e) => set("projectBudgetBreakdown", e.target.value)} />
                </Field>
                <Field label="Cost Justification *">
                  <textarea className={fieldClass} rows={2} placeholder="Why each expense is scientifically necessary" value={form.projectBudgetJustification} onChange={(e) => set("projectBudgetJustification", e.target.value)} />
                </Field>
              </div>
            </div>
          ) : null}

          <SectionLabel>Advisor and principal investigator</SectionLabel>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Advisor Full Name *">
              <input className={fieldClass} placeholder="e.g. Prof. Tesfaye Kassa" value={form.advisorName} onChange={(e) => set("advisorName", e.target.value)} />
            </Field>
            <Field label="Advisor Official Email *">
              <input className={fieldClass} type="email" placeholder="e.g. advisor@aau.edu.et" value={form.advisorEmail} onChange={(e) => set("advisorEmail", e.target.value)} />
            </Field>
            <Field label="Advisor Telephone *">
              <input className={fieldClass} type="tel" placeholder="+251 91 xxx xxxx" value={form.advisorPhone} onChange={(e) => set("advisorPhone", e.target.value)} />
            </Field>
            <Field label="Principal Investigator (PI) Name *">
              <input
                className={fieldClass}
                placeholder="e.g. Dr. Dereje Haile"
                value={form.piName}
                onChange={(e) => set("piName", e.target.value)}
              />
            </Field>
            <Field label="PI Telephone *">
              <input className={fieldClass} type="tel" placeholder="+251 91 xxx xxxx" value={form.piPhone} onChange={(e) => set("piPhone", e.target.value)} />
            </Field>
            <Field label="PI Official Email Address *">
              <input className={fieldClass} type="email" placeholder="e.g. pi@aau.edu.et" value={form.piEmail} onChange={(e) => set("piEmail", e.target.value)} />
            </Field>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div>
          <SectionLabel>Study identification and timing</SectionLabel>
          <Field label="Full Study Title *">
            <input className={fieldClass} placeholder="Full scientific title" value={form.studyTitle} onChange={(e) => set("studyTitle", e.target.value)} />
          </Field>
          <Field label="Health Focus Area *">
            <select className={fieldClass} value={form.healthFocus} onChange={(e) => set("healthFocus", e.target.value)}>
              <option value="">Select health focus domain</option>
              {HEALTH_FOCUS.map((focus) => <option key={focus}>{focus}</option>)}
              <option value="Other:">Other (specify)</option>
            </select>
            {form.healthFocus === "Other:" ? (
              <input className={`${fieldClass} mt-2`} placeholder="Specify health focus" value={form.healthFocusOther} onChange={(e) => set("healthFocusOther", e.target.value)} />
            ) : null}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Data Collection Begins *">
              <input className={fieldClass} type="date" value={form.dataStart} onChange={(e) => set("dataStart", e.target.value)} />
            </Field>
            <Field label="Data Collection Ends *">
              <input className={fieldClass} type="date" value={form.dataEnd} onChange={(e) => set("dataEnd", e.target.value)} />
            </Field>
          </div>
          <Field label="Frequency of Data Collection *">
            <select className={fieldClass} value={form.frequency} onChange={(e) => set("frequency", e.target.value)}>
              <option value="">Select data collection frequency</option>
              {FREQUENCIES.map((frequency) => <option key={frequency}>{frequency}</option>)}
            </select>
          </Field>
        </div>
      ) : null}

      {step === 2 ? (
        <div>
          <SectionLabel>Design and objectives</SectionLabel>
          <Field label="Research Approach *">
            <Pills value={form.methods} onChange={(value) => set("methods", value)} options={["Qualitative", "Quantitative", "Mixed"]} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Sample Size *">
              <input className={fieldClass} type="number" min={1} placeholder="e.g. 350" value={form.sampleSize} onChange={(e) => set("sampleSize", e.target.value)} />
            </Field>
            <Field label="Study Design *">
              <select className={fieldClass} value={form.studyDesign} onChange={(e) => set("studyDesign", e.target.value)}>
                <option value="">Select study design</option>
                {STUDY_DESIGNS.map((design) => <option key={design}>{design}</option>)}
                <option value="Other:">Other (specify)</option>
              </select>
              {form.studyDesign === "Other:" ? (
                <input className={`${fieldClass} mt-2`} placeholder="Specify study design" value={form.studyDesignOther} onChange={(e) => set("studyDesignOther", e.target.value)} />
              ) : null}
            </Field>
          </div>
          {form.studyDesign === "Randomized Controlled Trial" || form.studyDesign === "QUASI Experimental" ? (
            <Field label="Clinical Trial Classification *">
              <p className="mb-2 text-xs font-normal tracking-normal text-muted normal-case">Select all methodological attributes that apply.</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {TRIAL_OPTIONS.map((option) => (
                  <CheckItem
                    key={option}
                    checked={form.clinicalTrial.includes(option)}
                    onChange={(checked) => set("clinicalTrial", checked ? [...form.clinicalTrial, option] : form.clinicalTrial.filter((item) => item !== option))}
                  >
                    {option}
                  </CheckItem>
                ))}
              </div>
            </Field>
          ) : null}
          <Field label="General Objective *">
            <textarea className={fieldClass} rows={2} placeholder="Overall scientific aim..." value={form.generalObjective} onChange={(e) => set("generalObjective", e.target.value)} />
          </Field>
          <Field label="Specific Objectives *">
            <textarea className={fieldClass} rows={3} placeholder={"1. Estimate prevalence...\n2. Identify risk factors...\n3. Evaluate diagnostic turnaround..."} value={form.specificObjectives} onChange={(e) => set("specificObjectives", e.target.value)} />
          </Field>
        </div>
      ) : null}

      {step === 3 ? (
        <div>
          <SectionLabel>Location and population</SectionLabel>
          <Field label="Geographic Coverage *">
            <select className={fieldClass} value={form.geoCoverage} onChange={(e) => set("geoCoverage", e.target.value)}>
              <option value="">Select geographic scope</option>
              {GEO_OPTIONS.map((option) => <option key={option}>{option}</option>)}
              <option value="Other:">Other (specify)</option>
            </select>
            {form.geoCoverage === "Other:" ? (
              <input className={`${fieldClass} mt-2`} placeholder="Specify geographic scope" value={form.geoCoverageOther} onChange={(e) => set("geoCoverageOther", e.target.value)} />
            ) : null}
          </Field>
          <Field label="Specific Study Site *">
            <input className={fieldClass} placeholder="e.g. All Addis Ababa public health centers in Bole and Yeka" value={form.specificSite} onChange={(e) => set("specificSite", e.target.value)} />
          </Field>
          <Field label="Sex / Gender Considered *">
            <Pills value={form.gender} onChange={(value) => set("gender", value)} options={["Male", "Female", "Both", "Not applicable"]} />
          </Field>
          <Field label="Target Population Group *">
            <select className={fieldClass} value={form.targetGroup} onChange={(e) => set("targetGroup", e.target.value)}>
              <option value="">Select target population</option>
              {TARGET_GROUPS.map((group) => <option key={group}>{group}</option>)}
              <option value="Other:">Other (specify)</option>
            </select>
            {form.targetGroup === "Other:" ? (
              <input className={`${fieldClass} mt-2`} placeholder="Specify target population" value={form.targetGroupOther} onChange={(e) => set("targetGroupOther", e.target.value)} />
            ) : null}
          </Field>
        </div>
      ) : null}

      {step === 4 ? (
        <div>
          <SectionLabel>Data handling and sharing</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Is Data Collected Electronically? *">
              <Pills value={form.electronic} onChange={(value) => set("electronic", value)} options={["Yes", "No"]} />
            </Field>
            <Field label="Is GPS / Geo-coordinate Data Collected? *">
              <Pills value={form.gps} onChange={(value) => set("gps", value)} options={["Yes", "No"]} />
            </Field>
          </div>
          <Field label="Data Collection Tools or Approach *">
            <select className={fieldClass} value={form.tools} onChange={(e) => set("tools", e.target.value)}>
              <option value="">Select data collection instrument</option>
              {TOOL_OPTIONS.map((tool) => <option key={tool}>{tool}</option>)}
              <option value="Other:">Other (specify)</option>
            </select>
            {form.tools === "Other:" ? (
              <input className={`${fieldClass} mt-2`} placeholder="Specify tool" value={form.toolsOther} onChange={(e) => set("toolsOther", e.target.value)} />
            ) : null}
          </Field>
          <Field label="Formats the Cleaned Data Will Be Available In *">
            <div className="grid gap-1.5 sm:grid-cols-2">
              {DATA_FORMATS.map((format) => (
                <CheckItem
                  key={format}
                  checked={form.dataFormat.includes(format)}
                  onChange={(checked) => set("dataFormat", checked ? [...form.dataFormat, format] : form.dataFormat.filter((item) => item !== format))}
                >
                  {format}
                </CheckItem>
              ))}
            </div>
          </Field>
          <Field label="Data Sharing and Accessibility *">
            <Pills
              value={form.accessibility}
              onChange={(value) => set("accessibility", value)}
              options={["Open access", "Accessible upon request", "Will accessed after publishing", "Not accessible"]}
            />
          </Field>
          {form.accessibility === "Not accessible" ? (
            <Field label="Reason Data Is Not Accessible *">
              <textarea className={fieldClass} rows={2} placeholder="e.g. Sensitive patient genetic data, confidentiality restrictions..." value={form.restrictionReason} onChange={(e) => set("restrictionReason", e.target.value)} />
            </Field>
          ) : null}
        </div>
      ) : null}

      {step === 5 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Funding Source *">
            <select className={fieldClass} value={form.funding} onChange={(e) => set("funding", e.target.value)}>
              <option value="">Select funding source</option>
              {FUNDING_OPTIONS.map((option) => <option key={option}>{option}</option>)}
              <option value="Other:">Other (specify)</option>
            </select>
            {form.funding === "Other:" ? (
              <input className={`${fieldClass} mt-2`} placeholder="Specify funding source" value={form.fundingOther} onChange={(e) => set("fundingOther", e.target.value)} />
            ) : null}
          </Field>
          <Field label="Allocated Budget (ETB) *">
            <input className={fieldClass} type="number" min={0} placeholder="e.g. 150000" value={form.budget} onChange={(e) => set("budget", e.target.value)} />
          </Field>
        </div>
      ) : null}

      {step === 6 ? (
        <div>
          <SectionLabel>Required documents</SectionLabel>
          {editing ? (
            <p className="mb-3 rounded-xl border border-sky/20 bg-sky/5 px-3 py-2 text-xs text-muted">
              Existing files are kept unless you choose a replacement. The initial protocol can be
              changed only before it is forwarded to reviewers; after forwarding it is locked.
            </p>
          ) : null}
          <div className="space-y-3">
            <FilePick
              label="Institutional Supporting Letter *"
              hint="Official scanned endorsement. PDF, JPG or PNG (up to 5 MB)"
              accept=".pdf,.jpg,.jpeg,.png"
              file={form.files.supportingLetter}
              onPick={(file) => pickFile("supportingLetter", file, /\.(pdf|jpe?g|png)$/i, "Institutional Supporting Letter")}
              onClear={() => clearFile("supportingLetter")}
            />
            <FilePick
              label="Principal Investigator (PI) Identification *"
              hint="Kebele ID, National ID, Passport or Driving License (JPG or PNG up to 5 MB)"
              accept=".jpg,.jpeg,.png"
              file={form.files.piId}
              onPick={(file) => pickFile("piId", file, /\.(jpe?g|png)$/i, "PI Identification")}
              onClear={() => clearFile("piId")}
            />
            <FilePick
              label="Investigator CV *"
              hint="Curriculum vitae of the Principal Investigator. PDF (up to 5 MB)"
              accept=".pdf"
              file={form.files.cv}
              onPick={(file) => pickFile("cv", file, /\.pdf$/i, "Investigator CV")}
              onClear={() => clearFile("cv")}
            />
          </div>
          <div className="mt-4">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted uppercase">
              <Paperclip className="size-3.5" /> Complete Proposal Document and Structure Check *
            </p>
            {proposalLocked ? (
              <div className="rounded-xl border border-line bg-panel-2/50 p-3 text-xs text-muted">
                <p className="font-semibold text-fg">Initial protocol is locked</p>
                <p className="mt-1">
                  {editProtocol?.submission.files.proposalDoc?.name ?? "The original proposal"} is
                  retained unchanged. To replace the protocol after forwarding, upload a PDF in the
                  Final Protocol section.
                </p>
              </div>
            ) : (
              <ProposalScanner
                value={scan}
                onChange={handleScan}
                onExtracted={applyExtracted}
                onFileSelected={(file) => setRawFiles((prev) => ({ ...prev, proposalDoc: file }))}
              />
            )}
          </div>
          {scan && scan.completeness < 95 ? (
            <p className="mt-3 rounded-xl border border-rose/30 bg-rose/10 px-3 py-2 text-xs text-rose">
              The proposal is {scan.completeness}% complete. At least 95% of the 28 required sections is required before submission.
            </p>
          ) : null}
        </div>
      ) : null}

      {step === 7 ? (
        <div>
          <div className="rounded-2xl border border-line bg-panel-2/40 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold"><FileText className="size-4 text-sky" /> Submission summary</p>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <Review k="Protocol code" v={form.code} />
              <Review k="Research title" v={form.studyTitle} />
              <Review k="Principal investigator" v={`${form.piName} · ${form.piEmail}`} />
              <Review k="College / institution" v={displayValue(form.college, form.collegeOther)} />
              <Review k="Department" v={displayValue(form.department, form.departmentOther)} />
              <Review k="Study design" v={displayValue(form.studyDesign, form.studyDesignOther)} />
              <Review k="Sample size" v={form.sampleSize} />
              <Review k="Study site" v={form.specificSite} />
              <Review k="Proposal scan" v={scan ? `${scan.completeness}% of ${scan.total} sections` : "Not scanned"} />
            </dl>
            <p className="mt-3 text-xs text-muted">
              Attached: {[form.files.supportingLetter, form.files.piId, form.files.proposalDoc, form.files.cv].filter(Boolean).length} of 4 required files.
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-amber/30 bg-amber/10 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-amber">
              <ShieldCheck className="size-4" /> Institutional Data Sharing Acknowledgment
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{DATA_SHARING_TEXT}</p>
            <CheckItem checked={form.acknowledge} onChange={(checked) => set("acknowledge", checked)}>
              <strong>I understand and agree to the institutional data sharing terms. *</strong>
            </CheckItem>
          </div>

          <div className="mt-4 rounded-2xl border border-sky/30 bg-sky/10 p-4">
            <h3 className="text-sm font-semibold text-sky">Principal Investigator's Informed Consent Declaration</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{DECLARATION_TEXT}</p>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              <Review k="Principal Investigator's Name" v={form.piName} />
              <Review k="Date and Time" v="Recorded automatically when you confirm" />
              <Review k="Electronic Confirmation" v="Required" />
            </dl>
            <CheckItem checked={form.declarationAccepted} onChange={(checked) => set("declarationAccepted", checked)}>
              <strong>I confirm and accept this declaration. *</strong>
            </CheckItem>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-3 rounded-xl border border-rose/30 bg-rose/10 px-3 py-2 text-xs text-rose">{error}</p> : null}
    </Modal>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mt-6 mb-1 border-t border-line pt-4 text-xs font-bold tracking-[0.14em] text-sky uppercase">
      {children}
    </p>
  );
}

function Pills({
  value,
  onChange,
  options,
  labels,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`min-h-11 rounded-xl border px-3.5 text-sm font-semibold ${
            value === option
              ? "border-sky bg-sky text-on-accent shadow-sm"
              : "border-line bg-panel text-fg hover:border-sky/50 hover:bg-panel-2"
          }`}
        >
          {labels?.[option] ?? option}
        </button>
      ))}
    </div>
  );
}

function CheckItem({ checked, onChange, children }: { checked: boolean; onChange: (checked: boolean) => void; children: ReactNode }) {
  return (
    <label className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2 text-sm ${checked ? "border-sky/50 bg-sky/10 text-fg" : "border-line bg-panel text-fg hover:border-sky/40"}`}>
      <input type="checkbox" className="size-4 accent-[var(--color-sky)]" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

function FilePick({
  label,
  hint,
  accept,
  file,
  onPick,
  onClear,
}: {
  label: string;
  hint: string;
  accept: string;
  file: SubmissionFile | null;
  onPick: (file: File | undefined) => void;
  onClear: () => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">
        {label} <span className="normal-case">— {hint}</span>
      </p>
      <label className={`mt-1.5 flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-dashed px-3 py-2 ${file ? "border-em bg-em/5" : "border-line-2"}`}>
        <input type="file" accept={accept} className="sr-only" onChange={(event) => onPick(event.target.files?.[0])} />
        <Check className={`size-4 ${file ? "text-em" : "text-muted"}`} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{file ? file.name : `Choose ${label.replace(" *", "").toLowerCase()}`}</span>
          <span className="block text-xs text-muted">{file ? formatBytes(file.size) : hint}</span>
        </span>
        <span className="rounded-lg border border-line px-2 py-1 text-xs text-muted">{file ? "Replace" : "Browse"}</span>
      </label>
      {file ? (
        <button type="button" onClick={onClear} className="mt-1 text-xs font-semibold text-rose">
          Remove file
        </button>
      ) : null}
    </div>
  );
}

function Review({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{k}</dt>
      <dd className="mt-0.5 text-sm font-semibold break-words">{v || "—"}</dd>
    </div>
  );
}

function formatBytes(size: number): string {
  if (!size) return "Scanned in this browser";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

import type { RoleKey } from "@/lib/irerc/model";

export type RoleGuide = {
  headline: string;
  summary: string;
  bullets: string[];
  boundaries: string[];
};

export const ROLE_GUIDES: Record<RoleKey, RoleGuide> = {
  investigator: {
    headline: "Principal Investigator",
    summary: "You own the accuracy of the submission and the conduct of the approved study.",
    bullets: [
      "Complete all eight submission steps and upload the supporting letter, PI identification, CV and Word proposal.",
      "The proposal must pass the 28-section check at 95% or above.",
      "Correct submitted answers or supporting documents within the 48-hour update window.",
      "Read every reviewer comment and recommendation before preparing the revised protocol.",
      "Upload the revised/final protocol as a PDF. There is no time limit on that PDF workflow.",
      "Submit the final protocol back to the reviewers when it is ready.",
      "Report serious and unanticipated events, amendments and continuing review through the portal.",
      "Do not implement a protocol change before the committee approves it.",
    ],
    boundaries: [
      "You cannot approve your own protocol.",
      "The initial protocol is locked after it is forwarded to reviewers.",
      "Approved documents must not be replaced outside the revision workflow.",
    ],
  },
  secretariat: {
    headline: "IRERC Secretariat",
    summary: "You administer the review file. You do not make ethics decisions.",
    bullets: [
      "Register committee members and reviewers in the Roster, including their seat, expertise, institution and contact details.",
      "Screen every submission and verify the required documents before marking it complete.",
      "Classify the review type and assign the appropriate reviewers.",
      "Build the agenda and notify the Chair when the file is ready.",
      "Issue clearance or action letters only after the committee decision is recorded.",
      "Monitor revision windows and keep the activity trail complete.",
    ],
    boundaries: [
      "The Secretariat cannot approve a protocol.",
      "Do not delete or replace an initial protocol submitted by the PI.",
      "Do not assign a reviewer with a declared conflict.",
    ],
  },
  reviewer: {
    headline: "IRERC Member / Reviewer",
    summary: "You provide an independent scientific and ethical assessment for assigned protocols only.",
    bullets: [
      "Review only the protocols assigned to you.",
      "Open and read the submitted documents, including the initial and revised protocol versions.",
      "Complete the 20-point assessment and give a recommendation.",
      "Comment on every criterion marked Not appropriate.",
      "Declare any conflict of interest before submitting.",
      "Reassess the file when the PI submits corrections or a revised/final protocol.",
      "Present your assessment at the committee meeting when required.",
    ],
    boundaries: [
      "You cannot edit the PI's documents.",
      "You cannot record the committee decision.",
      "Do not share confidential protocol material outside the committee.",
    ],
  },
  chair: {
    headline: "IRERC Chairperson",
    summary: "You chair the committee, protect quorum and record the committee's decision.",
    bullets: [
      "Confirm quorum and the presence of a lay member and scientist before the vote.",
      "Ensure conflicted members leave before deliberation and voting.",
      "Request revisions when the committee needs corrections before a decision.",
      "Record the committee decision and its conditions in the system.",
      "Sign the clearance or action letter through the recorded decision.",
      "Ensure the PI receives the decision and any continuing-review requirements.",
    ],
    boundaries: [
      "The Chair cannot replace the committee's vote with a personal decision.",
      "The system does not make the ethics determination.",
      "Do not issue a clearance before the decision is recorded.",
    ],
  },
  admin: {
    headline: "System Administrator",
    summary: "You protect access, data integrity, notifications and the audit trail. You do not make ethics decisions.",
    bullets: [
      "Maintain user access and role assignments.",
      "Keep the audit trail, notifications and document storage operational.",
      "Extend a revision window only when the PI requests additional time and the extension is authorised.",
      "Investigate missing documents, access problems or workflow errors.",
      "Protect confidential research data and the institutional signature.",
      "Escalate scientific or ethics questions to the Secretariat or Chair.",
    ],
    boundaries: [
      "The administrator cannot approve, reject or modify an ethics decision.",
      "Do not alter submitted scientific content.",
      "Do not share PI identification or unpublished protocol data.",
    ],
  },
};

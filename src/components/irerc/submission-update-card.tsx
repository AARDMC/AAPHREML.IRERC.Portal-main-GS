import { useEffect, useState } from "react";
import { Clock, Lock, Pencil } from "lucide-react";
import { useIrerc } from "@/lib/irerc/store";
import {
  isSubmissionUpdateOpen,
  submissionUpdateDeadline,
  submissionUpdateRemainingMs,
  type Protocol,
} from "@/lib/irerc/model";
import { Btn, Card, Chip } from "@/components/irerc/ui";

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

export function SubmissionUpdateCard({ protocol }: { protocol: Protocol }) {
  const role = useIrerc((s) => s.role);
  const openModal = useIrerc((s) => s.openModal);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (role !== "investigator") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [role]);

  if (role !== "investigator") return null;
  const deadline = submissionUpdateDeadline(protocol);
  if (!deadline) return null;

  const open = isSubmissionUpdateOpen(protocol, now);
  const remaining = submissionUpdateRemainingMs(protocol, now);
  const preReview = ["submitted", "screening", "correction"].includes(protocol.status);
  const locked = Boolean(protocol.initialProtocolLockedAt) && !preReview;

  if (open) {
    return (
      <Card className="mb-4 border-sky/30 bg-gradient-to-br from-sky/15 via-panel to-em/10 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-sky">
              <Pencil className="size-4" /> Update Submission is available
            </p>
            <p className="mt-1 text-xs text-muted">
              {locked
                ? "The initial protocol PDF is locked after forwarding. You can still correct answers and replace supporting documents; reviewers will be asked to reassess. Use the final protocol PDF workflow to change the protocol document itself."
                : "You can correct the submission answers and replace supporting documents before the file is forwarded to reviewers."}
            </p>
            {protocol.submissionUpdatedAt ? (
              <p className="mt-1 text-[11px] text-muted">
                Last updated {new Date(protocol.submissionUpdatedAt).toLocaleString()}
              </p>
            ) : null}
          </div>
          <Chip tone="amber">
            <Clock className="mr-1 size-3" /> {formatRemaining(remaining)}
          </Chip>
        </div>
        <Btn className="mt-3" kind="primary" onClick={() => openModal({ type: "update", id: protocol.id })}>
          Update Submission
        </Btn>
      </Card>
    );
  }

  if (locked) {
    return (
      <Card className="mb-4 border-line bg-panel-2/50 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Lock className="size-4 text-muted" /> Submission locked
        </p>
        <p className="mt-1 text-xs text-muted">
          This application has been forwarded to reviewers. The submitted answers and initial
          documents can no longer be edited. Use the revised/final protocol workflow for later changes.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mb-4 border-amber/30 bg-amber/10 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber">
        <Lock className="size-4" /> Update window closed
      </p>
      <p className="mt-1 text-xs text-muted">
        The 48-hour update window ended on {new Date(deadline).toLocaleString()}. The submitted
        answers are now locked; later changes follow the reviewer revision and final-protocol workflow.
      </p>
    </Card>
  );
}

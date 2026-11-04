import { MessageSquare, ShieldCheck } from "lucide-react";
import { useIrerc } from "@/lib/irerc/store";
import type { Protocol } from "@/lib/irerc/model";
import { Btn, Card, Chip } from "@/components/irerc/ui";

export function DocumentReviewCard({ protocol }: { protocol: Protocol }) {
  const openModal = useIrerc((s) => s.openModal);
  const role = useIrerc((s) => s.role);
  const comments = protocol.documentComments ?? [];
  const unresolved = comments.filter((comment) => !comment.resolved).length;

  return (
    <Card className="border-sky/30 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MessageSquare className="size-4 text-sky" /> Document review &amp; comments
          </h2>
          <p className="mt-1 text-sm text-muted">
            Open the submitted Word or PDF document, select text, and add review comments without
            changing the PI's file.
          </p>
        </div>
        <Chip tone={unresolved ? "amber" : "muted"}>
          {unresolved ? `${unresolved} open` : `${comments.length} comments`}
        </Chip>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Btn kind="primary" onClick={() => openModal({ type: "review", id: protocol.id })}>
          <MessageSquare className="size-4" />
          {role === "investigator" ? "Read reviewer comments" : "Open document review"}
        </Btn>
        <span className="inline-flex items-center gap-1 text-xs text-muted">
          <ShieldCheck className="size-3.5 text-em" /> Original protected and read-only
        </span>
      </div>
    </Card>
  );
}

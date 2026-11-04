import { useMemo, useState } from "react";
import {
  Bell,
  ClipboardCheck,
  FileText,
  Gavel,
  RefreshCw,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { useIrerc } from "@/lib/irerc/store";
import {
  NOTIFICATION_PRIORITY_LABEL,
  NOTIFICATION_TYPE_LABEL,
  type AppNotification,
  type NotificationType,
} from "@/lib/irerc/model";
import { Btn, Chip, Modal } from "@/components/irerc/ui";

const typeIcon: Record<NotificationType, typeof Bell> = {
  submission: FileText,
  document: Upload,
  review: ClipboardCheck,
  decision: Gavel,
  revision: RefreshCw,
  safety: ShieldAlert,
  system: Bell,
};

const priorityTone = {
  high: "rose",
  normal: "amber",
  low: "muted",
} as const;

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.floor(diff / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function useVisibleNotifications(): AppNotification[] {
  const role = useIrerc((s) => s.role);
  const notifications = useIrerc((s) => s.notifications);
  return useMemo(
    () =>
      notifications.filter(
        (n) => n.recipientRole === "all" || n.recipientRole === role || role === "admin",
      ),
    [notifications, role],
  );
}

export function NotificationList({
  items,
  compact = false,
  onSelect,
}: {
  items: AppNotification[];
  compact?: boolean;
  onSelect?: () => void;
}) {
  const openProtocol = useIrerc((s) => s.openProtocol);
  const markRead = useIrerc((s) => s.markNotificationRead);
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">No notifications in this view.</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {items.map((notification, index) => {
        const Icon = typeIcon[notification.type];
        return (
          <li key={notification.id} className={index === 0 && !notification.read ? "bg-sky/5" : ""}>
            <button
              type="button"
              className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-ink-2/70"
              onClick={() => {
                markRead(notification.id);
                if (notification.protocolId) openProtocol(notification.protocolId);
                onSelect?.();
              }}
            >
              <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${notification.read ? "bg-panel-2 text-muted" : "bg-sky/15 text-sky"}`}>
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold">{notification.title}</span>
                  {notification.read ? <Chip tone="muted">Read</Chip> : <Chip tone="sky">Unread</Chip>}
                  <Chip tone={priorityTone[notification.priority]}>{NOTIFICATION_PRIORITY_LABEL[notification.priority]}</Chip>
                </span>
                <span className="mt-1 block text-xs text-muted">{notification.body}</span>
                <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                  <span>{NOTIFICATION_TYPE_LABEL[notification.type]}</span>
                  <span>·</span>
                  <span>{relativeTime(notification.createdAt)}</span>
                  {notification.protocolId ? <span>· {notification.protocolId}</span> : null}
                  {compact ? null : <span>· {new Date(notification.createdAt).toLocaleString()}</span>}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function NotificationCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const items = useVisibleNotifications();
  const markAll = useIrerc((s) => s.markAllNotificationsRead);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const shown = filter === "unread" ? items.filter((n) => !n.read) : items;
  if (!open) return null;
  return (
    <Modal
      title="Notifications"
      onClose={onClose}
      wide
      footer={
        <>
          <Btn onClick={markAll}>Mark all read</Btn>
          <Btn onClick={onClose}>Close</Btn>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === "all" ? "border-sky bg-sky/15 text-sky" : "border-line text-muted"}`}
          onClick={() => setFilter("all")}
        >
          All ({items.length})
        </button>
        <button
          type="button"
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === "unread" ? "border-sky bg-sky/15 text-sky" : "border-line text-muted"}`}
          onClick={() => setFilter("unread")}
        >
          Unread ({items.filter((n) => !n.read).length})
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-line">
        <NotificationList items={shown} onSelect={onClose} />
      </div>
    </Modal>
  );
}

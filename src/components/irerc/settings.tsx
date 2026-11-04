import { useState } from "react";
import { Bell, CheckCircle2, ImagePlus, Printer, ShieldAlert, Sparkles, Trash2 } from "lucide-react";
import { useIrerc } from "@/lib/irerc/store";
import { ROLES } from "@/lib/irerc/model";
import { REMOTE } from "@/lib/irerc/remote";
import { useGasAuth } from "@/lib/gas/auth";
import { ROLE_GUIDES } from "@/lib/irerc/role-guides";
import { useVisibleNotifications } from "@/components/irerc/notifications";
import { Btn, Card, Chip, PageHead } from "@/components/irerc/ui";
import { ThemePicker } from "@/components/irerc/theme-picker";

export function SettingsDesk() {
  const role = useIrerc((s) => s.role)!;
  const localLogout = useIrerc((s) => s.logout);
  const { signOut: gasSignOut } = useGasAuth();
  const logout = () => (REMOTE ? void gasSignOut() : localLogout());
  const profilePhotos = useIrerc((s) => s.profilePhotos);
  const setProfilePhoto = useIrerc((s) => s.setProfilePhoto);
  const guide = ROLE_GUIDES[role];
  const notifications = useVisibleNotifications();
  const unread = notifications.filter((n) => !n.read).length;
  const photo = profilePhotos[role];
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  async function changePhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Choose an image file from your gallery.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setPhotoError("Choose an image smaller than 10 MB.");
      return;
    }
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      setProfilePhoto(role, await resizeProfilePhoto(file));
    } catch {
      setPhotoError("The image could not be read. Try a JPG or PNG.");
    } finally {
      setPhotoBusy(false);
    }
  }

  return (
    <div className="rise">
      <PageHead
        title="Settings & role guide"
        lede="Important: your role settings, operating instructions and boundaries. Read these before using the portal."
        action={
          <Btn onClick={() => window.print()}>
            <Printer className="size-4" /> Print guide
          </Btn>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-sky/25 bg-gradient-to-br from-sky/20 via-panel to-em/10 p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-sky uppercase">
              <Sparkles className="size-4" /> Important role settings
            </p>
            <h2 className="mt-1 text-2xl font-bold">{guide.headline}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">{guide.summary}</p>
          </div>
          <Chip tone="amber">{ROLES[role].title}</Chip>
        </div>
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <Card className="p-4 md:p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-em" />
            <h2 className="text-lg font-semibold">Operating instructions</h2>
          </div>
          <p className="mt-1 text-sm text-muted">Follow these steps every time you use this role.</p>
          <ol className="mt-4 space-y-3">
            {guide.bullets.map((bullet, index) => (
              <li key={bullet} className="flex items-start gap-3">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky to-em text-xs font-bold text-white shadow-sm">
                  {index + 1}
                </span>
                <p className="text-sm leading-relaxed">{bullet}</p>
              </li>
            ))}
          </ol>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="text-lg font-semibold">Profile photo</h2>
            <p className="mt-1 text-xs text-muted">Choose a photo from your device gallery. It is shown in the header for this role.</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-sky to-em text-lg font-bold text-white">
                {photo ? <img src={photo} alt="Profile" className="size-full object-cover" /> : ROLES[role].initials}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-line bg-panel px-3 text-xs font-semibold hover:border-sky/50">
                  <ImagePlus className="size-4" />
                  {photoBusy ? "Processing…" : "Upload from gallery"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={photoBusy}
                    onChange={(event) => {
                      void changePhoto(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </label>
                {photo ? (
                  <Btn className="px-3 py-1.5 text-xs" kind="danger" onClick={() => { setProfilePhoto(role, null); setPhotoError(null); }}>
                    <Trash2 className="size-3.5" /> Remove
                  </Btn>
                ) : null}
              </div>
            </div>
            {photoError ? <p className="mt-2 text-xs text-rose">{photoError}</p> : null}
            <p className="mt-2 text-[11px] text-muted">JPG, PNG or another image type up to 10 MB. Stored in this browser.</p>
          </Card>

          <Card className="border-amber/30 bg-amber/10 p-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-amber" />
              <h2 className="text-lg font-semibold text-amber">Role boundaries</h2>
            </div>
            <ul className="mt-3 space-y-2">
              {guide.boundaries.map((boundary) => (
                <li key={boundary} className="flex items-start gap-2 text-sm leading-relaxed">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-amber" />
                  <span>{boundary}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-4">
            <h2 className="text-lg font-semibold">Preferences</h2>
            <p className="mt-1 text-xs text-muted">Display and notification settings for this browser.</p>
            <div className="mt-3 rounded-xl border border-line bg-panel-2/40 p-3">
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Theme</p>
              <ThemePicker />
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl border border-line bg-panel-2/40 p-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold"><Bell className="size-4 text-sky" /> Notifications</p>
                <p className="mt-0.5 text-xs text-muted">{unread} unread for this role</p>
              </div>
              <Chip tone={unread ? "rose" : "muted"}>{unread ? "Action needed" : "Clear"}</Chip>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl border border-line bg-panel-2/40 p-3">
              <div>
                <p className="text-sm font-semibold">Signed-in role</p>
                <p className="mt-0.5 text-xs text-muted">{ROLES[role].title}</p>
              </div>
              <Btn className="px-3 py-1.5 text-xs" onClick={logout}>{REMOTE ? "Sign out" : "Switch role"}</Btn>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function resizeProfilePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas unavailable");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, size, size);
        const scale = Math.max(size / image.width, size / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image could not be decoded"));
    };
    image.src = url;
  });
}

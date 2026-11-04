import { useEffect, useState } from "react";
import { REMOTE, bootstrapRemoteSession } from "@/lib/irerc/remote";
import { useGasAuth } from "@/lib/gas/auth";
import { Navigate } from "@tanstack/react-router";
import {
  Activity,
  Archive,
  Bell,
  ClipboardCheck,
  Files,
  LayoutDashboard,
  Menu,
  PenLine,
  Scale,
  Search,
  Settings,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import {
  BRAND,
  NAV,
  ROLES,
  TODAY,
  addDays,
  type RoleKey,
  type ViewKey,
  myReviewPending,
  visibleTo,
} from "@/lib/irerc/model";
import { useIrerc } from "@/lib/irerc/store";
import { applyTheme, getStoredTheme } from "@/lib/irerc/theme";
import { Dashboard, workItems } from "@/components/irerc/dashboard";
import { ProtocolList } from "@/components/irerc/protocols";
import { ProtocolDetail } from "@/components/irerc/detail";
import { ArchiveDesk, CommitteeDesk, MonitorDesk, ReviewsDesk, RosterDesk, SafetyDesk, SystemDesk } from "@/components/irerc/desks";
import { ModalHost } from "@/components/irerc/modals";
import { ThemePicker } from "@/components/irerc/theme-picker";
import { NotificationCenter, useVisibleNotifications } from "@/components/irerc/notifications";
import { SettingsDesk } from "@/components/irerc/settings";

const ICONS: Record<ViewKey, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  protocols: Files,
  detail: Files,
  reviews: PenLine,
  screening: ClipboardCheck,
  committee: Scale,
  safety: ShieldAlert,
  monitor: Activity,
  archive: Archive,
  system: Settings,
  roster: Users,
  settings: Settings,
};

const ROLE_ICON: Record<RoleKey, typeof LayoutDashboard> = {
  investigator: ClipboardCheck,
  secretariat: Files,
  reviewer: PenLine,
  chair: Scale,
  admin: Settings,
};

const NAV_TONE: Record<ViewKey, { tile: string; active: string }> = {
  dashboard: { tile: "from-sky to-blue-500", active: "from-sky/25 via-blue-500/10 to-transparent ring-sky/40" },
  protocols: { tile: "from-indigo-500 to-violet-500", active: "from-indigo-500/25 via-violet-500/10 to-transparent ring-indigo-400/40" },
  detail: { tile: "from-indigo-500 to-violet-500", active: "from-indigo-500/25 via-violet-500/10 to-transparent ring-indigo-400/40" },
  screening: { tile: "from-amber-500 to-orange-500", active: "from-amber-500/25 via-orange-500/10 to-transparent ring-amber-400/40" },
  reviews: { tile: "from-fuchsia-500 to-pink-500", active: "from-fuchsia-500/25 via-pink-500/10 to-transparent ring-fuchsia-400/40" },
  committee: { tile: "from-em to-teal-500", active: "from-em/25 via-teal-500/10 to-transparent ring-em/40" },
  safety: { tile: "from-rose-500 to-red-500", active: "from-rose-500/25 via-red-500/10 to-transparent ring-rose-400/40" },
  monitor: { tile: "from-cyan-500 to-sky", active: "from-cyan-500/25 via-sky/10 to-transparent ring-cyan-400/40" },
  archive: { tile: "from-slate-500 to-slate-700", active: "from-slate-500/25 via-slate-600/10 to-transparent ring-slate-400/40" },
  system: { tile: "from-violet-500 to-purple-600", active: "from-violet-500/25 via-purple-600/10 to-transparent ring-violet-400/40" },
  roster: { tile: "from-pink-500 to-rose-500", active: "from-pink-500/25 via-rose-500/10 to-transparent ring-pink-400/40" },
  settings: { tile: "from-amber-500 to-violet-500", active: "from-amber-500/25 via-violet-500/10 to-transparent ring-amber-400/40" },
};

const ROLE_TONE: Record<RoleKey, { tile: string; bar: string; hover: string }> = {
  investigator: { tile: "from-sky to-blue-600", bar: "from-sky to-blue-500", hover: "hover:border-sky/50 hover:bg-sky/5" },
  secretariat: { tile: "from-violet-500 to-indigo-600", bar: "from-violet-500 to-indigo-500", hover: "hover:border-violet-400/50 hover:bg-violet-500/5" },
  reviewer: { tile: "from-fuchsia-500 to-pink-600", bar: "from-fuchsia-500 to-pink-500", hover: "hover:border-fuchsia-400/50 hover:bg-fuchsia-500/5" },
  chair: { tile: "from-em to-teal-600", bar: "from-em to-teal-500", hover: "hover:border-em/50 hover:bg-em/5" },
  admin: { tile: "from-amber-500 to-orange-600", bar: "from-amber-500 to-orange-500", hover: "hover:border-amber-400/50 hover:bg-amber-500/5" },
};

const ROLE_GATE: Record<RoleKey, { label: string; hint: string }> = {
  investigator: { label: "Principal Investigator", hint: "Submit and track protocols" },
  secretariat: { label: "Secretariat", hint: "Screen and coordinate reviews" },
  reviewer: { label: "Reviewer", hint: "Assess assigned protocols" },
  chair: { label: "Chairperson", hint: "Record committee decisions" },
  admin: { label: "System Administrator", hint: "Manage access and audit" },
};

export function Portal() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    applyTheme(getStoredTheme());
    const done = () => setReady(true);
    const unsub = useIrerc.persist.onFinishHydration(done);
    if (useIrerc.persist.hasHydrated()) done();
    return unsub;
  }, []);
  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink text-fg">
        <p className="font-display text-2xl">AAPHREML-IRERC</p>
      </div>
    );
  }
  return <Gate />;
}

function Gate() {
  const role = useIrerc((s) => s.role);
  if (REMOTE) return <RemoteGate />;
  if (!role) return <RoleGate />;
  return <Shell />;
}

/** Server mode: a real session decides who you are; the role comes from the database. */
function RemoteGate() {
  const { user, loading, signOut } = useGasAuth();
  const role = useIrerc((s) => s.role);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userEmail = user?.email ?? null;

  useEffect(() => {
    if (!userEmail) {
      useIrerc.setState({ role: null, protocols: [] });
      setLoaded(false);
      return;
    }
    let active = true;
    setError(null);
    bootstrapRemoteSession()
      .then(() => {
        if (!active) return;
        // Map the GAS role to the store role
        const gasUser = user;
        if (gasUser) {
          useIrerc.setState({
            role: gasUser.role as any,
            actingReviewer: gasUser.role === "reviewer" ? gasUser.name : "",
          });
        }
        setLoaded(true);
      })
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : "Could not load your portal."));
    return () => {
      active = false;
    };
  }, [userEmail, user]);

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" />;
  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink p-6 text-center text-fg">
        <div className="space-y-3">
          <p className="font-display text-xl">The portal could not be loaded</p>
          <p className="text-sm opacity-80">{error}</p>
          <button className="rounded-xl border px-4 py-2" onClick={() => void signOut()}>Sign out</button>
        </div>
      </div>
    );
  }
  if (!loaded || !role) return <LoadingScreen />;
  return <Shell />;
}

function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-ink text-fg">
      <p className="font-display text-2xl">AAPHREML-IRERC</p>
    </div>
  );
}

function RoleGate() {
  const login = useIrerc((s) => s.login);
  const order: RoleKey[] = ["investigator", "secretariat", "reviewer", "chair", "admin"];
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-teal-600 text-white">
      <div className="pointer-events-none absolute -top-28 -left-24 size-96 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-24 size-96 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 size-72 rounded-full bg-amber-300/20 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
          maskImage: "radial-gradient(ellipse at center, black, transparent 78%)",
        }}
      />
      <div className="absolute top-4 right-4 z-20 rounded-2xl border border-white/20 bg-white/10 p-1 shadow-sm backdrop-blur">
        <ThemePicker inverted />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-6xl items-center gap-10 px-5 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <div className="min-w-0 max-w-xl">
          <div className="flex min-w-0 flex-nowrap items-center gap-3 sm:gap-4">
            <img
              src="/seal.png"
              alt="Addis Ababa City Administration Health Bureau seal"
              className="size-14 shrink-0 rounded-2xl object-contain sm:size-20"
            />
            <h1 className="min-w-0 max-w-full whitespace-nowrap text-[clamp(1.15rem,4vw,2.5rem)] leading-none font-extrabold tracking-tight text-white">
              {BRAND.short}
            </h1>
          </div>
          <p className="mt-4 max-w-xl border-l-2 border-amber-300/80 pl-3 text-xs font-semibold leading-relaxed tracking-[0.04em] text-amber-100 sm:text-sm">
            <span className="text-white/90">{BRAND.bureau}</span>
            <span className="px-1.5 text-amber-300/80">·</span>
            <span className="text-amber-200">{BRAND.directorate}</span>
          </p>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-white/85">
            A single, governed route from protocol submission through screening, independent review,
            committee decision and clearance — with the PI, Secretariat, reviewers and Chair each
            seeing only their own desk.
          </p>
        </div>

        <div className="rounded-[1.75rem] bg-gradient-to-br from-white/60 via-cyan-200/30 to-white/20 p-[1px] shadow-2xl">
          <div className="rounded-[calc(1.75rem-1px)] bg-panel/95 p-5 text-fg backdrop-blur md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold tracking-[0.18em] text-sky uppercase">Access</p>
                <h2 className="mt-1 text-2xl font-bold">Choose your role</h2>
              </div>
              <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-sky to-em text-lg text-white shadow-sm">→</span>
            </div>
            <p className="mt-2 text-sm text-muted">Select the desk you are authorised to use.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {order.map((key) => {
                const gate = ROLE_GATE[key];
                const Icon = ROLE_ICON[key];
                const tone = ROLE_TONE[key];
                return (
                  <button
                    key={key}
                    className={`group relative overflow-hidden rounded-2xl border border-line/80 bg-panel p-4 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg ${tone.hover}`}
                    onClick={() => login(key)}
                  >
                    <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tone.bar}`} />
                    <span className={`grid size-11 place-items-center rounded-xl bg-gradient-to-br ${tone.tile} text-white shadow-md transition group-hover:scale-105`}>
                      <Icon className="size-5" />
                    </span>
                    <span className="mt-3 block font-semibold text-fg">{gate.label}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted">{gate.hint}</span>
                    <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-sky">
                      Open desk <span className="transition group-hover:translate-x-0.5">→</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-5 text-center text-[10px] leading-relaxed text-muted">
              AAPHREML-IRERC · Addis Ababa City Administration Health Bureau
            </p>
          </div>
        </div>
      </div>
      <footer className="relative z-10 border-t border-white/15 px-5 py-4 text-center text-[11px] font-medium text-white/70">
        Developed by: <span className="font-semibold text-amber-200">Addis Ababa City Data Management Center</span>
      </footer>
    </div>
  );
}

function Shell() {
  const role = useIrerc((s) => s.role)!;
  const view = useIrerc((s) => s.view);
  const go = useIrerc((s) => s.go);
  const query = useIrerc((s) => s.query);
  const setQuery = useIrerc((s) => s.setQuery);
  const navOpen = useIrerc((s) => s.navOpen);
  const setNav = useIrerc((s) => s.setNav);
  const protocols = useIrerc((s) => s.protocols);
  const safety = useIrerc((s) => s.safety);
  const acting = useIrerc((s) => s.actingReviewer);
  const toasts = useIrerc((s) => s.toasts);
  const celebrate = useIrerc((s) => s.celebrate);
  const closeModal = useIrerc((s) => s.closeModal);
  const checkRevisionWindows = useIrerc((s) => s.checkRevisionWindows);
  const notifications = useVisibleNotifications();
  const unread = notifications.filter((n) => !n.read).length;
  const profilePhoto = useIrerc((s) => s.profilePhotos[role]);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    checkRevisionWindows();
    const timer = window.setInterval(checkRevisionWindows, 60_000);
    return () => window.clearInterval(timer);
  }, [checkRevisionWindows]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeModal]);

  const badges = badgeMap(role, acting, protocols, safety);
  const items = NAV.filter((n) => n.roles.includes(role));
  const RoleIcon = ROLE_ICON[role];

  return (
    <div className="min-h-screen bg-gradient-to-br from-ink via-ink to-panel-2 text-fg">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-white/20 bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-600 px-2 text-white shadow-xl md:gap-3 md:px-5">
        <button className="grid size-11 place-items-center rounded-xl border border-white/25 bg-white/10 text-white transition hover:bg-white/20 md:hidden" onClick={() => setNav(true)} aria-label="Open menu">
          <Menu className="size-5" />
        </button>
        <img src="/seal.png" alt="" className="size-9 rounded-xl object-contain" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{BRAND.short}</p>
          <p className="hidden text-[10px] font-semibold tracking-[0.18em] text-white/70 uppercase sm:block">Institutional Portal</p>
        </div>
        <label className="relative ml-auto hidden min-w-0 flex-1 md:block md:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/70" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); if (view !== "protocols" && view !== "detail") go("protocols"); }}
            placeholder="Search protocol, investigator, site"
            className="min-h-11 w-full rounded-xl border border-white/25 bg-white/15 pr-3 pl-9 text-sm text-white outline-none transition placeholder:text-white/65 focus:border-white/60 focus:bg-white/20 focus:ring-4 focus:ring-white/15"
          />
        </label>
        <div className="ml-auto hidden text-right sm:block md:ml-0">
          <p className="text-sm font-semibold text-white">{ROLES[role].name}</p>
          <p className="text-[10px] font-semibold tracking-wide text-white/70 uppercase">{ROLES[role].title}</p>
        </div>
        <button
          type="button"
          className="hidden size-10 overflow-hidden rounded-full ring-2 ring-white/35 transition hover:ring-white/70 sm:block"
          title="Change profile photo"
          onClick={() => go("settings")}
        >
          {profilePhoto ? (
            <img src={profilePhoto} alt="Profile" className="size-full object-cover" />
          ) : (
            <span className="grid size-full place-items-center bg-white/20 text-xs font-bold text-white">
              {ROLES[role].initials}
            </span>
          )}
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3 text-sm font-semibold text-white transition hover:bg-white/20"
          onClick={() => go("settings")}
          aria-label="Settings and role guide"
        >
          <Settings className="size-4" />
          <span className="hidden lg:inline">Settings</span>
        </button>
        <button
          type="button"
          className="relative grid size-11 place-items-center rounded-xl border border-white/25 bg-white/10 text-white transition hover:bg-white/20"
          onClick={() => setNotifOpen(true)}
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        >
          <Bell className="size-5" />
          {unread ? (
            <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-gradient-to-br from-amber to-rose px-1 text-[10px] font-bold text-white shadow">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
        <ThemePicker compact inverted />
      </header>
      <div className="border-b border-line bg-gradient-to-r from-sky/10 via-panel to-em/10 px-3 py-2 md:hidden">
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); if (view !== "protocols") go("protocols"); }}
            placeholder="Search"
            className="min-h-11 w-full rounded-xl border border-line bg-ink-2 pr-3 pl-9 text-sm outline-none focus:border-sky"
          />
        </label>
      </div>
      <div className="flex">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 overflow-y-auto border-r border-line/70 bg-gradient-to-b from-sky/15 via-panel to-em/15 p-3 md:block">
          <p className="mb-2 px-2 text-[10px] font-bold tracking-[0.2em] text-muted uppercase">Navigation</p>
          <NavItems items={items} view={view} badges={badges} onGo={go} />
        </aside>
        {navOpen ? (
          <div className="fixed inset-0 z-40 md:hidden">
            <button className="absolute inset-0 bg-scrim/70" aria-label="Close menu" onClick={() => setNav(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 overflow-y-auto border-r border-line bg-gradient-to-b from-sky/20 via-panel to-em/20 p-3 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-sky to-em text-on-accent">
                    <RoleIcon className="size-4" />
                  </span>
                  <p className="text-sm font-semibold">{ROLE_GATE[role].label}</p>
                </div>
                <button className="grid size-11 place-items-center" onClick={() => setNav(false)} aria-label="Close"><X /></button>
              </div>
              <NavItems items={items} view={view} badges={badges} onGo={go} />
            </aside>
          </div>
        ) : null}
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
          {view === "dashboard" ? <Dashboard /> : null}
          {view === "protocols" ? <ProtocolList /> : null}
          {view === "screening" ? <ProtocolList preset={["submitted", "screening", "correction", "complete"]} /> : null}
          {view === "detail" ? <ProtocolDetail /> : null}
          {view === "reviews" ? <ReviewsDesk /> : null}
          {view === "committee" ? <CommitteeDesk /> : null}
          {view === "safety" ? <SafetyDesk /> : null}
          {view === "monitor" ? <MonitorDesk /> : null}
          {view === "archive" ? <ArchiveDesk /> : null}
          {view === "system" ? <SystemDesk /> : null}
          {view === "roster" ? <RosterDesk /> : null}
          {view === "settings" ? <SettingsDesk /> : null}
        </main>
      </div>
      <footer className="border-t border-line/60 bg-panel/60 px-4 py-4 text-center text-[11px] text-muted">
        Developed by: <span className="font-semibold text-sky">Addis Ababa City Data Management Center</span>
      </footer>
      <ModalHost />
      <NotificationCenter open={notifOpen} onClose={() => setNotifOpen(false)} />
      <Confetti n={celebrate} />
      <div className="pointer-events-none fixed right-3 bottom-3 z-50 flex w-[min(100%-1.5rem,22rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm font-semibold shadow-card ${t.kind === "warn" ? "border-amber/40 bg-amber text-on-accent" : "border-em/40 bg-em text-on-accent"}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}

function NavItems({
  items,
  view,
  badges,
  onGo,
}: {
  items: typeof NAV;
  view: ViewKey;
  badges: Partial<Record<ViewKey, number>>;
  onGo: (v: ViewKey) => void;
}) {
  return (
    <nav className="space-y-1.5">
      {items.map((item) => {
        const Icon = ICONS[item.key];
        const tone = NAV_TONE[item.key];
        const active = view === item.key || (view === "detail" && item.key === "protocols");
        const count = badges[item.key];
        return (
          <button
            key={item.key}
            onClick={() => onGo(item.key)}
            className={`group relative flex min-h-12 w-full items-center gap-3 overflow-hidden rounded-xl border px-2.5 text-left text-sm font-semibold transition ${
              active
                ? `border-transparent bg-gradient-to-r ${tone.active} text-fg shadow-sm ring-1`
                : "border-transparent text-muted hover:border-line/80 hover:bg-panel/80 hover:text-fg"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {active ? <span className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-gradient-to-b from-sky to-em" /> : null}
            <span className={`grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${tone.tile} text-white shadow-sm transition group-hover:scale-105`}>
              <Icon className="size-4" />
            </span>
            <span className="flex-1">{item.label}</span>
            {item.important ? (
              <span className="size-2 shrink-0 rounded-full bg-amber shadow-[0_0_8px_var(--color-amber)]" title="Important" />
            ) : null}
            {count ? (
              <span className="rounded-full bg-gradient-to-br from-amber to-rose px-2 py-0.5 text-[10px] font-bold text-white tabular-nums shadow-sm">
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

function badgeMap(role: RoleKey, acting: string, protocols: ReturnType<typeof useIrerc.getState>["protocols"], safety: ReturnType<typeof useIrerc.getState>["safety"]) {
  const list = protocols.filter((p) => visibleTo(role, p));
  const queue = workItems(role, acting, protocols).length;
  const pendingSafety = safety.filter((s) => s.status === "Pending review" && list.some((p) => p.id === s.protocolId)).length;
  const map: Partial<Record<ViewKey, number>> = {};
  if (queue) map.dashboard = queue;
  if (role === "secretariat" || role === "admin") {
    const n = list.filter((p) => ["submitted", "screening", "correction", "complete"].includes(p.status)).length;
    if (n) map.screening = n;
  }
  if (role === "reviewer") {
    const n = list.filter((p) => myReviewPending(p, acting)).length;
    if (n) map.reviews = n;
  }
  if (role === "chair" || role === "secretariat") {
    const n = protocols.filter((p) => p.status === "agenda" || p.status === "reviews_complete" || (role !== "chair" && p.status === "decided")).length;
    if (n) map.committee = n;
  }
  if (pendingSafety) map.safety = pendingSafety;
  const monitor = list.filter((p) => p.status === "active" && p.continuingDue && p.continuingDue <= addDays(TODAY, 45)).length
    + list.filter((p) => p.amendment?.status === "Pending review").length;
  if (monitor) map.monitor = monitor;
  return map;
}

function Confetti({ n }: { n: number }) {
  const [bits, setBits] = useState<{ id: string; left: number; delay: number; dur: number; color: string }[]>([]);
  useEffect(() => {
    if (!n) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["var(--color-sky)", "var(--color-em)", "var(--color-amber)", "var(--color-rose)"];
    setBits(Array.from({ length: 42 }, (_, i) => ({
      id: `${n}-${i}`,
      left: Math.random() * 100,
      delay: Math.random() * 0.25,
      dur: 1.5 + Math.random() * 1.2,
      color: colors[i % colors.length]!,
    })));
    const t = window.setTimeout(() => setBits([]), 3200);
    return () => window.clearTimeout(t);
  }, [n]);
  return (
    <>
      {bits.map((b) => (
        <span
          key={b.id}
          className="confetti-bit"
          style={{
            left: `${b.left}vw`,
            background: b.color,
            width: 8,
            height: 12,
            animationDuration: `${b.dur}s`,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}
    </>
  );
}

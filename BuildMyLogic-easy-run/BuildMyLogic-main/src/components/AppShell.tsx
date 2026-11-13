import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { LayoutGrid, BookOpen, Timer, Settings as SettingsIcon, LogOut, Bell, ChevronDown, MessageCircle, BarChart3, Camera } from "lucide-react";
import { getLoopState, resetLoop, setLoopState, useLoop } from "@/lib/loop-store";
import { GoogleSignIn } from "@/components/GoogleSignIn";
import { StruggleCelebration } from "@/components/struggle/StruggleCelebration";
import { signOut, useAuth } from "@/lib/auth";
import { useCloudHydrated } from "@/lib/cloud-sync";

const NAV = [
  { to: "/auth/dashboard", label: "Home", icon: LayoutGrid },
  { to: "/learn", label: "Learn", icon: BookOpen },
  { to: "/videos", label: "Videos", icon: Camera },
  { to: "/mentor", label: "AI Mentor", icon: MessageCircle },
  { to: "/progress", label: "My Progress", icon: BarChart3 },
  { to: "/sessions", label: "Sessions", icon: Timer },
] as const;

export function AppShell({ crumb, title, subtitle, quote, children, wide = false }: { crumb: string; title: string; subtitle: string; quote?: string | undefined; children: ReactNode; wide?: boolean }) {
  const state = useLoop();
  const auth = useAuth();
  const navigate = useNavigate();
  const hydrated = useCloudHydrated(auth?.uid);
  const [notice, setNotice] = useState<string | null>(null);
  const name = state.profile?.name?.trim() || "Builder";
  useEffect(() => {
    if (state.onboarded) return;
    // Signed-in learners: wait until their saved plan has actually loaded.
    if (auth && !hydrated) return;
    // During SSR hydration the first client render still carries the empty
    // server snapshot, so check the real store after hydration settles
    // instead of bouncing signed-in learners off deep links like /mentor.
    const timer = window.setTimeout(() => {
      if (!getLoopState().onboarded) void navigate({ to: "/" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [state.onboarded, navigate, auth, hydrated]);

  useEffect(() => {
    if (auth?.displayName && state.profile && (state.profile.name === "Builder" || !state.profile.name)) {
      setLoopState((prev) => ({
        ...prev,
        profile: prev.profile ? { ...prev.profile, name: auth.displayName } : prev.profile,
      }));
    }
  }, [auth, state.profile]);

  return (
    <div className="min-h-screen bg-background">
      <div className="min-w-0 pb-20">
        <header className="flex h-16 items-center justify-between gap-3 border-b border-border/60 px-4 sm:px-6 lg:h-[76px] lg:gap-5 lg:px-8">
          <Link to="/auth/dashboard" className="display flex items-center text-lg font-black tracking-[-0.05em]">BuildMyLogic<span className="mb-2 ml-0.5 h-1.5 w-1.5 rounded-full bg-primary" /></Link>
          <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
            <button type="button" onClick={() => setNotice(`${state.activity.length} updates in your build log.`)} aria-label="Notifications" className="relative rounded-full p-2 text-foreground hover:bg-muted">
              <Bell className="h-[21px] w-[21px]" strokeWidth={1.8} />
              {state.activity.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />}
            </button>
            {!auth && <div className="hidden sm:block"><GoogleSignIn compact /></div>}
            <Link to="/settings" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-xs font-semibold text-ink-foreground">{name.slice(0, 1).toUpperCase()}</span>
              <span className="hidden text-sm font-semibold sm:inline">{name}</span><ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Link>
            <button
              type="button"
              onClick={() => { signOut(); resetLoop(); void navigate({ to: "/" }); }}
              aria-label="Log out"
              title="Log out"
              className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-[19px] w-[19px]" strokeWidth={1.8} />
            </button>
          </div>
        </header>

        <main className={`mx-auto px-4 pb-12 pt-5 sm:px-7 sm:pt-7 ${wide ? "max-w-[1420px]" : "max-w-[1320px]"}`}>
          <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{crumb}</p>
              <h1 className="display text-[28px] font-extrabold leading-[1.08] sm:text-[42px] sm:leading-[1.04] tracking-[-0.055em]">{title}</h1>
              <p className="mt-2 max-w-4xl text-[15px] leading-6 sm:text-[17px] text-muted-foreground">{subtitle}</p>
            </div>
            {quote && <p className="hidden max-w-[190px] pt-3 text-right lg:block text-[13px] leading-5 text-muted-foreground">“{quote}”</p>}
          </div>
          {notice && <div className="mb-5 rounded-xl border border-primary/20 bg-primary-soft px-4 py-3 text-xs font-medium text-accent-foreground">{notice}</div>}
          {children}
        </main>
      </div>
      <StruggleCelebration />
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Main">
        <div className="mx-auto flex w-full max-w-3xl">
          {[...NAV, { to: "/settings", label: "Settings", icon: SettingsIcon }].map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:py-2.5 sm:text-[11px]" activeProps={{ className: "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-bold text-primary sm:py-2.5 sm:text-[11px]" }}>
              <Icon className="h-5 w-5" strokeWidth={1.9} />
              <span className="max-w-full truncate">{label === "AI Mentor" ? "Mentor" : label === "My Progress" ? "Progress" : label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

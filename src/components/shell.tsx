import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  Calendar,
  ChevronDown,
  FileBarChart,
  Layers,
  LayoutGrid,
  Printer,
  Smartphone,
  Tv,
  Edit,
} from "lucide-react";
import { PERIODS, VIEW_DEP, type ViewId } from "@/lib/domain";
import { usePerfStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Overview } from "@/components/overview";
import { TvAcView } from "@/components/tv-ac-view";
import { MdaSdaView } from "@/components/mda-sda-view";
import { MobileGroupView } from "@/components/mobile-view";
import { ReportsView } from "@/components/reports-view";
import { DailyEditor } from "@/components/daily-editor";
import { cn } from "@/lib/utils";

const NAV: {
  id: ViewId;
  label: string;
  short: string;
  icon: typeof LayoutGrid;
}[] = [
  { id: "overview", label: "Overview", short: "Home", icon: LayoutGrid },
  { id: "tv", label: "TV — AC", short: "TV·AC", icon: Tv },
  { id: "mda", label: "MDA - SDA", short: "MDA·SDA", icon: Layers },
  { id: "mobile", label: "Mobile", short: "Mobile", icon: Smartphone },
  { id: "daily", label: "Daily Editor", short: "Daily", icon: Edit },
  { id: "reports", label: "Reports", short: "Report", icon: FileBarChart },
];

export function Shell() {
  const view = usePerfStore((s) => s.view);
  const hydrate = usePerfStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();

    // Auto-polling every 15s to keep all employee screens synchronized in real-time
    const interval = setInterval(() => {
      hydrate(true);
    }, 15000);

    const onSync = () => {
      if (document.visibilityState === "visible") {
        hydrate(true);
      }
    };

    window.addEventListener("focus", onSync);
    document.addEventListener("visibilitychange", onSync);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onSync);
      document.removeEventListener("visibilitychange", onSync);
    };
  }, [hydrate]);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="flex min-h-dvh flex-col">
        <Topbar />
        <main className="flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10">
          {view === "overview" && <Overview />}
          {view === "tv" && <TvAcView />}
          {view === "mda" && <MdaSdaView />}
          {view === "mobile" && <MobileGroupView />}
          {view === "daily" && <DailyEditor />}
          {view === "reports" && <ReportsView />}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

function Brand({ showText = true }: { showText?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/f1.png"
        alt="F1"
        className="h-8 w-auto shrink-0 object-contain sm:h-9"
      />
      {showText && (
        <div className="min-w-0">
          <div className="truncate text-sm font-bold tracking-tight text-foreground">
            Fayoum 1
          </div>
        </div>
      )}
    </div>
  );
}

function Sidebar() {
  const view = usePerfStore((s) => s.view);
  const setView = usePerfStore((s) => s.setView);

  return (
    <aside className="print-hidden sticky top-0 hidden h-dvh flex-col border-r border-border bg-navy/70 px-3 py-5 lg:flex">
      <div className="px-2 pb-6">
        <Brand />
      </div>
      <p className="px-3 pb-2 text-2xs font-semibold tracking-kicker text-subtle uppercase">
        Workspace
      </p>
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={cn(
                "pressable flex h-11 items-center gap-3 rounded-xl px-3 text-sm",
                active
                  ? "bg-card-2 text-foreground"
                  : "text-muted hover:bg-card/60 hover:text-foreground",
              )}
            >
              <Icon
                className={cn("size-4", active ? "text-primary" : "text-subtle")}
                strokeWidth={1.75}
              />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-border px-3 pt-4 text-xs text-subtle">
        Created By Mohamed Sabry
        <br />
        FY 2026
      </div>
    </aside>
  );
}

function Topbar() {
  const period = usePerfStore((s) => s.period);
  const setPeriod = usePerfStore((s) => s.setPeriod);
  const view = usePerfStore((s) => s.view);
  const role = usePerfStore((s) => s.role);
  const setRole = usePerfStore((s) => s.setRole);
  const [managerOpen, setManagerOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const today = format(new Date(), "EEE d MMM yyyy");

  return (
    <header className="print-hidden sticky top-0 z-30 border-b border-border bg-navy px-3 py-2 pt-safe sm:px-6 lg:px-8">
      <div className="flex min-h-11 items-center justify-between gap-2">
        <Brand showText={false} />
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="hidden text-xs text-subtle sm:inline">{today}</span>
          <button
            type="button"
            onClick={() => {
              if (role === "manager") {
                setRole("staff");
              } else {
                setPassword("");
                setPasswordError("");
                setManagerOpen(true);
              }
            }}
            className={cn(
              "pressable h-8 rounded-lg px-2.5 text-xs font-medium sm:px-3",
              role === "manager"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted",
            )}
          >
            {role === "manager" ? "Exit Manager" : "Manager"}
          </button>
          <div className="relative flex items-center">
            <Calendar
              className="pointer-events-none absolute left-1.5 size-4 text-primary"
              aria-hidden
            />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
              className="h-8 max-w-[132px] min-w-0 appearance-none rounded-lg border border-primary/40 bg-card py-0 pl-7 pr-6 text-[11px] font-semibold text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:max-w-[140px] sm:text-xs"
            >
              {PERIODS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-1.5 size-3.5 text-subtle"
              aria-hidden
            />
          </div>
          {(view === "overview" || view === "reports") && (
            <Button
              variant="outline"
              size="icon"
              className="hidden h-8 w-8 shrink-0 sm:inline-flex"
              aria-label="Print"
              onClick={() => window.print()}
            >
              <Printer />
            </Button>
          )}
        </div>
      </div>
      {managerOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <form
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl"
            onSubmit={(event) => {
              event.preventDefault();
              if (password !== "Fay1") {
                setPasswordError("Incorrect password");
                return;
              }
              setRole("manager");
              setManagerOpen(false);
              setPassword("");
            }}
          >
            <h2 className="text-lg font-semibold text-foreground">Manager access</h2>
            <p className="mt-1 text-sm text-muted">Enter the manager password to edit targets and actuals.</p>
            <input
              autoFocus
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-4 h-11 w-full rounded-lg border border-border bg-navy px-3 text-foreground outline-none focus:border-primary"
              placeholder="Password"
            />
            {passwordError && <p className="mt-2 text-sm text-red-400">{passwordError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-lg px-3 py-2 text-sm text-muted" onClick={() => setManagerOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                Continue
              </button>
            </div>
          </form>
        </div>
      )}
    </header>
  );
}

function MobileNav() {
  const view = usePerfStore((s) => s.view);
  const setView = usePerfStore((s) => s.setView);

  return (
    <nav className="print-hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-navy pb-safe lg:hidden">
      <div className="grid grid-cols-6">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-0.5 whitespace-nowrap px-0.5 text-[10px] font-medium",
                active ? "text-primary" : "text-subtle",
              )}
            >
              <Icon className="size-4" strokeWidth={active ? 2 : 1.75} />
              {item.short}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

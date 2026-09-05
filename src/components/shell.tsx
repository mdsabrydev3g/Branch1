import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  FileBarChart,
  Layers,
  LayoutGrid,
  Printer,
  Smartphone,
  Tv,
} from "lucide-react";
import { PERIODS, VIEW_DEP, type ViewId } from "@/lib/domain";
import { usePerfStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Overview } from "@/components/overview";
import { DepartmentGroupView } from "@/components/department-view";
import { ReportsView } from "@/components/reports-view";
import { cn } from "@/lib/utils";

const NAV: {
  id: ViewId;
  label: string;
  short: string;
  icon: typeof LayoutGrid;
}[] = [
  { id: "overview", label: "Overview", short: "Home", icon: LayoutGrid },
  { id: "tv", label: "TV — AC", short: "TV-AC", icon: Tv },
  { id: "mda", label: "MDA — SDA", short: "MDA", icon: Layers },
  { id: "mobile", label: "Mobile", short: "Mobile", icon: Smartphone },
  { id: "reports", label: "Reports", short: "Report", icon: FileBarChart },
];

export function Shell() {
  const view = usePerfStore((s) => s.view);
  const hydrate = usePerfStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="flex min-h-dvh flex-col">
        <Topbar />
        <main className="flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10">
          {view === "overview" && <Overview />}
          {view === "tv" && (
            <DepartmentGroupView title="TV + AC" deps={["TV", "AC"]} />
          )}
          {view === "mda" && (
            <DepartmentGroupView title="MDA + SDA" deps={["MDA", "SDA"]} />
          )}
          {view === "mobile" && (
            <DepartmentGroupView
              title="Mobile"
              deps={["IT Laptop", "IT Other", "Telecom Mobile", "Telecom ACC"]}
            />
          )}
          {view === "reports" && <ReportsView />}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="brand-mark grid size-9 place-items-center rounded-lg font-sans text-sm font-semibold">
        F1
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-foreground">
          Fayoum 1
        </div>
        <div className="truncate text-xs text-subtle">Command Center</div>
      </div>
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
        Internal performance workspace
        <br />
        FY 2026 · v2.0
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
    <header className="print-hidden sticky top-0 z-30 flex flex-col gap-3 border-b border-border bg-navy px-4 py-3 pt-safe sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
      <div className="flex items-center justify-between gap-3 lg:hidden">
        <Brand />
        <span className="text-xs text-subtle">{today}</span>
      </div>
      <div className="hidden text-xs text-subtle lg:block">{today}</div>
      <div className="flex w-full items-center gap-2 lg:w-auto lg:justify-end">
        <div className="inline-flex">
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
              "pressable rounded-lg px-3 py-2 text-xs font-medium",
              role === "manager"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted",
            )}
          >
            {role === "manager" ? "Exit Manager Mode" : "Manager"}
          </button>
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-6 gap-1 lg:flex lg:flex-none">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              aria-pressed={period === p.id}
              className={cn(
                "pressable h-11 rounded-lg text-xs font-medium sm:text-sm lg:px-3",
                period === p.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted hover:bg-card-2 hover:text-foreground",
              )}
            >
              {p.short}
            </button>
          ))}
        </div>
        {(view === "overview" || view === "reports") && (
          <Button
            variant="outline"
            size="icon"
            className="hidden shrink-0 sm:inline-flex"
            aria-label="Print"
            onClick={() => window.print()}
          >
            <Printer />
          </Button>
        )}
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
      <div className="grid grid-cols-5">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 text-2xs font-medium",
                active ? "text-primary" : "text-subtle",
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2 : 1.75} />
              {item.short}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

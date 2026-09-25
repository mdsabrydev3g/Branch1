import { useEffect } from "react";
import { format } from "date-fns";
import {
  FileBarChart,
  Layers,
  LayoutGrid,
  Moon,
  Printer,
  Smartphone,
  Sun,
  Tv,
  Edit,
} from "lucide-react";
import { type ViewId } from "@/lib/domain";
import { usePerfStore } from "@/lib/store";
import { isRealtimeLive, resyncNow, startRealtimeSync } from "@/lib/realtime/client";
import { usePrefs, usePrefsEffect } from "@/lib/prefs";
import { Button } from "@/components/ui/button";
import { MonthPicker } from "@/components/month-picker";
import { Overview } from "@/components/overview";
import { TvAcView } from "@/components/tv-ac-view";
import { MdaSdaView } from "@/components/mda-sda-view";
import { MobileGroupView } from "@/components/mobile-view";
import { ReportsView } from "@/components/reports-view";
import { DailyEditor } from "@/components/daily-editor";
import { cn } from "@/lib/utils";
import { requestDesktopNotificationPermission } from "@/lib/notifications";

const NAV: {
  id: ViewId;
  label: string;
  short: string;
  icon: typeof LayoutGrid;
}[] = [
  { id: "overview", label: "Overview", short: "Home", icon: LayoutGrid },
  { id: "tv", label: "TV-AC", short: "TV-AC", icon: Tv },
  { id: "mda", label: "MDA-SDA", short: "MDA-SDA", icon: Layers },
  { id: "mobile", label: "Mobile", short: "Mobile", icon: Smartphone },
  { id: "daily", label: "Daily Editor", short: "Daily", icon: Edit },
  { id: "reports", label: "Reports", short: "Report", icon: FileBarChart },
];

export function Shell() {
  const view = usePerfStore((s) => s.view);
  const hydrate = usePerfStore((s) => s.hydrate);
  const syncRole = usePerfStore((s) => s.syncRole);

  useEffect(() => {
    void requestDesktopNotificationPermission();
    hydrate();
    // دور الجلسة يأتي من السيرفر فقط — لا يُخزَّن ولا يُخمن محلياً
    void syncRole();

    // قناة التزامن: كل تغيير على أي جهاز (ويب / سطح مكتب / موبايل) يصل فوراً
    // ويُطبَّق على المخزن مباشرة — بدون إعادة تحميل للصفحة.
    const stopRealtime = startRealtimeSync();

    // الاستقصاء بقي كخطة احتياطية فقط: يعمل عندما يتعذّر إبقاء القناة مفتوحة
    // (شبكة مقفلة / انقطاع)، فلا يفقد التطبيق التزامن في أسوأ الحالات.
    const interval = setInterval(() => {
      if (!isRealtimeLive()) hydrate(true);
    }, 15000);

    const onSync = () => {
      if (document.visibilityState !== "visible") return;
      // العودة إلى الواجهة: نتحقّق دائماً من وجود أي تغيير فاتنا
      if (isRealtimeLive()) resyncNow();
      else hydrate(true);
    };

    window.addEventListener("focus", onSync);
    document.addEventListener("visibilitychange", onSync);

    return () => {
      stopRealtime();
      clearInterval(interval);
      window.removeEventListener("focus", onSync);
      document.removeEventListener("visibilitychange", onSync);
    };
  }, [hydrate, syncRole]);

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
  // اللوجو العريض: الأسود في الوضع النهاري والأبيض في الوضع الليلي. النسختان
  // مولَّدتان من نفس ملف اللوجو باللون فقط (`scripts/recolor-f1-wide.py`)،
  // وموجودتان في الـ HTML معاً و`.theme-art-*` (styles.css) يُظهر واحدة فقط —
  // فلا Hydration mismatch لأن الثيم يُقرأ من localStorage على العميل وحده.
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/f1-wide-black.png"
        alt="F1"
        width={721}
        height={316}
        className="theme-art-light h-8 w-auto shrink-0 object-contain sm:h-9"
      />
      <img
        src="/f1-wide-white.png"
        alt=""
        aria-hidden="true"
        width={721}
        height={316}
        className="theme-art-dark h-8 w-auto shrink-0 object-contain sm:h-9"
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
        <Brand showText={false} />
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
  const view = usePerfStore((s) => s.view);
  const toggleTheme = usePrefs((s) => s.toggleTheme);
  const today = format(new Date(), "EEE d MMM yyyy");
  usePrefsEffect();

  // الهيدر نفسه `flex items-center` مع حشو رأسي متساوٍ (`pt-safe` يضيف مساحة
  // النوتش فوقه فقط) — فيقع كل عنصر على خط المنتصف نفسه في كل المقاسات.
  return (
    <header className="print-hidden sticky top-0 z-30 flex items-center border-b border-border bg-navy px-3 py-2 pt-safe sm:px-6 lg:px-8">
      <div className="flex min-h-11 w-full items-center justify-between gap-2">
        <Brand showText={false} />
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="hidden text-xs text-subtle sm:inline">{today}</span>
          {/* الأيقونتان معاً في الـ DOM وCSS يُظهر واحدة حسب الثيم — فالتمركز لا
              يعتمد على JS ولا ينتج Hydration mismatch (الثيم على العميل فقط). */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle light or dark mode"
            title="Toggle light or dark mode"
            className="pressable grid size-9 place-items-center rounded-lg border border-border bg-card text-muted hover:border-primary/50 hover:text-foreground"
          >
            <Sun className="theme-art-dark size-4" strokeWidth={2} aria-hidden />
            <Moon className="theme-art-light size-4" strokeWidth={2} aria-hidden />
          </button>
          <MonthPicker />
          {view === "reports" && (
            <Button
              variant="outline"
              size="icon"
              className="hidden h-9 w-9 shrink-0 sm:inline-flex"
              aria-label="Print"
              onClick={() => window.print()}
            >
              <Printer />
            </Button>
          )}
        </div>
      </div>
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

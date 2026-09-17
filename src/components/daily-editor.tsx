import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  formatNumber,
  formatPct,
  getDaysInMonth,
  getTrackDay,
  ratio,
  DEPS,
  KPIS,
  DEP_COPY,
  statusOf,
  type Kpi,
  type Dep,
  type PeriodId,
} from "@/lib/domain";
import { usePerfStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/status-pill";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Save,
  RefreshCw,
  Target,
  TrendingUp,
  Layers,
  BarChart3,
  CheckCircle2,
  Lock,
} from "lucide-react";

export function DailyEditor() {
  const role = usePerfStore((s) => s.role);
  const setRole = usePerfStore((s) => s.setRole);
  const period = usePerfStore((s) => s.period);
  const departmentDailyActuals = usePerfStore((s) => s.departmentDailyActuals);
  const departmentTargets = usePerfStore((s) => s.departmentTargets);
  const branchDailyActuals = usePerfStore((s) => s.branchDailyActuals);
  const branchKpiTargets = usePerfStore((s) => s.branchKpiTargets);
  const branchKpis = usePerfStore((s) => s.branchKpis);
  const saveBatchDaily = usePerfStore((s) => s.saveBatchDaily);

  const [activeTab, setActiveTab] = useState<"deps" | "kpis">("deps");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Default to yesterday's date
  const [editingDate, setEditingDate] = useState<string>(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().slice(0, 10);
  });

  const [depActualDrafts, setDepActualDrafts] = useState<Record<string, string>>({});
  const [depTargetDrafts, setDepTargetDrafts] = useState<Record<string, string>>({});
  const [kpiActualDrafts, setKpiActualDrafts] = useState<Record<string, string>>({});
  const [kpiTargetDrafts, setKpiTargetDrafts] = useState<Record<string, string>>({});

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // حماية ما كتبه المستخدم من المسح التلقائي (تحديث البيانات كل 15 ثانية)
  const dirtyRef = useRef(false);
  const hydrated = usePerfStore((s) => s.hydrated);

  const daysInMonth = getDaysInMonth(period);
  const trackDay = getTrackDay(period, editingDate);

  const initDrafts = useCallback(() => {
    const periodDepDaily = departmentDailyActuals[period] ?? {};
    const periodDepTargets = departmentTargets[period] ?? {};
    const periodKpiDaily = branchDailyActuals[period] ?? {};
    const periodKpiTargets = branchKpiTargets[period] ?? {};

    const newDepActuals: Record<string, string> = {};
    const newDepTargets: Record<string, string> = {};
    DEPS.forEach((dep) => {
      const actualVal = periodDepDaily[dep]?.[editingDate];
      newDepActuals[dep] = actualVal !== undefined ? String(actualVal) : "";
      const targetVal = periodDepTargets[dep];
      newDepTargets[dep] = targetVal !== undefined ? String(targetVal) : "";
    });

    const newKpiActuals: Record<string, string> = {};
    const newKpiTargets: Record<string, string> = {};
    KPIS.forEach((kpi) => {
      const actualVal = periodKpiDaily[kpi]?.[editingDate] ?? branchKpis[kpi]?.result;
      newKpiActuals[kpi] = actualVal !== undefined && actualVal > 0 ? String(actualVal) : "";
      const targetVal = periodKpiTargets[kpi] ?? branchKpis[kpi]?.plan;
      newKpiTargets[kpi] = targetVal !== undefined && targetVal > 0 ? String(targetVal) : "";
    });

    setDepActualDrafts(newDepActuals);
    setDepTargetDrafts(newDepTargets);
    setKpiActualDrafts(newKpiActuals);
    setKpiTargetDrafts(newKpiTargets);
  }, [
    period,
    editingDate,
    departmentDailyActuals,
    departmentTargets,
    branchDailyActuals,
    branchKpiTargets,
    branchKpis,
  ]);

  // تغيير الشهر أو تاريخ الإدخال: إعادة تهيئة قسرية للخانات
  useEffect(() => {
    dirtyRef.current = false;
    initDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, editingDate]);

  // وصول بيانات جديدة من السيرفر: لا نمسح تعديلات المستخدم غير المحفوظة
  useEffect(() => {
    if (dirtyRef.current) return;
    initDrafts();
  }, [initDrafts, hydrated]);

  const handleSaveAll = async () => {
    if (role !== "manager") return;
    setSaveStatus("saving");

    try {
      const depActuals: Partial<Record<Dep, number>> = {};
      const depTargets: Partial<Record<Dep, number>> = {};
      DEPS.forEach((dep) => {
        // الخانة الفارغة تعني "بدون تغيير" — لا نكتب صفراً فوق المحقق المحفوظ
        const actStr = depActualActualValue(dep);
        if (actStr.trim() !== "") {
          depActuals[dep] = parseFloat(actStr) || 0;
        }
        const tarStr = depTargetDrafts[dep];
        if (tarStr !== undefined && tarStr !== "") {
          depTargets[dep] = parseFloat(tarStr) || 0;
        }
      });

      const kpiActuals: Partial<Record<Kpi, number>> = {};
      const kpiTargets: Partial<Record<Kpi, number>> = {};
      KPIS.forEach((kpi) => {
        // الخانة الفارغة تعني "بدون تغيير" — لا نكتب صفراً فوق المحقق المحفوظ
        const actStr = kpiActualActualValue(kpi);
        if (actStr.trim() !== "") {
          kpiActuals[kpi] = parseFloat(actStr) || 0;
        }
        const tarStr = kpiTargetDrafts[kpi];
        if (tarStr !== undefined && tarStr !== "") {
          kpiTargets[kpi] = parseFloat(tarStr) || 0;
        }
      });

      await saveBatchDaily({
        period,
        date: editingDate,
        depActuals,
        depTargets,
        kpiActuals,
        kpiTargets,
      });

      dirtyRef.current = false;
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  const depActualActualValue = (dep: Dep): string => {
    return depActualDrafts[dep] ?? "";
  };

  const kpiActualActualValue = (kpi: Kpi): string => {
    return kpiActualDrafts[kpi] ?? "";
  };

  // If not logged in as manager, show login screen
  if (role !== "manager") {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-xl">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <Lock className="size-6" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Manager Access Required</h2>
          <p className="mt-2 text-sm text-subtle">
            Enter the manager password to edit daily actuals and targets.
          </p>
          <form
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (password !== "Fay1") {
                setPasswordError("Incorrect password");
                return;
              }
              setRole("manager");
              setPassword("");
              setPasswordError("");
            }}
          >
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="h-11 w-full rounded-lg border border-border bg-navy px-3 text-foreground outline-none focus:border-primary"
            />
            {passwordError && (
              <p className="mt-2 text-sm text-red-400">{passwordError}</p>
            )}
            <Button type="submit" className="mt-4 w-full">
              Unlock Editor
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-2 sm:px-4 fade-in">
      {/* Top Banner & Date Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border bg-card/80 p-5 backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary">
              Manager Mode Active
            </span>
            <span className="text-xs text-subtle">Period: {period}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-foreground">
            Daily Cumulative Sales Editor
          </h1>
          <p className="text-xs text-subtle">
            Enter the cumulative sales achieved up to the selected date (المحقق التراكمي حتى الأمس).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-navy px-3 py-2">
            <Calendar className="size-4 text-primary" />
            <span className="text-xs font-medium text-subtle">Entry Date:</span>
            <input
              type="date"
              value={editingDate}
              onChange={(e) => setEditingDate(e.target.value)}
              className="bg-transparent text-sm font-medium text-foreground outline-none"
            />
          </div>

          <Button
            onClick={handleSaveAll}
            disabled={saveStatus === "saving"}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 shadow-lg",
              saveStatus === "saved"
                ? "bg-success text-success-foreground"
                : "bg-primary text-primary-foreground",
            )}
          >
            {saveStatus === "saving" ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                Saving to Cloud...
              </>
            ) : saveStatus === "saved" ? (
              <>
                <CheckCircle2 className="size-4" />
                Saved & Synced!
              </>
            ) : (
              <>
                <Save className="size-4" />
                Save & Sync All
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("deps")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-semibold transition-all",
            activeTab === "deps"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-foreground",
          )}
        >
          <Layers className="size-4" />
          Departments ({DEPS.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("kpis")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-semibold transition-all",
            activeTab === "kpis"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-foreground",
          )}
        >
          <BarChart3 className="size-4" />
          Main KPIs ({KPIS.length})
        </button>
      </div>

      {/* Tab 1: Departments */}
      {activeTab === "deps" && (
        <section className="rounded-2xl border border-border bg-card/80 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Department Cumulative Performance
              </h2>
              <p className="text-xs text-subtle">
                Enter cumulative actual sales for each department up to {editingDate}
              </p>
            </div>
            <div className="text-xs text-subtle">
              Track Day: <span className="font-semibold text-foreground">{trackDay}</span> of{" "}
              {daysInMonth} days
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-card-2/40 text-2xs uppercase tracking-wider text-subtle">
                  <th className="px-4 py-3 font-semibold">Department</th>
                  <th className="px-3 py-3 font-semibold">Monthly Target</th>
                  <th className="px-3 py-3 font-semibold">Daily Target</th>
                  <th className="px-3 py-3 font-semibold">Track (حتى الأمس)</th>
                  <th className="px-3 py-3 font-semibold text-primary">
                    المحقق التراكمي (Actual)
                  </th>
                  <th className="px-3 py-3 font-semibold text-right">Achievement %</th>
                  <th className="px-4 py-3 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {DEPS.map((dep) => {
                  const targetVal = parseFloat(depTargetDrafts[dep] || "0") || 0;
                  const actualVal = parseFloat(depActualDrafts[dep] || "0") || 0;
                  const dailyTarget = targetVal > 0 ? targetVal / daysInMonth : 0;
                  const trackTarget = dailyTarget * trackDay;
                  const achievementRatio = trackTarget > 0 ? actualVal / trackTarget : 0;

                  return (
                    <tr key={dep} className="hover:bg-card-2/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div className="font-semibold">{dep}</div>
                        <div className="text-2xs text-subtle">{DEP_COPY[dep]?.blurb}</div>
                      </td>

                      {/* Monthly Target Input */}
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          value={depTargetDrafts[dep] ?? ""}
                          onChange={(e) => {
                            dirtyRef.current = true;
                            setDepTargetDrafts((prev) => ({ ...prev, [dep]: e.target.value }));
                          }}
                          placeholder="0"
                          className="h-9 w-28 rounded-lg border border-border bg-navy px-2.5 font-mono text-xs text-foreground outline-none focus:border-primary"
                        />
                      </td>

                      {/* Daily Target (Calculated) */}
                      <td className="px-3 py-3 font-mono text-xs text-subtle">
                        {formatNumber(dailyTarget)}
                      </td>

                      {/* Track Target (Calculated) */}
                      <td className="px-3 py-3 font-mono text-xs text-muted">
                        {formatNumber(trackTarget)}
                      </td>

                      {/* Cumulative Actual Input */}
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          value={depActualDrafts[dep] ?? ""}
                          onChange={(e) => {
                            dirtyRef.current = true;
                            setDepActualDrafts((prev) => ({ ...prev, [dep]: e.target.value }));
                          }}
                          placeholder="0"
                          className="h-10 w-32 rounded-lg border-2 border-primary/50 bg-navy px-3 font-mono text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                      </td>

                      {/* Achievement Ratio */}
                      <td className="px-3 py-3 text-right font-mono text-xs font-semibold">
                        <span
                          className={cn(
                            achievementRatio >= 1
                              ? "text-success"
                              : achievementRatio >= 0.8
                                ? "text-amber-400"
                                : "text-danger",
                          )}
                        >
                          {formatPct(achievementRatio)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-right">
                        <StatusPill ratio={achievementRatio} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tab 2: KPIs */}
      {activeTab === "kpis" && (
        <section className="rounded-2xl border border-border bg-card/80 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Main KPIs Cumulative Performance
              </h2>
              <p className="text-xs text-subtle">
                Enter cumulative actuals for main indicators up to {editingDate}
              </p>
            </div>
            <div className="text-xs text-subtle">
              Track Day: <span className="font-semibold text-foreground">{trackDay}</span> of{" "}
              {daysInMonth} days
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-card-2/40 text-2xs uppercase tracking-wider text-subtle">
                  <th className="px-4 py-3 font-semibold">KPI</th>
                  <th className="px-3 py-3 font-semibold">Target (Plan)</th>
                  <th className="px-3 py-3 font-semibold">Track (حتى الأمس)</th>
                  <th className="px-3 py-3 font-semibold text-primary">
                    المحقق التراكمي (Actual)
                  </th>
                  <th className="px-3 py-3 font-semibold text-right">Achievement %</th>
                  <th className="px-4 py-3 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {KPIS.map((kpi) => {
                  const targetVal = parseFloat(kpiTargetDrafts[kpi] || "0") || 0;
                  const actualVal = parseFloat(kpiActualDrafts[kpi] || "0") || 0;
                  const dailyTarget = targetVal > 0 ? targetVal / daysInMonth : 0;
                  const trackTarget = dailyTarget * trackDay;
                  const achievementRatio = trackTarget > 0 ? actualVal / trackTarget : 0;

                  return (
                    <tr key={kpi} className="hover:bg-card-2/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div className="font-semibold">{kpi}</div>
                      </td>

                      {/* Target Input */}
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          value={kpiTargetDrafts[kpi] ?? ""}
                          onChange={(e) => {
                            dirtyRef.current = true;
                            setKpiTargetDrafts((prev) => ({ ...prev, [kpi]: e.target.value }));
                          }}
                          placeholder="0"
                          className="h-9 w-28 rounded-lg border border-border bg-navy px-2.5 font-mono text-xs text-foreground outline-none focus:border-primary"
                        />
                      </td>

                      {/* Track Target */}
                      <td className="px-3 py-3 font-mono text-xs text-muted">
                        {formatNumber(trackTarget)}
                      </td>

                      {/* Cumulative Actual Input */}
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          value={kpiActualDrafts[kpi] ?? ""}
                          onChange={(e) => {
                            dirtyRef.current = true;
                            setKpiActualDrafts((prev) => ({ ...prev, [kpi]: e.target.value }));
                          }}
                          placeholder="0"
                          className="h-10 w-32 rounded-lg border-2 border-primary/50 bg-navy px-3 font-mono text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                      </td>

                      {/* Achievement Ratio */}
                      <td className="px-3 py-3 text-right font-mono text-xs font-semibold">
                        <span
                          className={cn(
                            achievementRatio >= 1
                              ? "text-success"
                              : achievementRatio >= 0.8
                                ? "text-amber-400"
                                : "text-danger",
                          )}
                        >
                          {formatPct(achievementRatio)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-right">
                        <StatusPill ratio={achievementRatio} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Bottom Save Bar for easy access */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card-2/60 p-4">
        <span className="text-xs text-subtle">
          Clicking save will instantly persist data to the cloud database and sync with all employees.
        </span>
        <Button
          onClick={handleSaveAll}
          disabled={saveStatus === "saving"}
          className="flex items-center gap-2 px-6"
        >
          {saveStatus === "saving" ? (
            <>
              <RefreshCw className="size-4 animate-spin" />
              Saving...
            </>
          ) : saveStatus === "saved" ? (
            <>
              <CheckCircle2 className="size-4" />
              Saved & Synced!
            </>
          ) : (
            <>
              <Save className="size-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
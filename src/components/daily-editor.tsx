import { useState, useEffect, useRef, useCallback } from "react";
import {
  formatNumber,
  formatPct,
  getDaysInMonth,
  localDateString,
  DEPS,
  KPIS,
  DEP_COPY,
  type Kpi,
  type Dep,
} from "@/lib/domain";
import { usePerfStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { AdminAuthDialog } from "@/components/admin-auth-dialog";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Save,
  RefreshCw,
  Layers,
  BarChart3,
  CheckCircle2,
  Pencil,
  X,
  Calculator,
} from "lucide-react";

/**
 * Daily Sales Editor — المصدر الوحيد للإدخال.
 * المدخل = المحقق التراكمي من بداية الشهر حتى التاريخ المختار؛
 * مبيعات اليوم = القراءة الحالية − آخر قراءة قبلها (تُحسب تلقائياً وتظهر
 * في صفحات الأقسام TV-AC / MDA-SDA / Mobile في خانة Daily).
 * الحقول مقفولة افتراضياً — زر "تعديل" يفتحها ثم "حفظ" يثبّت التغييرات.
 */
export function DailyEditor() {
  const role = usePerfStore((s) => s.role);
  const [managerOpen, setManagerOpen] = useState(false);
  const period = usePerfStore((s) => s.period);
  const departmentDailyActuals = usePerfStore((s) => s.departmentDailyActuals);
  const departmentTargets = usePerfStore((s) => s.departmentTargets);
  const branchDailyActuals = usePerfStore((s) => s.branchDailyActuals);
  const branchKpiTargets = usePerfStore((s) => s.branchKpiTargets);
  const branchKpisByPeriod = usePerfStore((s) => s.branchKpisByPeriod);
  const saveBatchDaily = usePerfStore((s) => s.saveBatchDaily);
  const saveMonthlyKpiActuals = usePerfStore((s) => s.saveMonthlyKpiActuals);

  const [activeTab, setActiveTab] = useState<"deps" | "kpis">("deps");

  // الافتراضي هو تاريخ اليوم: الإدخال يُحفظ تحت التاريخ المختار من خانة التاريخ
  const [editingDate, setEditingDate] = useState<string>(() => localDateString());

  // وضع التعديل: الحقول مقفولة حتى الضغط على "تعديل"، والحفظ يغلقها من جديد
  const [editMode, setEditMode] = useState(false);
  const [monthlyEditMode, setMonthlyEditMode] = useState(false);

  const [depActualDrafts, setDepActualDrafts] = useState<Record<string, string>>({});
  const [depTargetDrafts, setDepTargetDrafts] = useState<Record<string, string>>({});
  const [kpiActualDrafts, setKpiActualDrafts] = useState<Record<string, string>>({});
  const [kpiTargetDrafts, setKpiTargetDrafts] = useState<Record<string, string>>({});
  const [monthlyKpiDrafts, setMonthlyKpiDrafts] = useState<Record<string, string>>({});

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // حماية ما كتبه المستخدم من المسح التلقائي (تحديث البيانات كل 15 ثانية)
  const dirtyRef = useRef(false);
  const hydrated = usePerfStore((s) => s.hydrated);

  const daysInMonth = getDaysInMonth(period);
  const minDate = `${period}-01`;
  const maxDate = `${period}-${String(daysInMonth).padStart(2, "0")}`;

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
      const actualVal = periodKpiDaily[kpi]?.[editingDate];
      newKpiActuals[kpi] = actualVal !== undefined && actualVal > 0 ? String(actualVal) : "";
      const targetVal = periodKpiTargets[kpi] ?? branchKpisByPeriod[period]?.[kpi]?.plan;
      newKpiTargets[kpi] = targetVal !== undefined && targetVal > 0 ? String(targetVal) : "";
    });

    setDepActualDrafts(newDepActuals);
    setDepTargetDrafts(newDepTargets);
    setKpiActualDrafts(newKpiActuals);
    setKpiTargetDrafts(newKpiTargets);
    const monthly: Record<string, string> = {};
    KPIS.forEach((kpi) => {
      const value = branchKpisByPeriod[period]?.[kpi]?.result;
      monthly[kpi] = value !== undefined ? String(value) : "";
    });
    setMonthlyKpiDrafts(monthly);
  }, [
    period,
    editingDate,
    departmentDailyActuals,
    departmentTargets,
    branchDailyActuals,
    branchKpiTargets,
    branchKpisByPeriod,
  ]);

  // عند تغيير الشهر، انتقل تلقائيًا إلى تاريخ صالح داخل الشهر المختار.
  // هذا يمنع بقاء تاريخ من شهر سابق/لاحق، مع الحفاظ على اختيار المستخدم داخل الشهر.
  useEffect(() => {
    if (editingDate.slice(0, 7) !== period) {
      const today = localDateString();
      if (today.slice(0, 7) === period) {
        setEditingDate(today);
      } else if (period < today.slice(0, 7)) {
        setEditingDate(maxDate);
      } else {
        setEditingDate(minDate);
      }
      return;
    }

    dirtyRef.current = false;
    setEditMode(false);
    initDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, editingDate]);

  // وصول بيانات جديدة من السيرفر: لا نمسح تعديلات المستخدم غير المحفوظة
  useEffect(() => {
    if (dirtyRef.current) return;
    initDrafts();
  }, [initDrafts, hydrated]);

  const startEdit = () => {
    if (role !== "manager") { setManagerOpen(true); return; }
    dirtyRef.current = false;
    initDrafts();
    setEditMode(true);
  };

  const startAddDaily = () => {
    if (role !== "manager") { setManagerOpen(true); return; }
    dirtyRef.current = false;
    setDepActualDrafts({});
    setKpiActualDrafts({});
    setEditMode(true);
  };

  const startMonthlyEdit = (mode: "add" | "edit") => {
    if (role !== "manager") { setManagerOpen(true); return; }
    initDrafts();
    if (mode === "add") setMonthlyKpiDrafts({});
    setMonthlyEditMode(true);
  };

  const cancelEdit = () => {
    dirtyRef.current = false;
    initDrafts();
    setEditMode(false);
  };

  const handleSaveMonthly = async () => {
    if (role !== "manager") return;
    const actuals: Partial<Record<Kpi, number>> = {};
    KPIS.forEach((kpi) => {
      const value = monthlyKpiDrafts[kpi];
      if (value !== undefined && value.trim() !== "") actuals[kpi] = parseFloat(value) || 0;
    });
    try { await saveMonthlyKpiActuals({ period, actuals }); setMonthlyEditMode(false); } catch { /* keep editor open */ }
  };

  const handleSaveAll = async () => {
    if (role !== "manager") return;
    setSaveStatus("saving");

    try {
      const depActuals: Partial<Record<Dep, number>> = {};
      const depTargets: Partial<Record<Dep, number>> = {};
      DEPS.forEach((dep) => {
        // الخانة الفارغة تعني "بدون تغيير" — لا نكتب صفراً فوق المحقق المحفوظ
        const actStr = depActualDrafts[dep] ?? "";
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
        const actStr = kpiActualDrafts[kpi] ?? "";
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
      setEditMode(false);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  /** مبيعات اليوم = القراءة في الخانة (أو المحفوظة) − آخر قراءة قبل ذلك التاريخ */
  const daySalesFor = useCallback(
    (key: string, isDep: boolean): number | null => {
      const book = isDep
        ? departmentDailyActuals[period]?.[key as Dep]
        : branchDailyActuals[period]?.[key as Kpi];
      const draft = isDep ? depActualDrafts[key] : kpiActualDrafts[key];
      const cumNow =
        draft !== undefined && draft.trim() !== ""
          ? parseFloat(draft) || 0
          : book?.[editingDate] !== undefined
            ? Number(book[editingDate]) || 0
            : null;
      if (cumNow === null) return null;
      const prevEntries = Object.entries(book ?? {})
        .filter(([d]) => d < editingDate)
        .sort();
      const prev = prevEntries.length ? Number(prevEntries[prevEntries.length - 1][1]) || 0 : 0;
      return Math.max(0, cumNow - prev);
    },
    [period, editingDate, departmentDailyActuals, branchDailyActuals, depActualDrafts, kpiActualDrafts],
  );

  // خانة Actual: بدون إطار/خلفية — نفس شكل خانة Daily (نص محاذي في المنتصف)
  const fieldCls =
    "h-10 w-16 min-w-0 bg-transparent px-1 text-center font-mono text-2xs font-bold tabular-nums text-foreground outline-none focus:text-primary sm:w-32 sm:px-3 sm:text-xs disabled:opacity-100 disabled:cursor-default [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-2 sm:px-4 fade-in">
      {/* Top Banner & Date Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border bg-card/80 p-5 backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              Daily Control
            </span>
            <span className="text-xs text-subtle">Period: {period}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-foreground">
            Daily Sales Editor
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-11 items-center gap-2.5 rounded-xl border border-primary/50 bg-card px-3.5 shadow-sm">
            <Calendar className="size-[18px] shrink-0 text-primary" aria-hidden />
            <span className="text-xs font-semibold text-muted">Entry Date:</span>
            <input
              type="date"
              value={editingDate}
              min={minDate}
              max={maxDate}
              onChange={(e) => {
                const nextDate = e.target.value;
                if (nextDate >= minDate && nextDate <= maxDate) setEditingDate(nextDate);
              }}
              aria-label="Entry date"
              className="w-[140px] bg-transparent text-sm font-semibold tabular-nums text-foreground outline-none sm:w-[150px]"
            />
          </div>

          {editMode ? (
            <>
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
                    حفظ التعديلات
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={cancelEdit}
                disabled={saveStatus === "saving"}
                className="flex items-center gap-2 px-4 py-2.5"
              >
                <X className="size-4" />
                إلغاء
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={startAddDaily} className="flex items-center gap-2 px-4 py-2.5">
              <Save className="size-4" />
              إضافة يوم
            </Button>
            <Button onClick={startEdit} className="flex items-center gap-2 px-5 py-2.5 shadow-lg">
              <Pencil className="size-4" />
              تعديل اليوم
            </Button>
          )}
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card/80 overflow-hidden shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Monthly KPI Actuals</h2>
            <p className="mt-1 text-xs text-subtle">المحقق الشهري مستقل عن اليومي ولكل شهر بياناته الخاصة.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {monthlyEditMode ? (
              <>
                <Button onClick={handleSaveMonthly} className="flex items-center gap-2"><Save className="size-4" />حفظ المحقق الشهري</Button>
                <Button variant="outline" onClick={() => { initDrafts(); setMonthlyEditMode(false); }}>إلغاء</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => startMonthlyEdit("add")} className="flex items-center gap-2"><Save className="size-4" />إضافة شهري</Button>
                <Button onClick={() => startMonthlyEdit("edit")} className="flex items-center gap-2"><Pencil className="size-4" />تعديل الشهري</Button>
              </>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead><tr className="border-b border-border bg-card-2/40 text-2xs uppercase tracking-wider text-subtle">
              <th className="px-3 py-3 text-center font-semibold">KPI</th>
              <th className="px-3 py-3 text-center font-semibold text-primary">Monthly Actual</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {KPIS.map((kpi) => (
                <tr key={kpi}>
                  <td className="px-3 py-3 text-center font-semibold text-foreground">{kpi}</td>
                  <td className="px-3 py-3 text-center">
                    <input type="number" value={monthlyKpiDrafts[kpi] ?? ""} onChange={(e) => setMonthlyKpiDrafts((prev) => ({ ...prev, [kpi]: e.target.value }))} disabled={!monthlyEditMode} placeholder="0" className={fieldCls} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
            <h2 className="text-sm font-semibold text-foreground">
              Department Daily Performance
            </h2>
            <div className="text-xs text-subtle">
              Date Day:{" "}
              <span className="font-semibold text-foreground">
                {Number(editingDate.slice(-2)) || 1}
              </span>{" "}
              of {daysInMonth} days
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse table-fixed">
              <thead>
                <tr className="border-b border-border bg-card-2/40 text-2xs uppercase tracking-wider text-subtle">
                  <th className="px-1 py-2 text-center font-semibold sm:px-4 sm:py-3">Department</th>
                  <th className="px-0.5 py-2 text-center font-semibold text-primary sm:px-3 sm:py-3">
                    Actual
                  </th>
                  <th className="px-0.5 py-2 text-center font-semibold text-primary sm:px-3 sm:py-3">
                    <span className="inline-flex items-center gap-1">
                      <Calculator className="size-3" />
                      Daily
                    </span>
                  </th>
                  <th className="px-1 py-2 text-center font-semibold sm:px-3 sm:py-3">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {DEPS.map((dep) => {
                  const targetVal = parseFloat(depTargetDrafts[dep] || "0") || 0;
                  const dailyTarget = targetVal > 0 ? targetVal / daysInMonth : 0;
                  const daySales = daySalesFor(dep, true);
                  // % = مبيعات اليوم المختار ÷ التارجيت اليومي للقسم
                  const achievementRatio =
                    daySales !== null && dailyTarget > 0 ? daySales / dailyTarget : 0;

                  return (
                    <tr key={dep} className="hover:bg-card-2/30 transition-colors">
                      <td className="px-1 py-2 text-center font-medium text-foreground sm:px-4 sm:py-3">
                        <div className="font-semibold">{dep}</div>
                      </td>

                      {/* Actual Input */}
                      <td className="px-0.5 py-2 text-center sm:px-3 sm:py-3">
                        <input
                          type="number"
                          value={depActualDrafts[dep] ?? ""}
                          onChange={(e) => {
                            dirtyRef.current = true;
                            setDepActualDrafts((prev) => ({ ...prev, [dep]: e.target.value }));
                          }}
                          placeholder="0"
                          disabled={!editMode}
                          className={fieldCls}
                        />
                      </td>

                      {/* مبيعات اليوم (تلقائي) */}
                      <td className="px-0.5 py-2 text-center font-mono text-2xs font-bold tabular-nums text-primary sm:px-3 sm:py-3 sm:text-xs">
                        {daySales === null ? "—" : formatNumber(daySales)}
                      </td>

                      {/* Achievement Ratio */}
                      <td className="px-1 py-2 text-center font-mono text-2xs font-semibold tabular-nums sm:px-3 sm:py-3 sm:text-xs">
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
            <h2 className="text-sm font-semibold text-foreground">
              Main KPIs Daily Performance
            </h2>
            <div className="text-xs text-subtle">
              Date Day:{" "}
              <span className="font-semibold text-foreground">
                {Number(editingDate.slice(-2)) || 1}
              </span>{" "}
              of {daysInMonth} days
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse table-fixed">
              <thead>
                <tr className="border-b border-border bg-card-2/40 text-2xs uppercase tracking-wider text-subtle">
                  <th className="px-1 py-2 text-center font-semibold sm:px-4 sm:py-3">KPI</th>
                  <th className="px-0.5 py-2 text-center font-semibold text-primary sm:px-3 sm:py-3">
                    Actual
                  </th>
                  <th className="px-0.5 py-2 text-center font-semibold text-primary sm:px-3 sm:py-3">
                    <span className="inline-flex items-center gap-1">
                      <Calculator className="size-3" />
                      Daily
                    </span>
                  </th>
                  <th className="px-1 py-2 text-center font-semibold sm:px-3 sm:py-3">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {KPIS.map((kpi) => {
                  const targetVal = parseFloat(kpiTargetDrafts[kpi] || "0") || 0;
                  // CR معدل تحويل (%): قيمة شهرية — النسبة = المحقق ÷ المستهدف مباشرة
                  const isRateKpi = kpi === "CR";
                  const dailyTarget = targetVal > 0 ? targetVal / daysInMonth : 0;
                  const daySales = isRateKpi ? null : daySalesFor(kpi, false);
                  // % = مبيعات اليوم المختار ÷ التارجيت اليومي للمؤشر (CR: شهري مباشر)
                  const achievementRatio = isRateKpi
                    ? targetVal > 0
                      ? parseFloat(kpiActualDrafts[kpi] || "0") / targetVal
                      : 0
                    : daySales !== null && daySales !== undefined && dailyTarget > 0
                      ? daySales / dailyTarget
                      : 0;

                  return (
                    <tr key={kpi} className="hover:bg-card-2/30 transition-colors">
                      <td className="px-1 py-2 text-center font-medium text-foreground sm:px-4 sm:py-3">
                        <div className="font-semibold">{kpi}</div>
                      </td>

                      {/* Actual Input */}
                      <td className="px-0.5 py-2 text-center sm:px-3 sm:py-3">
                        <input
                          type="number"
                          value={kpiActualDrafts[kpi] ?? ""}
                          onChange={(e) => {
                            dirtyRef.current = true;
                            setKpiActualDrafts((prev) => ({ ...prev, [kpi]: e.target.value }));
                          }}
                          placeholder="0"
                          disabled={!editMode}
                          className={fieldCls}
                        />
                      </td>

                      {/* مبيعات اليوم (تلقائي) */}
                      <td className="px-0.5 py-2 text-center font-mono text-2xs font-bold tabular-nums text-primary sm:px-3 sm:py-3 sm:text-xs">
                        {daySales === null || daySales === undefined ? "—" : formatNumber(daySales)}
                      </td>

                      {/* Achievement Ratio */}
                      <td className="px-1 py-2 text-center font-mono text-2xs font-semibold tabular-nums sm:px-3 sm:py-3 sm:text-xs">
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <AdminAuthDialog open={managerOpen} onClose={() => setManagerOpen(false)} />
    </div>
  );
}

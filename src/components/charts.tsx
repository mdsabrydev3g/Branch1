import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatNumber,
  PERIODS,
  ratio,
  sumPeriod,
  type PerformanceData,
} from "@/lib/domain";

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey?: string | number; name?: string; value?: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-card">
      <div className="mb-1.5 font-medium text-foreground">{label}</div>
      {payload.map((item) => (
        <div
          key={String(item.dataKey)}
          className="flex items-center justify-between gap-8 py-0.5 text-muted"
        >
          <span>{item.name}</span>
          <span className="font-mono tabular-nums text-foreground">
            {formatNumber(item.value ?? 0)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TrendChart({ data }: { data: PerformanceData }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const rows = PERIODS.map((p) => {
    const totals = sumPeriod(data[p.id]);
    return {
      name: p.short,
      Plan: totals.plan,
      Result: totals.result,
      index: ratio(totals),
    };
  });

  if (!ready) {
    return <div className="h-64 animate-pulse rounded-xl bg-card-2" />;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} barGap={4} barCategoryGap="28%">
          <CartesianGrid
            stroke="var(--color-border)"
            strokeDasharray="3 6"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fill: "var(--color-subtle)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--color-subtle)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
            }
            width={40}
          />
          <Tooltip
            cursor={{ fill: "rgba(91, 140, 255, 0.06)" }}
            content={<ChartTooltip />}
          />
          <Bar
            dataKey="Plan"
            fill="var(--color-chart-plan)"
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
          />
          <Bar
            dataKey="Result"
            fill="var(--color-chart-result)"
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function IndexRing({ value }: { value: number }) {
  const fill = Math.min(1, Math.max(0, value));
  const r = 54;
  const c = 2 * Math.PI * r;
  const dash = c * fill;
  return (
    <div className="relative mx-auto grid size-44 place-items-center">
      <svg viewBox="0 0 128 128" className="size-full -rotate-90">
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke="var(--color-card-3)"
          strokeWidth="10"
        />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="10"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="font-mono text-4xl font-medium tabular-nums leading-none tracking-tight text-foreground">
            {Math.round(value * 100)}
            <span className="text-xl text-muted">%</span>
          </div>
          <div className="mt-1 text-xs tracking-wide text-subtle">Index</div>
        </div>
      </div>
    </div>
  );
}

import { formatNumber, formatPct, ratio, sumBlock } from "@/lib/domain";
import { usePerfStore } from "@/lib/store";
import { ProgressBar } from "@/components/progress-bar";
import { StatusPill } from "@/components/status-pill";

export function OverviewView() {
  const data = usePerfStore((s) => s.data);
  const period = usePerfStore((s) => s.period);
  const targets = usePerfStore((s) => s.targets);

  const block = data[period] || {};

  // التجمعي الإجمالي الصحيح كما كان في كودك الأصلي
  const grossCalculated = sumBlock(block);
  const grossTarget = targets[period]?.["Gross"] ?? grossCalculated.plan;
  const grossRatio = ratio({ plan: grossTarget, result: grossCalculated.result });

  // حساب Net من الـ block مباشرة
  const netCalculated = block["Net"] ? sumBlock({ Net: block["Net"] }) : { plan: 0, result: 0 };
  const netTarget = targets[period]?.["Net"] ?? netCalculated.plan;
  const netRatio = ratio({ plan: netTarget, result: netCalculated.result });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-1 sm:px-4">
      {/* Gross Card */}
      <section className="hairline print-surface rounded-2xl bg-card/80 p-5">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-foreground">Gross Sales</h2>
            <p className="text-xs text-subtle">Total gross achievement</p>
          </div>
          <StatusPill ratio={grossRatio} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div>
            <span className="text-2xs uppercase text-subtle">Target</span>
            <p className="font-mono text-base font-semibold text-foreground">
              {formatNumber(grossTarget)}
            </p>
          </div>
          <div>
            <span className="text-2xs uppercase text-subtle">Actual</span>
            <p className="font-mono text-base font-semibold text-foreground">
              {formatNumber(grossCalculated.result)}
            </p>
          </div>
          <div>
            <span className="text-2xs uppercase text-subtle">Remaining</span>
            <p className="font-mono text-base font-semibold text-foreground">
              {formatNumber(Math.max(0, grossTarget - grossCalculated.result))}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-subtle">
            <span>Achievement</span>
            <span>{formatPct(grossRatio)}</span>
          </div>
          <ProgressBar value={grossRatio} />
        </div>
      </section>

      {/* Net Card */}
      <section className="hairline print-surface rounded-2xl bg-card/80 p-5">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-foreground">Net Sales</h2>
            <p className="text-xs text-subtle">Total net achievement</p>
          </div>
          <StatusPill ratio={netRatio} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div>
            <span className="text-2xs uppercase text-subtle">Target</span>
            <p className="font-mono text-base font-semibold text-foreground">
              {formatNumber(netTarget)}
            </p>
          </div>
          <div>
            <span className="text-2xs uppercase text-subtle">Actual</span>
            <p className="font-mono text-base font-semibold text-foreground">
              {formatNumber(netCalculated.result)}
            </p>
          </div>
          <div>
            <span className="text-2xs uppercase text-subtle">Remaining</span>
            <p className="font-mono text-base font-semibold text-foreground">
              {formatNumber(Math.max(0, netTarget - netCalculated.result))}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-subtle">
            <span>Achievement</span>
            <span>{formatPct(netRatio)}</span>
          </div>
          <ProgressBar value={netRatio} />
        </div>
      </section>
    </div>
  );
}

export function Overview(props: any) {
  return <OverviewView {...props} />;
}

export default OverviewView;

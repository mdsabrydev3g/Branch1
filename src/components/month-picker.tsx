import { useState } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  addMonths,
  addYears,
  format,
  getDaysInMonth,
  isSameDay,
  isSameMonth,
} from "date-fns";
import { PERIODS, type PeriodId } from "@/lib/domain";
import { usePerfStore } from "@/lib/store";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const MIN_PERIOD = PERIODS[0].id;
const MAX_PERIOD = PERIODS[PERIODS.length - 1].id;

function periodIdOf(date: Date): PeriodId {
  return format(date, "yyyy-MM");
}

function dateOfPeriod(id: PeriodId): Date {
  const [year, month] = id.split("-").map(Number);
  return new Date(year, (month || 1) - 1, 1);
}

/**
 * اختيار الشهر من تقويم (شبكة أيام مع تنقّل شهري/سنوي) بدل القائمة
 * المنسدلة — النافذة من 2026 حتى سنتين بعد السنة الحالية، والزر يعرض
 * اسم الشهر والسنة كاملين دون قص.
 */
export function MonthPicker() {
  const period = usePerfStore((s) => s.period);
  const setPeriod = usePerfStore((s) => s.setPeriod);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(() => dateOfPeriod(period));

  const selectedDate = dateOfPeriod(period);
  const today = new Date();

  const canGoPrev = periodIdOf(addMonths(viewMonth, -1)) >= MIN_PERIOD;
  const canGoNext = periodIdOf(addMonths(viewMonth, 1)) <= MAX_PERIOD;

  const select = (date: Date) => {
    const id = periodIdOf(date);
    if (id < MIN_PERIOD || id > MAX_PERIOD) return;
    setPeriod(id);
    setOpen(false);
  };

  const daysInMonth = getDaysInMonth(viewMonth);
  const leadingBlanks = viewMonth.getDay(); // 0 = Sunday
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const navBtn =
    "grid size-7 place-items-center rounded-md text-subtle hover:bg-card-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-30";

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setViewMonth(dateOfPeriod(period));
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Select month"
          aria-haspopup="dialog"
          className="pressable flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-primary/50 bg-card px-2.5 text-xs font-semibold text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Calendar className="size-4 shrink-0 text-primary" aria-hidden />
          {format(selectedDate, "MMM yyyy")}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[288px] p-3"
        aria-label="Choose month"
      >
        <div className="mb-2 flex items-center justify-between gap-1">
          <button
            type="button"
            className={navBtn}
            aria-label="Previous year"
            disabled={!canGoPrev}
            onClick={() => setViewMonth((m) => addYears(m, -1))}
          >
            <ChevronsLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            className={navBtn}
            aria-label="Previous month"
            disabled={!canGoPrev}
            onClick={() => setViewMonth((m) => addMonths(m, -1))}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <div className="select-none text-center text-sm font-semibold text-foreground">
            {format(viewMonth, "MMMM yyyy")}
          </div>
          <button
            type="button"
            className={navBtn}
            aria-label="Next month"
            disabled={!canGoNext}
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            className={navBtn}
            aria-label="Next year"
            disabled={!canGoNext}
            onClick={() => setViewMonth((m) => addYears(m, 1))}
          >
            <ChevronsRight className="size-4" aria-hidden />
          </button>
        </div>

        <div className="grid grid-cols-7">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-subtle"
            >
              {d}
            </div>
          ))}
          {Array.from({ length: leadingBlanks }, (_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {days.map((day) => {
            const date = new Date(
              viewMonth.getFullYear(),
              viewMonth.getMonth(),
              day,
            );
            const id = periodIdOf(date);
            const isSelectedMonth = id === period;
            const isToday = isSameDay(date, today);
            const disabled = id < MIN_PERIOD || id > MAX_PERIOD;
            return (
              <button
                key={day}
                type="button"
                disabled={disabled}
                onClick={() => select(date)}
                className={cn(
                  "mx-auto grid size-8 place-items-center rounded-md text-xs font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  isSelectedMonth
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-card-2",
                  isToday && !isSelectedMonth && "ring-1 ring-inset ring-primary/70",
                  disabled && "pointer-events-none text-subtle/50",
                )}
                aria-current={isToday ? "date" : undefined}
                aria-pressed={isSelectedMonth}
              >
                {day}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
          <button
            type="button"
            className="text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            onClick={() => select(new Date())}
          >
            Today
          </button>
          <span className="text-[10px] text-subtle">
            {isSameMonth(viewMonth, selectedDate)
              ? format(selectedDate, "MMMM yyyy")
              : ""}
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default MonthPicker;

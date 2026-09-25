/** Summarise the meaningful change between two dashboard snapshots for a human notification. */
import { LocalNotifications } from "@capacitor/local-notifications";

const PERIOD_NAMES = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
] as const;
const DEPARTMENTS = ["TV", "AC", "MDA", "SDA", "Laptop", "Other", "Mobile", "ACC"] as const;
const KPIS = ["Gross", "Agency", "BOXI", "Mylo", "CR", "GK", "Gift"] as const;

function periodLabel(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) return "";
  const [year, month] = value.split("-").map(Number);
  return `${PERIOD_NAMES[month - 1] ?? value} ${year}`;
}

function changedDepartment(before: unknown, after: unknown): string[] {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") return [];
  const a = before as Record<string, unknown>;
  const b = after as Record<string, unknown>;
  return DEPARTMENTS.filter((dep) => JSON.stringify(a[dep]) !== JSON.stringify(b[dep]));
}

function changedKpi(before: unknown, after: unknown): string[] {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") return [];
  const a = before as Record<string, unknown>;
  const b = after as Record<string, unknown>;
  return KPIS.filter((kpi) => JSON.stringify(a[kpi]) !== JSON.stringify(b[kpi]));
}

export function describeDashboardChange(previous: unknown, next: unknown): string {
  if (!previous || !next || typeof previous !== "object" || typeof next !== "object") {
    return "تم تطبيق تعديل جديد على لوحة الأداء.";
  }
  const before = previous as Record<string, unknown>;
  const after = next as Record<string, unknown>;
  const period = periodLabel(after.period ?? before.period);
  const suffix = period ? ` — ${period}` : "";
  const changes: string[] = [];
  const changed = (key: string) => JSON.stringify(before[key]) !== JSON.stringify(after[key]);

  if (changed("branchKpis") || changed("branchKpisByPeriod")) {
    changes.push("تم تحديث Chatbot ومؤشرات الفرع");
  }
  if (changed("departmentDailyActuals") || changed("branchDailyActuals")) {
    const departments = changedDepartment(before.departmentDailyActuals, after.departmentDailyActuals);
    const kpis = changedKpi(before.branchDailyActuals, after.branchDailyActuals);
    const scope = departments.length ? departments.join("، ") : kpis.length ? kpis.join("، ") : "المحصلات";
    changes.push(`تم تحديث محصلات ${scope}`);
  }
  if (changed("departmentTargets") || changed("branchKpiTargets")) {
    const departments = changedDepartment(before.departmentTargets, after.departmentTargets);
    changes.push(`تم تغيير التارجيت${departments.length ? ` — ${departments.join("، ")}` : ""}`);
  }
  if (changed("data")) {
    const oldData = (before.data ?? {}) as Record<string, unknown>;
    const newData = (after.data ?? {}) as Record<string, unknown>;
    const departments = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]))
      .filter((key) => JSON.stringify(oldData[key]) !== JSON.stringify(newData[key]));
    changes.push(`تم تعديل قسم${departments.length ? ` — ${departments.join("، ")}` : " بيانات"}`);
  }
  if (!changes.length) changes.push("تم تحديث بيانات لوحة الأداء");
  return `${changes.join("\n")}${suffix}`;
}

/** Request Android 13+ notification permission; safe no-op elsewhere. */
export async function requestDesktopNotificationPermission(): Promise<void> {
  try {
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display === "prompt") {
      await LocalNotifications.requestPermissions();
    }
  } catch {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch { /* optional */ }
    }
  }
}

let notificationSequence = 0;

/** Show a native Android notification, with a browser fallback for web/desktop. */
export async function showSystemUpdateNotification(title: string, body: string): Promise<void> {
  notificationSequence = (notificationSequence + 1) % 1_000_000;
  try {
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display === "granted") {
      await LocalNotifications.createChannel({
        id: "branch1-updates",
        name: "Branch1 Updates",
        description: "Detailed updates from Branch1",
        importance: 4,
        visibility: 1,
      });
      await LocalNotifications.schedule({
        notifications: [{
          id: notificationSequence,
          title,
          body,
          channelId: "branch1-updates",
          smallIcon: "ic_stat_branch1",
          extra: { source: "branch1-dashboard-update" },
        }],
      });
      return;
    }
  } catch {
    /* fall through to the desktop/browser implementation */
  }
  if (typeof window === "undefined" || !("Notification" in window)) return;
  try {
    if (Notification.permission === "granted") {
      new Notification(title, { body, tag: `branch1-dashboard-update-${notificationSequence}`, icon: "/favicon.svg" });
    }
  } catch {
    // Some embedded WebViews expose Notification but reject construction.
  }
}

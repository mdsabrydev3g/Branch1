import { create } from "zustand";
import { useEffect } from "react";

/**
 * تفضيلات الواجهة فقط (السمة + اللغة) — ليست بيانات أعمال.
 * بيانات الأعمال مصدرها قاعدة البيانات (store.ts)، أما هذه فمكانها
 * الطبيعي هو جهاز المستخدم لأنها خاصة بكل جهاز/متصفح.
 */

export type Theme = "dark" | "light";
export type Lang = "en" | "ar";

const THEME_KEY = "f1-theme";
const LANG_KEY = "f1-lang";

/* ============================================================
   الترجمة — لا ترجمة تلقائية.
   القاموس العربي يُملأ حصرياً بالمصطلحات التي يعتمدها المالك.
   المفتاح نفسه بالإنجليزية يظل النص الافتراضي (fallback) حتى
   الاعتماد، فلايتغير أي نص ظاهر قبل الموافقة.
   ============================================================ */
export const dictionaries: Record<Lang, Record<string, string>> = {
  en: {
    "nav.overview": "Overview",
    "nav.tv-ac": "TV — AC",
    "nav.mda-sda": "MDA - SDA",
    "nav.mobile": "Mobile",
    "nav.daily": "Daily Editor",
    "nav.reports": "Reports",
  },
  ar: {
    // فارغ عمداً — يُملأ بعد موافقتك على جدول المصطلحات، صفحة بصفحة.
  },
};

/** true فقط بعد اعتماد أول دفعة مصطلحات عربية — يتحول مبدل اللغة بعدها. */
export const ARABIC_READY = Object.keys(dictionaries.ar).length > 0;

export function translate(lang: Lang, key: string): string {
  return dictionaries[lang]?.[key] ?? dictionaries.en[key] ?? key;
}

interface PrefsState {
  theme: Theme;
  lang: Lang;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setLang: (l: Lang) => void;
}

function readStored<T extends string>(key: string, allowed: T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    if (v && allowed.includes(v as T)) return v as T;
  } catch {
    /* localStorage may be unavailable (private mode) */
  }
  return fallback;
}

export const usePrefs = create<PrefsState>((set, get) => ({
  theme: "dark",
  lang: "en",
  setTheme: (theme) => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
    document.documentElement.dataset.theme = theme;
    set({ theme });
  },
  toggleTheme: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
  setLang: (lang) => {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* ignore */
    }
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === "ar" ? "rtl" : "ltr";
    set({ lang });
  },
}));

/** يقرأ التفضيلات المحفوظة ويطبقها على <html> — يُستدعى مرة عند الإقلاع. */
export function applyStoredPrefs() {
  if (typeof document === "undefined") return;
  const theme = readStored<Theme>(THEME_KEY, ["dark", "light"], "dark");
  const lang = ARABIC_READY ? readStored<Lang>(LANG_KEY, ["en", "ar"], "en") : "en";
  document.documentElement.dataset.theme = theme;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  usePrefs.setState({ theme, lang });
}

/** hook يزامن السمة/اللغة مع <html> طول عمر التطبيق. */
export function usePrefsEffect() {
  const theme = usePrefs((s) => s.theme);
  const lang = usePrefs((s) => s.lang);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [theme, lang]);
}

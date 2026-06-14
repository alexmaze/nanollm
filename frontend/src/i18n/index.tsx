import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import zh from "./locales/zh";
import en from "./locales/en";

type Locale = "zh" | "en";
type Dict = typeof zh;

const locales: Record<Locale, Dict> = { zh, en };

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return path;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : path;
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem("nanollm-locale");
    if (stored === "zh" || stored === "en") return stored;
  } catch {}
  return "zh";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem("nanollm-locale", l); } catch {}
    document.documentElement.lang = l === "zh" ? "zh-CN" : "en";
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const dict = locales[locale] as Record<string, unknown>;
      let value = getNestedValue(dict, key);
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          value = value.replace(`{${k}}`, String(v));
        }
      }
      return value;
    },
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used within I18nProvider");
  return ctx;
}

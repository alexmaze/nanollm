import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { Theme } from "@radix-ui/themes";

type Appearance = "light" | "dark";

interface ThemeContextValue {
  appearance: Appearance;
  toggleAppearance: () => void;
  setAppearance: (a: Appearance) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialAppearance(): Appearance {
  try {
    const stored = localStorage.getItem("nanollm-theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<Appearance>(getInitialAppearance);

  const setAppearance = useCallback((a: Appearance) => {
    setAppearanceState(a);
    try { localStorage.setItem("nanollm-theme", a); } catch {}
  }, []);

  const toggleAppearance = useCallback(() => {
    setAppearance(appearance === "light" ? "dark" : "light");
  }, [appearance, setAppearance]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      try {
        if (!localStorage.getItem("nanollm-theme")) {
          setAppearance(e.matches ? "dark" : "light");
        }
      } catch {}
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [setAppearance]);

  return (
    <ThemeContext.Provider value={{ appearance, toggleAppearance, setAppearance }}>
      <Theme
        accentColor="indigo"
        grayColor="slate"
        radius="large"
        scaling="100%"
        panelBackground="translucent"
        appearance={appearance}
      >
        {children}
      </Theme>
    </ThemeContext.Provider>
  );
}

export function useAppearance() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useAppearance must be used within ThemeProvider");
  return ctx;
}

import { createContext, useContext, type ReactNode } from "react";
import { useConfig, type HydratedForm } from "./useConfig";
import type { ConfigSnapshot } from "../api";

interface ConfigContextValue {
  snapshot: ConfigSnapshot | null;
  form: HydratedForm | null;
  dirty: boolean;
  saving: boolean;
  status: { kind: "" | "success" | "warn" | "error"; text: string; params?: Record<string, string | number> };
  updateForm: (fn: (prev: HydratedForm) => HydratedForm) => void;
  saveConfig: () => Promise<void>;
  refreshConfig: () => Promise<void>;
  resetConfig: () => void;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const config = useConfig();
  return (
    <ConfigContext.Provider value={config}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfigContext() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useConfigContext must be used within ConfigProvider");
  return ctx;
}

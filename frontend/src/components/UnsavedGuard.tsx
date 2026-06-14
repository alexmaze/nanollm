import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ConfirmDialog from "./ConfirmDialog";
import { useConfigContext } from "../hooks/ConfigContext";
import { useT } from "../i18n";

interface GuardContextValue {
  /**
   * Navigate to `to`, or — if there are unsaved edits — first prompt the user
   * via a confirm dialog and only navigate on confirmation.
   */
  guardedNavigate: (to: string) => void;
}

const GuardContext = createContext<GuardContextValue | null>(null);

export function useGuardedNavigate() {
  const ctx = useContext(GuardContext);
  if (!ctx) throw new Error("useGuardedNavigate must be used within UnsavedGuard");
  return ctx.guardedNavigate;
}

/**
 * Provides a `guardedNavigate` that intercepts in-app navigation while there
 * are unsaved edits, surfacing a confirm dialog. Reachable navigation points
 * (Sidebar nav) should call `guardedNavigate` instead of `navigate` directly.
 *
 * Tab close / reload is handled separately by the `beforeunload` listener in
 * useConfig.
 */
export default function UnsavedGuard({ children }: { children: ReactNode }) {
  const { dirty } = useConfigContext();
  const { t } = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [pending, setPending] = useState<string | null>(null);

  const guardedNavigate = useCallback(
    (to: string) => {
      // Same-page click: no-op (avoid prompting on a refresh of current view).
      if (to === location.pathname) return;
      if (dirty) {
        setPending(to);
      } else {
        navigate(to);
      }
    },
    [dirty, location.pathname, navigate],
  );

  const proceed = useCallback(() => {
    const to = pending;
    setPending(null);
    if (to) navigate(to);
  }, [pending, navigate]);

  return (
    <GuardContext.Provider value={{ guardedNavigate }}>
      {children}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => { if (!o) setPending(null); }}
        title={t("unsaved.leaveTitle")}
        description={t("unsaved.leaveDescription")}
        confirmLabel={t("unsaved.leave")}
        cancelLabel={t("common.no")}
        destructive
        onConfirm={proceed}
      />
    </GuardContext.Provider>
  );
}

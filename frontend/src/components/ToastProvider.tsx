import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import { Box, Flex, Text, IconButton } from "@radix-ui/themes";
import { Cross2Icon, CheckCircledIcon, ExclamationTriangleIcon, InfoCircledIcon } from "@radix-ui/react-icons";
import { useT } from "../i18n";

export type ToastKind = "success" | "error" | "warn" | "info";

interface Toast {
  id: string;
  kind: ToastKind;
  title?: string;
  message: string;
  /** Whether the toast is currently animating out before removal. */
  leaving?: boolean;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircledIcon />,
  error: <ExclamationTriangleIcon />,
  warn: <ExclamationTriangleIcon />,
  info: <InfoCircledIcon />,
};

const COLORS: Record<ToastKind, { border: string; bg: string; icon: string }> = {
  success: { border: "var(--green-7)", bg: "var(--green-2)", icon: "var(--green-9)" },
  error: { border: "var(--red-7)", bg: "var(--red-2)", icon: "var(--red-9)" },
  warn: { border: "var(--amber-7)", bg: "var(--amber-2)", icon: "var(--amber-9)" },
  info: { border: "var(--indigo-7)", bg: "var(--indigo-2)", icon: "var(--indigo-9)" },
};

let idCounter = 0;
function nextId() {
  idCounter++;
  return `toast-${idCounter}`;
}

const EXIT_MS = 180;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Fully removes a toast from state (after its exit animation has played).
  const purge = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  // Marks a toast as leaving (plays exit animation), then purges it.
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => purge(id), EXIT_MS);
  }, [purge]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = nextId();
    setToasts((prev) => [...prev, { ...toast, id }]);
    const timer = setTimeout(() => removeToast(id), 4000);
    timersRef.current.set(id, timer);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <Box
      role="status"
      aria-live="polite"
      aria-atomic="false"
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 360,
        width: "calc(100vw - 32px)",
        pointerEvents: "none",
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </Box>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const { t } = useT();
  const colors = COLORS[toast.kind];
  return (
    <Flex
      align="start"
      gap="2"
      p="3"
      className={toast.leaving ? "toast-exit" : "toast-enter"}
      style={{
        pointerEvents: "auto",
        borderRadius: "var(--radius-3)",
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.bg,
        boxShadow: "var(--app-card-shadow-hover)",
      }}
    >
      <Box style={{ color: colors.icon, flexShrink: 0, marginTop: 1 }}>{ICONS[toast.kind]}</Box>
      <Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0 }}>
        {toast.title && (
          <Text size="2" weight="bold" style={{ color: "var(--gray-12)" }}>
            {toast.title}
          </Text>
        )}
        <Text size="2" style={{ color: "var(--gray-11)", wordBreak: "break-word" }}>
          {toast.message}
        </Text>
      </Flex>
      <IconButton
        size="1"
        variant="ghost"
        color="gray"
        aria-label={t("common.close")}
        onClick={() => onRemove(toast.id)}
        style={{ flexShrink: 0 }}
      >
        <Cross2Icon />
      </IconButton>
    </Flex>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

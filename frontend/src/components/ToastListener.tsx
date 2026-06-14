import { useEffect, useRef } from "react";
import { useConfigContext } from "../hooks/ConfigContext";
import { useToast } from "./ToastProvider";
import { useT } from "../i18n";

export default function ToastListener() {
  const { status } = useConfigContext();
  const { addToast } = useToast();
  const { t } = useT();
  const lastStatusRef = useRef<string>("");

  useEffect(() => {
    if (!status.text) {
      lastStatusRef.current = "";
      return;
    }

    // Skip transient "saving" toasts; the save button already shows loading state.
    if (status.text === "common.saving") {
      lastStatusRef.current = "";
      return;
    }

    const serialized = `${status.kind}:${status.text}:${JSON.stringify(status.params)}`;
    if (serialized === lastStatusRef.current) return;
    lastStatusRef.current = serialized;

    const message = t(status.text, status.params);
    const title = status.kind === "error" ? t("common.error") : status.kind === "success" ? t("common.success") : undefined;

    addToast({
      kind: status.kind === "" ? "info" : status.kind,
      title,
      message,
    });
  }, [status, addToast, t]);

  return null;
}

import { Button } from "@radix-ui/themes";
import { ResetIcon } from "@radix-ui/react-icons";
import { useT } from "../i18n";
import { useConfigContext } from "../hooks/ConfigContext";
import ConfirmDialog from "./ConfirmDialog";

/**
 * Reset button that confirms before discarding when there are unsaved edits.
 * When not dirty it resets immediately (no friction).
 */
export default function GuardedResetButton() {
  const { t } = useT();
  const { dirty, resetConfig } = useConfigContext();

  if (!dirty) {
    return (
      <Button variant="ghost" onClick={resetConfig}>
        <ResetIcon />
        {t("common.reset")}
      </Button>
    );
  }

  return (
    <ConfirmDialog
      title={t("common.resetConfirmTitle")}
      description={t("common.resetConfirmDescription")}
      confirmLabel={t("common.reset")}
      cancelLabel={t("common.no")}
      destructive
      onConfirm={resetConfig}
      trigger={
        <Button variant="ghost">
          <ResetIcon />
          {t("common.reset")}
        </Button>
      }
    />
  );
}

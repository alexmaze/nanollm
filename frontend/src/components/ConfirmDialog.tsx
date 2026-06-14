import { useState, useCallback, type ReactNode } from "react";
import { AlertDialog, Button, Flex } from "@radix-ui/themes";

interface ConfirmDialogProps {
  /** Controls visibility when used as a controlled dialog. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Confirm button label. */
  confirmLabel: string;
  /** Cancel button label (defaults to a generic label). */
  cancelLabel?: string;
  /** When true, renders the confirm button in a destructive (red) tone. */
  destructive?: boolean;
  /** Trigger element — render the dialog inline with a trigger button. */
  trigger?: ReactNode;
  onConfirm: () => void | Promise<void>;
}

/**
 * Reusable confirmation dialog for destructive / irreversible actions.
 *
 * Can be used two ways:
 *  1. Controlled: pass `open` + `onOpenChange` and omit `trigger`.
 *  2. Inline: pass a `trigger` element and omit `open` (manages its own state).
 */
export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  trigger,
  onConfirm,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = useCallback(async () => {
    try {
      setBusy(true);
      await onConfirm();
      onOpenChange?.(false);
    } finally {
      setBusy(false);
    }
  }, [onConfirm, onOpenChange]);

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialog.Trigger>{trigger}</AlertDialog.Trigger>}
      <AlertDialog.Content style={{ maxWidth: 440 }}>
        <AlertDialog.Title size="4" weight="bold">
          {title}
        </AlertDialog.Title>
        {description && (
          <AlertDialog.Description size="2" color="gray" mt="2">
            {description}
          </AlertDialog.Description>
        )}

        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel>
            <Button variant="soft" color="gray" disabled={busy}>
              {cancelLabel}
            </Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action>
            <Button
              color={destructive ? "red" : "indigo"}
              onClick={handleConfirm}
              disabled={busy}
            >
              {confirmLabel}
            </Button>
          </AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}

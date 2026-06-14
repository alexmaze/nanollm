import { Card, Flex, Text, Button } from "@radix-ui/themes";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import type { ReactNode } from "react";
import { useT } from "../i18n";

interface ErrorStateProps {
  /** Optional override message; falls back to a generic label. */
  message?: ReactNode;
  /** Retry callback — when provided, renders a Retry button. */
  onRetry?: () => void;
}

/**
 * Inline error state for failed data fetches. Pairs with PageSkeleton:
 * show the skeleton while loading, this while errored, content on success.
 */
export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { t } = useT();
  return (
    <Card>
      <Flex direction="column" align="center" gap="3" py="6" px="4">
        <Flex
          align="center"
          justify="center"
          width="48px"
          height="48px"
          style={{
            borderRadius: "var(--radius-3)",
            backgroundColor: "var(--red-3)",
            color: "var(--red-9)",
          }}
        >
          <ExclamationTriangleIcon width="22" height="22" />
        </Flex>
        <Text size="3" weight="medium" color="gray" align="center">
          {message || t("common.loadFailed")}
        </Text>
        {onRetry && (
          <Button variant="soft" onClick={onRetry}>
            {t("common.retry")}
          </Button>
        )}
      </Flex>
    </Card>
  );
}

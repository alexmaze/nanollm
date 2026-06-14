import { Card, Flex, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export default function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <Card size="3" style={{ backgroundColor: "var(--gray-2)" }}>
      <Flex direction="column" align="center" gap="3" py="6" px="4">
        {icon && (
          <Flex
            align="center"
            justify="center"
            width="48px"
            height="48px"
            style={{
              borderRadius: "var(--radius-3)",
              backgroundColor: "var(--gray-3)",
              color: "var(--gray-10)",
            }}
          >
            {icon}
          </Flex>
        )}
        <Flex direction="column" align="center" gap="1">
          <Text size="3" weight="medium" color="gray">
            {title}
          </Text>
          {description && (
            <Text size="2" color="gray" align="center" style={{ maxWidth: 400 }}>
              {description}
            </Text>
          )}
        </Flex>
        {action}
      </Flex>
    </Card>
  );
}

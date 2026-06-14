import { Card, Flex, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  color?: "indigo" | "green" | "blue" | "amber" | "red" | "gray";
}

export default function StatCard({ label, value, icon, color = "indigo" }: StatCardProps) {
  return (
    <Card size="2" className="app-hover-card">
      <Flex align="center" gap="3">
        {icon && (
          <Flex
            align="center"
            justify="center"
            width="40px"
            height="40px"
            style={{
              borderRadius: "var(--radius-3)",
              backgroundColor: `var(--${color}-3)`,
              color: `var(--${color}-9)`,
              flexShrink: 0,
            }}
          >
            {icon}
          </Flex>
        )}
        <Flex direction="column" gap="1">
          <Text size="1" color="gray">
            {label}
          </Text>
          <Text size="5" weight="bold" style={{ lineHeight: 1.2 }}>
            {value}
          </Text>
        </Flex>
      </Flex>
    </Card>
  );
}

import { Flex, Box, Heading, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export default function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <Flex justify="between" align="start" gap="4" wrap="wrap" mb="5">
      <Box>
        <Heading size="6" weight="bold" style={{ letterSpacing: "-0.02em" }}>
          {title}
        </Heading>
        {description && (
          <Text size="2" color="gray" mt="1" as="p">
            {description}
          </Text>
        )}
      </Box>
      {children && (
        <Flex align="center" gap="3" wrap="wrap">
          {children}
        </Flex>
      )}
    </Flex>
  );
}

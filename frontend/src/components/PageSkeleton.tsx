import { Skeleton, Flex, Box } from "@radix-ui/themes";

/**
 * Page-level loading skeleton: a header block followed by N card rows.
 * Replaces the previous `return null` / plain "Loading" text flashes.
 */
export default function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <Flex direction="column" gap="5">
      {/* header */}
      <Flex justify="between" align="center">
        <Box>
          <Skeleton>
            <Box style={{ width: 220, height: 32, borderRadius: "var(--radius-3)" }} />
          </Skeleton>
          <Skeleton>
            <Box mt="2" style={{ width: 340, height: 18, borderRadius: "var(--radius-2)" }} />
          </Skeleton>
        </Box>
        <Flex gap="3">
          <Skeleton>
            <Box style={{ width: 90, height: 36, borderRadius: "var(--radius-3)" }} />
          </Skeleton>
          <Skeleton>
            <Box style={{ width: 90, height: 36, borderRadius: "var(--radius-3)" }} />
          </Skeleton>
        </Flex>
      </Flex>

      {/* card rows */}
      {Array.from({ length: cards }).map((_, i) => (
        <Skeleton key={i}>
          <Box style={{ height: 72, borderRadius: "var(--radius-4)" }} />
        </Skeleton>
      ))}
    </Flex>
  );
}

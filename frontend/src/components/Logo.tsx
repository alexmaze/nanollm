import { Flex, Text } from "@radix-ui/themes";

interface LogoProps {
  size?: "small" | "medium";
}

export default function Logo({ size = "medium" }: LogoProps) {
  const iconSize = size === "small" ? 20 : 24;
  const fontSize = size === "small" ? "3" : "4";

  return (
    <Flex align="center" gap="2">
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <rect width="24" height="24" rx="6" fill="var(--accent-9)" />
        <path
          d="M7 17V7L12 14L17 7V17"
          stroke="var(--accent-contrast)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="7" cy="7" r="1.5" fill="var(--accent-contrast)" />
        <circle cx="17" cy="7" r="1.5" fill="var(--accent-contrast)" />
      </svg>
      <Text size={fontSize} weight="bold" style={{ letterSpacing: "-0.01em" }}>
        NanoLLM
      </Text>
    </Flex>
  );
}

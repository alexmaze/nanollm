import { Text } from "@radix-ui/themes";
import type { ReactNode } from "react";

interface NavItemProps {
  active?: boolean;
  icon?: ReactNode;
  label: string;
  onClick: () => void;
}

/**
 * Navigation item rendered as a real anchor (<a>) for keyboard accessibility
 * (Tab focusable, Enter activates). Hover/active styling is driven by the
 * `.nav-item` CSS classes in index.css instead of inline JS handlers.
 *
 * Uses an anchor (href="#") rather than a button so it reads as a navigation
 * link to assistive tech; onClick performs the SPA navigation via the guarded
 * navigate helper.
 */
export default function NavItem({ active, icon, label, onClick }: NavItemProps) {
  return (
    <a
      href="#"
      className="nav-item"
      data-active={active ? "true" : undefined}
      aria-current={active ? "page" : undefined}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 18,
          height: 18,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <Text size="2" weight={active ? "medium" : "regular"}>
        {label}
      </Text>
    </a>
  );
}

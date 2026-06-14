import { useLocation, useNavigate } from "react-router-dom";
import { Flex, Box, Button, Separator, Text, Heading, Callout } from "@radix-ui/themes";
import { LayersIcon, StackIcon, Link2Icon, GearIcon, ClockIcon, MoonIcon, SunIcon, GlobeIcon } from "@radix-ui/react-icons";
import { useT } from "../i18n";
import { useAppearance } from "../theme/ThemeProvider";

interface NavItem {
  view: string;
  label: string;
  icon: React.ReactNode;
}

interface SidebarProps {
  saving: boolean;
  statusKind: "" | "success" | "warn" | "error";
  statusText: string;
  statusParams?: Record<string, string | number>;
  snapshotMeta: string;
  onSave: () => void;
  onRefresh: () => void;
  onReset: () => void;
}

const NAV_ITEMS: NavItem[] = [
  { view: "models", label: "nav.models", icon: <LayersIcon /> },
  { view: "fallback", label: "nav.fallback", icon: <StackIcon /> },
];

export default function Sidebar({ saving, statusKind, statusText, statusParams, snapshotMeta, onSave, onRefresh, onReset }: SidebarProps) {
  const { t, locale, setLocale } = useT();
  const { appearance, toggleAppearance } = useAppearance();
  const location = useLocation();
  const navigate = useNavigate();

  const currentView = location.pathname.replace(/^\//, "") || "models";

  return (
    <Box
      width="248px"
      style={{
        borderRight: "1px solid var(--gray-5)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
      }}
      p="3"
    >
      <Box px="2" pb="3">
        <Heading size="5" style={{ letterSpacing: "-0.02em" }}>nanollm</Heading>
      </Box>

      <Flex direction="column" gap="1" px="1" flexGrow="1">
        {NAV_ITEMS.map((item) => {
          const active = currentView === item.view;
          return (
            <Button
              key={item.view}
              variant="ghost"
              color={active ? "blue" : undefined}
              onClick={() => navigate(`/${item.view}`)}
              style={{
                justifyContent: "flex-start",
                gap: 10,
                ...(active ? { backgroundColor: "var(--accent-9)", color: "var(--accent-contrast)" } : {}),
              }}
              size="2"
            >
              {item.icon}
              {t(item.label)}
            </Button>
          );
        })}

        <Separator my="2" />

        <Button
          variant="ghost"
          color={currentView === "endpoints" ? "blue" : undefined}
          onClick={() => navigate("/endpoints")}
          style={{
            justifyContent: "flex-start",
            gap: 10,
            ...(currentView === "endpoints" ? { backgroundColor: "var(--accent-9)", color: "var(--accent-contrast)" } : {}),
          }}
          size="2"
        >
          <Link2Icon />
          {t("nav.endpoints")}
        </Button>
        <Button
          variant="ghost"
          color={currentView === "settings" ? "blue" : undefined}
          onClick={() => navigate("/settings")}
          style={{
            justifyContent: "flex-start",
            gap: 10,
            ...(currentView === "settings" ? { backgroundColor: "var(--accent-9)", color: "var(--accent-contrast)" } : {}),
          }}
          size="2"
        >
          <GearIcon />
          {t("nav.settings")}
        </Button>

        <Separator my="2" />

        <Button
          variant="ghost"
          color={currentView === "records" ? "blue" : undefined}
          onClick={() => navigate("/records")}
          style={{
            justifyContent: "flex-start",
            gap: 10,
            ...(currentView === "records" ? { backgroundColor: "var(--accent-9)", color: "var(--accent-contrast)" } : {}),
          }}
          size="2"
        >
          <ClockIcon />
          {t("nav.records")}
        </Button>
      </Flex>

      <Flex direction="column" gap="2" pt="3" style={{ borderTop: "1px solid var(--gray-5)" }}>
        <Button onClick={onSave} disabled={saving}>{t("common.save")}</Button>
        <Button variant="outline" onClick={onRefresh}>{t("common.refresh")}</Button>
        <Button variant="ghost" onClick={onReset}>{t("common.reset")}</Button>

        {statusText && (
          <Callout.Root color={statusKind === "error" ? "red" : statusKind === "warn" ? "amber" : statusKind === "success" ? "green" : undefined}>
            <Callout.Text size="1">{t(statusText, statusParams)}</Callout.Text>
          </Callout.Root>
        )}

        <Text size="1" color="gray" style={{ wordBreak: "break-all", lineHeight: 1.5 }}>
          {snapshotMeta}
        </Text>

        <Button variant="ghost" size="1" onClick={toggleAppearance} style={{ justifyContent: "flex-start", gap: 8 }}>
          {appearance === "light" ? <MoonIcon /> : <SunIcon />}
          {appearance === "light" ? t("appearance.dark") : t("appearance.light")}
        </Button>

        <Button
          variant="ghost"
          size="1"
          onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
          style={{ justifyContent: "flex-start", gap: 8 }}
        >
          <GlobeIcon />
          {locale === "zh" ? t("language.en") : t("language.zh")}
        </Button>
      </Flex>
    </Box>
  );
}

import { useLocation } from "react-router-dom";
import { Flex, Box, Button, Text, IconButton, Tooltip, Badge } from "@radix-ui/themes";
import { LayersIcon, StackIcon, Link2Icon, GearIcon, ClockIcon, MoonIcon, SunIcon, GlobeIcon, ActivityLogIcon } from "@radix-ui/react-icons";
import { useT } from "../i18n";
import { useAppearance } from "../theme/ThemeProvider";
import Logo from "./Logo";
import NavItem from "./NavItem";
import { useGuardedNavigate } from "./UnsavedGuard";

interface NavGroup {
  title: string;
  items: NavItemDef[];
}

interface NavItemDef {
  view: string;
  label: string;
  icon: React.ReactNode;
}

interface SidebarProps {
  saving: boolean;
  dirty: boolean;
  snapshotMeta: string;
  onSave: () => void;
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "nav.groupConfig",
    items: [
      { view: "models", label: "nav.models", icon: <LayersIcon /> },
      { view: "fallback", label: "nav.fallback", icon: <StackIcon /> },
    ],
  },
  {
    title: "nav.groupSystem",
    items: [
      { view: "endpoints", label: "nav.endpoints", icon: <Link2Icon /> },
      { view: "settings", label: "nav.settings", icon: <GearIcon /> },
      { view: "records", label: "nav.records", icon: <ClockIcon /> },
      { view: "status", label: "nav.status", icon: <ActivityLogIcon /> },
    ],
  },
];

export default function Sidebar({ saving, dirty, snapshotMeta, onSave }: SidebarProps) {
  const { t, locale, setLocale } = useT();
  const { appearance, toggleAppearance } = useAppearance();
  const location = useLocation();
  const navigate = useGuardedNavigate();

  const currentView = location.pathname.replace(/^\//, "") || "models";

  const saveButtonColor = saving ? "gray" : "indigo";

  return (
    <Box
      width="var(--app-sidebar-width)"
      style={{
        borderRight: "1px solid var(--gray-5)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
        backgroundColor: "var(--color-panel)",
      }}
      p="4"
    >
      {/* Header: Logo + tools */}
      <Flex justify="between" align="center" mb="4">
        <Logo />
        <Flex align="center" gap="3">
          <Tooltip content={appearance === "light" ? t("appearance.dark") : t("appearance.light")}>
            <IconButton
              variant="ghost"
              size="1"
              color="gray"
              onClick={toggleAppearance}
              aria-label={appearance === "light" ? t("appearance.dark") : t("appearance.light")}
            >
              {appearance === "light" ? <MoonIcon /> : <SunIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip content={locale === "zh" ? t("language.en") : t("language.zh")}>
            <IconButton
              variant="ghost"
              size="1"
              color="gray"
              onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
              aria-label={locale === "zh" ? t("language.en") : t("language.zh")}
            >
              <GlobeIcon />
            </IconButton>
          </Tooltip>
        </Flex>
      </Flex>

      {/* Navigation */}
      <Flex direction="column" gap="1" flexGrow="1">
        {NAV_GROUPS.map((group) => (
          <Box key={group.title} mb="2">
            <Text className="app-section-title">{t(group.title)}</Text>
            <Flex direction="column" gap="1">
              {group.items.map((item) => (
                <NavItem
                  key={item.view}
                  active={currentView === item.view}
                  icon={item.icon}
                  label={t(item.label)}
                  onClick={() => navigate(`/${item.view}`)}
                />
              ))}
            </Flex>
          </Box>
        ))}
      </Flex>

      {/* Footer actions */}
      <Flex direction="column" gap="3" pt="3" style={{ borderTop: "1px solid var(--gray-5)" }}>
        <Button onClick={onSave} disabled={saving} size="3" color={saveButtonColor}>
          {saving ? (
            t("common.saving")
          ) : (
            <Flex align="center" gap="2">
              {dirty && <span className="dirty-dot" />}
              {t("common.save")}
            </Flex>
          )}
        </Button>

        {dirty && (
          <Badge color="amber" variant="soft" radius="full">
            {t("unsaved.unsavedChanges")}
          </Badge>
        )}

        <Tooltip content={snapshotMeta}>
          <Text size="1" color="gray" className="app-truncate" style={{ lineHeight: 1.5 }}>
            {snapshotMeta}
          </Text>
        </Tooltip>
      </Flex>
    </Box>
  );
}

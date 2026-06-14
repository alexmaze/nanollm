import { Outlet } from "react-router-dom";
import { Flex, Box, Container } from "@radix-ui/themes";
import Sidebar from "./Sidebar";
import { useConfig } from "../hooks/useConfig";
import { useT } from "../i18n";

export default function Layout() {
  const { saving, status, saveConfig, refreshConfig, resetConfig, snapshot } = useConfig();
  const { t } = useT();

  const snapshotMeta = snapshot
    ? `${t("common.version")} ${snapshot.version} · ${snapshot.configPath} · ${t("common.port")} ${snapshot.effectiveConfig.port}`
    : "";

  return (
    <Flex height="100vh">
      <Sidebar
        saving={saving}
        statusKind={status.kind}
        statusText={status.text}
        statusParams={status.params}
        snapshotMeta={snapshotMeta}
        onSave={saveConfig}
        onRefresh={refreshConfig}
        onReset={resetConfig}
      />
      <Box flexGrow="1" overflowY="auto" p="4">
        <Container maxWidth="1240px" px="2">
          <Outlet />
        </Container>
      </Box>
    </Flex>
  );
}

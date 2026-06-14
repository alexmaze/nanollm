import { Outlet } from "react-router-dom";
import { Flex, Box } from "@radix-ui/themes";
import Sidebar from "./Sidebar";
import { useConfigContext } from "../hooks/ConfigContext";
import { useT } from "../i18n";

export default function Layout() {
  const { saving, dirty, saveConfig, snapshot } = useConfigContext();
  const { t } = useT();

  const snapshotMeta = snapshot
    ? `${t("common.version")} ${snapshot.version} · ${snapshot.configPath} · ${t("common.port")} ${snapshot.effectiveConfig.port}`
    : "";

  return (
    <Flex height="100vh">
      <Sidebar saving={saving} dirty={dirty} snapshotMeta={snapshotMeta} onSave={saveConfig} />
      <Box
        flexGrow="1"
        overflowY="auto"
        style={{
          backgroundColor: "var(--gray-2)",
        }}
      >
        <Box
          px="6"
          py="5"
          style={{
            maxWidth: "var(--app-page-max-width)",
            margin: "0 auto",
            minHeight: "100%",
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Flex>
  );
}

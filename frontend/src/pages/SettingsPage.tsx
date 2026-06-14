import { Card, Flex, Box, Heading, Text, TextField, Callout, Grid } from "@radix-ui/themes";
import { useT } from "../i18n";
import { useConfigContext } from "../hooks/ConfigContext";

export default function SettingsPage() {
  const { t } = useT();
  const { snapshot, form, updateForm } = useConfigContext();

  if (!snapshot || !form) return null;

  const setField = (section: "server" | "record", field: string, value: string) => {
    updateForm((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
  };

  return (
    <Flex direction="column" gap="4">
      <Card>
        <Heading>{t("settings.heading")}</Heading>
        <Text color="gray">
          {t("common.version")} {snapshot.version} · {snapshot.configPath} · {t("common.port")} {snapshot.effectiveConfig.port}
        </Text>

        <Grid columns="3" gap="3" mt="4">
          <Box>
            <Text as="label" size="2" weight="bold">
              {t("settings.labelTtfb")}
            </Text>
            <TextField.Root
              mt="1"
              type="number"
              min="1"
              step="1"
              value={form.server.ttfb_timeout}
              onChange={(e) => setField("server", "ttfb_timeout", e.target.value)}
            />
            <Text size="1" color="gray" as="p" mt="1">
              {t("settings.helperTtfb")}
            </Text>
          </Box>
          <Box>
            <Text as="label" size="2" weight="bold">
              {t("settings.labelRecordMax")}
            </Text>
            <TextField.Root
              mt="1"
              type="number"
              min="1"
              step="1"
              value={form.record.max_size}
              onChange={(e) => setField("record", "max_size", e.target.value)}
            />
            <Text size="1" color="gray" as="p" mt="1">
              {t("settings.helperRecordMax")}
            </Text>
          </Box>
        </Grid>

        <Callout.Root mt="3">
          <Callout.Text>
            {t("settings.noteBox")}
          </Callout.Text>
        </Callout.Root>

        {snapshot.lastError && (
          <Callout.Root color="red" mt="3">
            <Callout.Text>
              {snapshot.lastError.message} ({snapshot.lastError.source})
            </Callout.Text>
          </Callout.Root>
        )}
      </Card>
    </Flex>
  );
}

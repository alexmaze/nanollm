import { Card, Flex, Box, Heading, Text, TextField, Callout, Grid, Button, Tooltip } from "@radix-ui/themes";
import { GearIcon, ReloadIcon, InfoCircledIcon } from "@radix-ui/react-icons";
import { useT } from "../i18n";
import { useConfigContext } from "../hooks/ConfigContext";
import PageHeader from "../components/PageHeader";
import GuardedResetButton from "../components/GuardedResetButton";
import PageSkeleton from "../components/PageSkeleton";
import { validateSettings, hasErrors } from "../utils/validation";

export default function SettingsPage() {
  const { t } = useT();
  const { snapshot, form, updateForm, refreshConfig, saveConfig, saving } = useConfigContext();

  if (!snapshot || !form) return <PageSkeleton cards={1} />;

  const setField = (section: "server" | "record", field: string, value: string) => {
    updateForm((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
  };

  const errors = validateSettings(form.server, form.record);
  const hasValidationErrors = hasErrors(errors);

  return (
    <Flex direction="column" gap="5">
      <PageHeader title={t("settings.heading")} description={`${t("common.version")} ${snapshot.version} · ${snapshot.configPath} · ${t("common.port")} ${snapshot.effectiveConfig.port}`}>
        <Button variant="ghost" onClick={refreshConfig}>
          <ReloadIcon />
          {t("common.refresh")}
        </Button>
        <GuardedResetButton />
        <Tooltip content={hasValidationErrors ? t("validation.cannotSaveErrors") : undefined}>
          <Button onClick={saveConfig} disabled={saving || hasValidationErrors}>
            <GearIcon />
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </Tooltip>
      </PageHeader>

      <Card size="3">
        <Heading size="3" mb="4">
          {t("settings.heading")}
        </Heading>

        <Grid columns="2" gap="4">
          <Box className="form-field">
            <Text as="label" size="2" weight="medium" color="gray">
              {t("settings.labelTtfb")}
            </Text>
            <TextField.Root
              mt="2"
              type="number"
              min="1"
              step="1"
              color={errors.ttfb_timeout ? "red" : undefined}
              value={form.server.ttfb_timeout}
              onChange={(e) => setField("server", "ttfb_timeout", e.target.value)}
            />
            {errors.ttfb_timeout ? (
              <Text className="form-field-error">{t(errors.ttfb_timeout)}</Text>
            ) : (
              <Text className="form-field-help">{t("settings.helperTtfb")}</Text>
            )}
          </Box>
          <Box className="form-field">
            <Text as="label" size="2" weight="medium" color="gray">
              {t("settings.labelRecordMax")}
            </Text>
            <TextField.Root
              mt="2"
              type="number"
              min="1"
              step="1"
              color={errors.max_size ? "red" : undefined}
              value={form.record.max_size}
              onChange={(e) => setField("record", "max_size", e.target.value)}
            />
            {errors.max_size ? (
              <Text className="form-field-error">{t(errors.max_size)}</Text>
            ) : (
              <Text className="form-field-help">{t("settings.helperRecordMax")}</Text>
            )}
          </Box>
        </Grid>

        <Callout.Root mt="4" color="blue" variant="soft">
          <Callout.Icon>
            <InfoCircledIcon />
          </Callout.Icon>
          <Callout.Text>{t("settings.noteBox")}</Callout.Text>
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

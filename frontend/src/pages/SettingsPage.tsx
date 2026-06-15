import { Card, Flex, Box, Heading, Text, TextField, Callout, Grid, Button, Tooltip, Switch, Separator } from "@radix-ui/themes";
import { GearIcon, ReloadIcon, InfoCircledIcon, ExclamationTriangleIcon } from "@radix-ui/react-icons";
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

  const setAuthField = (dimension: "admin" | "api", field: string, value: string) => {
    updateForm((prev) => ({
      ...prev,
      server: {
        ...prev.server,
        auth: {
          ...prev.server.auth,
          [dimension]: { ...prev.server.auth[dimension], [field]: value },
        },
      },
    }));
  };

  const errors = validateSettings(form.server, form.record);
  const hasValidationErrors = hasErrors(errors);

  // Detect PORT env override: effective port differs from YAML port
  const effectivePort = snapshot.effectiveConfig?.port;
  const yamlPort = form.server.port ? Number(form.server.port) : undefined;
  const portEnvOverride = effectivePort !== undefined && yamlPort !== undefined && !isNaN(yamlPort) && effectivePort !== yamlPort;

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
          {/* Port */}
          <Box className="form-field">
            <Text as="label" size="2" weight="medium" color="gray">
              {t("settings.labelPort")}
            </Text>
            <TextField.Root
              mt="2"
              type="number"
              min="1"
              max="65535"
              step="1"
              color={errors.port ? "red" : undefined}
              value={form.server.port}
              onChange={(e) => setField("server", "port", e.target.value)}
            />
            {errors.port ? (
              <Text className="form-field-error">{t(errors.port)}</Text>
            ) : (
              <Text className="form-field-help">{t("settings.helperPort")}</Text>
            )}
            {portEnvOverride && (
              <Text size="1" color="orange" mt="1" as="p">
                ⚠ {t("settings.portEnvOverride")}
              </Text>
            )}
          </Box>

          {/* TTFB Timeout */}
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

          {/* Record Max Size */}
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

        {/* Port warning */}
        <Callout.Root mt="4" color="orange" variant="soft">
          <Callout.Icon>
            <ExclamationTriangleIcon />
          </Callout.Icon>
          <Callout.Text>{t("settings.portWarning")}</Callout.Text>
        </Callout.Root>

        {/* ─── Authentication ─── */}
        <Separator size="4" my="5" />

        <Heading size="3" mb="3">
          {t("settings.authHeading")}
        </Heading>

        <Callout.Root color="blue" variant="soft" mb="4">
          <Callout.Icon>
            <InfoCircledIcon />
          </Callout.Icon>
          <Callout.Text>{t("settings.authHelper")}</Callout.Text>
        </Callout.Root>

        {/* Admin Basic Auth */}
        <Box mb="5">
          <Flex align="center" gap="3" mb="3">
            <Switch
              checked={form.server.auth.admin.enabled === "true"}
              onCheckedChange={(checked) => setAuthField("admin", "enabled", checked ? "true" : "false")}
            />
            <Text size="2" weight="medium">
              {t("settings.adminAuthLabel")}
            </Text>
          </Flex>
          {form.server.auth.admin.enabled === "true" && (
            <Grid columns="2" gap="4">
              <Box className="form-field">
                <Text as="label" size="2" weight="medium" color="gray">
                  {t("settings.adminUsername")}
                </Text>
                <TextField.Root
                  mt="2"
                  color={errors.adminUsername ? "red" : undefined}
                  value={form.server.auth.admin.username}
                  onChange={(e) => setAuthField("admin", "username", e.target.value)}
                />
                {errors.adminUsername && <Text className="form-field-error">{t(errors.adminUsername)}</Text>}
              </Box>
              <Box className="form-field">
                <Text as="label" size="2" weight="medium" color="gray">
                  {t("settings.adminPassword")}
                </Text>
                <TextField.Root
                  mt="2"
                  type="password"
                  color={errors.adminPassword ? "red" : undefined}
                  value={form.server.auth.admin.password}
                  onChange={(e) => setAuthField("admin", "password", e.target.value)}
                />
                {errors.adminPassword && <Text className="form-field-error">{t(errors.adminPassword)}</Text>}
              </Box>
            </Grid>
          )}
        </Box>

        {/* API Bearer Token */}
        <Box>
          <Flex align="center" gap="3" mb="3">
            <Switch
              checked={form.server.auth.api.enabled === "true"}
              onCheckedChange={(checked) => setAuthField("api", "enabled", checked ? "true" : "false")}
            />
            <Text size="2" weight="medium">
              {t("settings.apiAuthLabel")}
            </Text>
          </Flex>
          {form.server.auth.api.enabled === "true" && (
            <Box className="form-field" style={{ maxWidth: 400 }}>
              <Text as="label" size="2" weight="medium" color="gray">
                {t("settings.apiToken")}
              </Text>
              <TextField.Root
                mt="2"
                type="password"
                color={errors.apiToken ? "red" : undefined}
                value={form.server.auth.api.token}
                onChange={(e) => setAuthField("api", "token", e.target.value)}
              />
              {errors.apiToken && <Text className="form-field-error">{t(errors.apiToken)}</Text>}
            </Box>
          )}
        </Box>

        {/* General note */}
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

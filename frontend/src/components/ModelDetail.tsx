import { useState, useRef, useEffect, useCallback } from "react";
import {
  Card,
  Flex,
  Box,
  Button,
  Text,
  TextField,
  Select,
  IconButton,
  Badge,
  Grid,
  Tooltip,
  Switch,
  Separator,
  Callout,
  Tabs,
  Spinner,
} from "@radix-ui/themes";
import {
  CopyIcon,
  TrashIcon,
  EyeOpenIcon,
  EyeClosedIcon,
  PlayIcon,
  ActivityLogIcon,
} from "@radix-ui/react-icons";
import { useT } from "../i18n";
import { useConfigContext } from "../hooks/ConfigContext";
import type { HydratedForm } from "../hooks/useConfig";
import type { StatusData, TestModelResult } from "../api";
import { api } from "../api";
import {
  getHealthTone,
  getModelHealthCells,
  getModelLatestCell,
  aggregateHealth,
  aggSpeed,
  formatTokenM,
  formatSpeed,
  TONE_COLORS,
} from "./health";
import { PROVIDERS, providerLabel } from "./ModelListItem";
import ConfirmDialog from "./ConfirmDialog";
import KeyValueEditor from "./KeyValueEditor";
import CodeEditor from "./CodeEditor";
import EmptyState from "./EmptyState";
import { validateModel, validateModelAdvanced } from "../utils/validation";

// --- Extras helpers (kept local to avoid a new module) ---

function getExtraStr(extras: Record<string, unknown>, key: string): string {
  const v = extras[key];
  if (v === undefined || v === null) return "";
  return String(v);
}

function getExtraBool(extras: Record<string, unknown>, key: string, defaultValue: boolean): boolean {
  const v = extras[key];
  if (v === undefined || v === null) return defaultValue;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.trim().toLowerCase() === "true";
  return defaultValue;
}

function getExtraHeaders(extras: Record<string, unknown>): Record<string, string> {
  const v = extras.headers;
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const result: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    result[k] = String(val);
  }
  return result;
}

function getExtraBodyStr(extras: Record<string, unknown>): string {
  const v = extras.body;
  if (v === undefined || v === null || v === "") return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

interface ModelDetailProps {
  index: number;
  statusData: StatusData | null | undefined;
  onClone: (index: number) => void;
}

export default function ModelDetail({ index, statusData, onClone }: ModelDetailProps) {
  const { t } = useT();
  const { form, updateForm } = useConfigContext();
  const [tab, setTab] = useState("basic");
  const [showApiKey, setShowApiKey] = useState(false);
  const [testState, setTestState] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testResult, setTestResult] = useState<TestModelResult | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // All hooks must run before any early return (React error #310 otherwise).

  // Focus the name field on mount / index change (e.g. after Add / select).
  useEffect(() => {
    if (nameInputRef.current) nameInputRef.current.focus();
  }, [index]);

  // Reset test result when the model identity changes.
  const currentName = form?.models[index]?.name;
  useEffect(() => {
    setTestState("idle");
    setTestResult(null);
  }, [currentName]);

  const setExtra = useCallback((key: string, value: unknown) => {
    updateForm((prev) => {
      const next = { ...prev };
      const models = [...next.models];
      const m = { ...models[index] };
      m.extras = { ...(m.extras || {}), [key]: value };
      models[index] = m;
      next.models = models;
      return next as HydratedForm;
    });
  }, [index, updateForm]);

  const removeExtra = useCallback((key: string) => {
    updateForm((prev) => {
      const next = { ...prev };
      const models = [...next.models];
      const m = { ...models[index] };
      const newExtras = { ...(m.extras || {}) };
      delete newExtras[key];
      m.extras = newExtras;
      models[index] = m;
      next.models = models;
      return next as HydratedForm;
    });
  }, [index, updateForm]);

  if (!form) return null;
  const model = form.models[index];
  if (!model) return null;

  const extras = model.extras || {};
  const healthCells = getModelHealthCells(model.name, statusData);
  const latest = getModelLatestCell(model.name, statusData);
  const tone = getHealthTone(latest);
  const agg = aggregateHealth(healthCells);
  const speed = aggSpeed(agg);

  const fieldErrors = validateModel(model, form.models.map((m) => m.name), index);
  const advancedErrors = validateModelAdvanced(extras);

  const set = (field: string, value: string) => {
    updateForm((prev) => {
      const next = { ...prev };
      const models = [...next.models];
      const m = { ...models[index] };
      (m as Record<string, unknown>)[field] = value;

      if (field === "name" && model.name !== value) {
        const oldName = model.name;
        const newGroups = next.fallbackGroups.map((g) => ({
          ...g,
          members: g.members.map((mem) => (mem.value === oldName ? { ...mem, value } : mem)),
        }));
        next.fallbackGroups = newGroups;
      }

      models[index] = m;
      next.models = models;
      return next as HydratedForm;
    });
  };

  const deleteModel = () => {
    updateForm((prev) => {
      const models = prev.models.filter((_, i) => i !== index);
      const groups = prev.fallbackGroups.map((g) => ({
        ...g,
        members: g.members.filter((m) => m.value !== model.name),
      }));
      return { ...prev, models: models as HydratedForm["models"], fallbackGroups: groups };
    });
  };

  const handleTest = async () => {
    if (!model.name?.trim()) return;
    setTestState("testing");
    setTestResult(null);
    try {
      const result = await api.testModel(model.name.trim());
      setTestResult(result);
      setTestState(result.ok ? "success" : "error");
    } catch (e) {
      setTestResult({ ok: false, error: e instanceof Error ? e.message : String(e) });
      setTestState("error");
    }
  };

  const displayName = model.name?.trim() || t("models.unnamedModel", { index: index + 1 });

  return (
    <Flex direction="column" gap="3">
      {/* Sticky header */}
      <Card size="3" className="models-sticky-head">
        <Flex justify="between" align="start" gap="3" wrap="wrap">
          <Box style={{ minWidth: 0, flex: "1 1 260px" }}>
            <Flex align="center" gap="2" wrap="wrap">
              <Tooltip
                content={
                  latest
                    ? t("models.successRate", { rate: latest.successRate.toFixed(1) })
                    : t("models.noHealthData")
                }
              >
                <Box
                  width="12px"
                  height="12px"
                  style={{
                    borderRadius: "50%",
                    backgroundColor: TONE_COLORS[tone],
                    flexShrink: 0,
                  }}
                  className="app-status-dot"
                  data-status={tone === "empty" ? "no-data" : "stable"}
                />
              </Tooltip>
              <Text size="4" weight="bold" className="app-truncate" style={{ minWidth: 0 }}>
                {displayName}
              </Text>
            </Flex>
            <Flex gap="2" mt="2" align="center" wrap="wrap">
              <Badge variant="soft" color="gray">
                {providerLabel(model.provider)}
              </Badge>
              {model.model?.trim() && (
                <Badge variant="soft" size="1">
                  {model.model}
                </Badge>
              )}
              {speed != null && (
                <Text size="1" color="gray">
                  {formatSpeed(speed)}
                </Text>
              )}
            </Flex>
          </Box>

          <Flex align="center" gap="2" style={{ flexShrink: 0 }}>
            <Button
              variant="outline"
              size="2"
              onClick={handleTest}
              disabled={testState === "testing" || !model.name?.trim()}
            >
              {testState === "testing" ? <Spinner size="1" /> : <PlayIcon />}
              {testState === "testing" ? t("models.testing") : t("models.testConnection")}
            </Button>
            <Tooltip content={t("models.clone")}>
              <IconButton variant="soft" color="gray" size="2" aria-label={t("models.clone")} onClick={() => onClone(index)}>
                <CopyIcon />
              </IconButton>
            </Tooltip>
            <ConfirmDialog
              title={t("models.confirmDeleteTitle")}
              description={t("models.confirmDeleteDescription", { name: displayName })}
              confirmLabel={t("common.delete")}
              cancelLabel={t("common.no")}
              destructive
              onConfirm={deleteModel}
              trigger={
                <IconButton color="red" variant="soft" size="2" aria-label={t("common.delete")}>
                  <TrashIcon />
                </IconButton>
              }
            />
          </Flex>
        </Flex>

        {(testState === "success" || testState === "error") && testResult && (
          <Box mt="3">
            {testState === "success" ? (
              <Callout.Root color="green" variant="soft" size="1">
                <Callout.Text>
                  {t("models.testSuccess", { ttfb: testResult.ttfbMs ?? "?" })}
                </Callout.Text>
              </Callout.Root>
            ) : (
              <Callout.Root color="red" variant="soft" size="1">
                <Callout.Text>
                  {testResult.error
                    ? t("models.testError", { error: testResult.error })
                    : t("models.testFailed")}
                </Callout.Text>
              </Callout.Root>
            )}
          </Box>
        )}
      </Card>

      {/* Tabs */}
      <Card size="3">
        <Tabs.Root value={tab} onValueChange={setTab}>
          <Tabs.List>
            <Tabs.Trigger value="basic">{t("models.tabBasic")}</Tabs.Trigger>
            <Tabs.Trigger value="advanced">{t("models.tabAdvanced")}</Tabs.Trigger>
            <Tabs.Trigger value="health">
              {t("models.tabHealth")}
              {healthCells.length > 0 && (
                <Badge variant="soft" size="1" ml="2">
                  {healthCells.length}
                </Badge>
              )}
            </Tabs.Trigger>
          </Tabs.List>

          <Box pt="4">
            {/* Basic */}
            <Tabs.Content value="basic">
              <Grid columns="2" gap="4">
                <Box className="form-field">
                  <Text as="label" size="2" weight="medium" color="gray">
                    {t("models.labelName")}
                  </Text>
                  <TextField.Root
                    ref={nameInputRef}
                    mt="2"
                    value={model.name}
                    color={fieldErrors.name ? "red" : undefined}
                    onChange={(e) => set("name", e.target.value)}
                  />
                  {fieldErrors.name && <Text className="form-field-error">{t(fieldErrors.name)}</Text>}
                </Box>
                <Box className="form-field">
                  <Text as="label" size="2" weight="medium" color="gray">
                    {t("models.labelProvider")}
                  </Text>
                  <Select.Root value={model.provider || PROVIDERS[0]} onValueChange={(v) => set("provider", v)}>
                    <Select.Trigger mt="2" style={{ width: "100%" }} />
                    <Select.Content>
                      {PROVIDERS.map((p) => (
                        <Select.Item key={p} value={p}>
                          {providerLabel(p)}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </Box>
                <Box className="form-field">
                  <Text as="label" size="2" weight="medium" color="gray">
                    {t("models.labelBaseUrl")}
                  </Text>
                  <TextField.Root
                    mt="2"
                    value={model.base_url}
                    color={fieldErrors.base_url ? "red" : undefined}
                    placeholder={t("models.baseUrlPlaceholder")}
                    onChange={(e) => set("base_url", e.target.value)}
                  />
                  {fieldErrors.base_url && <Text className="form-field-error">{t(fieldErrors.base_url)}</Text>}
                </Box>
                <Box className="form-field">
                  <Text as="label" size="2" weight="medium" color="gray">
                    {t("models.labelModel")}
                  </Text>
                  <TextField.Root
                    mt="2"
                    value={model.model}
                    color={fieldErrors.model ? "red" : undefined}
                    placeholder={t("models.modelPlaceholder")}
                    onChange={(e) => set("model", e.target.value)}
                  />
                  {fieldErrors.model && <Text className="form-field-error">{t(fieldErrors.model)}</Text>}
                </Box>
                <Box className="form-field" style={{ gridColumn: "span 2" }}>
                  <Text as="label" size="2" weight="medium" color="gray">
                    {t("models.labelApiKey")}
                  </Text>
                  <TextField.Root
                    mt="2"
                    type={showApiKey ? "text" : "password"}
                    value={model.api_key}
                    placeholder={t("models.apiKeyPlaceholder")}
                    onChange={(e) => set("api_key", e.target.value)}
                  >
                    <TextField.Slot side="right">
                      <Tooltip content={showApiKey ? t("models.hideKey") : t("models.showKey")}>
                        <IconButton
                          size="1"
                          variant="ghost"
                          color="gray"
                          aria-label={showApiKey ? t("models.hideKey") : t("models.showKey")}
                          onClick={() => setShowApiKey((v) => !v)}
                        >
                          {showApiKey ? <EyeClosedIcon /> : <EyeOpenIcon />}
                        </IconButton>
                      </Tooltip>
                    </TextField.Slot>
                  </TextField.Root>
                </Box>
              </Grid>
            </Tabs.Content>

            {/* Advanced */}
            <Tabs.Content value="advanced">
              <Grid columns="2" gap="4">
                <Box className="form-field">
                  <Text as="label" size="2" weight="medium" color="gray">
                    {t("models.labelTtfbTimeout")}
                  </Text>
                  <TextField.Root
                    mt="2"
                    type="number"
                    min="1"
                    step="1"
                    color={advancedErrors.ttfb_timeout ? "red" : undefined}
                    value={getExtraStr(extras, "ttfb_timeout")}
                    placeholder={t("models.helperTtfbTimeout")}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      if (v === "") removeExtra("ttfb_timeout");
                      else setExtra("ttfb_timeout", v);
                    }}
                  />
                  {advancedErrors.ttfb_timeout ? (
                    <Text className="form-field-error">{t(advancedErrors.ttfb_timeout)}</Text>
                  ) : (
                    <Text className="form-field-help">{t("models.helperTtfbTimeout")}</Text>
                  )}
                </Box>

                <Box className="form-field">
                  <Text as="label" size="2" weight="medium" color="gray">
                    {t("models.labelProxy")}
                  </Text>
                  <TextField.Root
                    mt="2"
                    color={advancedErrors.proxy ? "red" : undefined}
                    value={getExtraStr(extras, "proxy")}
                    placeholder={t("models.proxyPlaceholder")}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      if (v === "") removeExtra("proxy");
                      else setExtra("proxy", v);
                    }}
                  />
                  {advancedErrors.proxy ? (
                    <Text className="form-field-error">{t(advancedErrors.proxy)}</Text>
                  ) : (
                    <Text className="form-field-help">{t("models.helperProxy")}</Text>
                  )}
                </Box>

                {model.provider === "openai-chat" && (
                  <Box className="form-field">
                    <Flex align="center" gap="3" mt="5">
                      <Switch
                        checked={getExtraBool(extras, "image", true)}
                        onCheckedChange={(checked) => setExtra("image", checked)}
                      />
                      <Box>
                        <Text size="2" weight="medium" color="gray">
                          {t("models.labelImage")}
                        </Text>
                        <Text size="1" color="gray" as="p">
                          {t("models.helperImage")}
                        </Text>
                      </Box>
                    </Flex>
                  </Box>
                )}

                {model.provider === "anthropic" && (
                  <Box className="form-field">
                    <Flex align="center" gap="3" mt="5">
                      <Switch
                        checked={getExtraBool(extras, "ignore_invalid_history", true)}
                        onCheckedChange={(checked) => setExtra("ignore_invalid_history", checked)}
                      />
                      <Box>
                        <Text size="2" weight="medium" color="gray">
                          {t("models.labelIgnoreInvalidHistory")}
                        </Text>
                        <Text size="1" color="gray" as="p">
                          {t("models.helperIgnoreInvalidHistory")}
                        </Text>
                      </Box>
                    </Flex>
                  </Box>
                )}
              </Grid>

              <Box className="form-field" mt="4">
                <Text as="label" size="2" weight="medium" color="gray">
                  {t("models.labelHeaders")}
                </Text>
                <Text size="1" color="gray" as="p" mb="2">
                  {t("models.helperHeaders")}
                </Text>
                <KeyValueEditor
                  value={getExtraHeaders(extras)}
                  onChange={(v) => {
                    if (Object.keys(v).length === 0) removeExtra("headers");
                    else setExtra("headers", v);
                  }}
                />
              </Box>

              <Box className="form-field" mt="4">
                <Text as="label" size="2" weight="medium" color="gray">
                  {t("models.labelBody")}
                </Text>
                <Text size="1" color="gray" as="p" mb="2">
                  {t("models.helperBody")}
                </Text>
                <CodeEditor
                  value={getExtraBodyStr(extras)}
                  language="json"
                  height={120}
                  onChange={(v) => {
                    if (!v.trim()) removeExtra("body");
                    else setExtra("body", v);
                  }}
                />
                {advancedErrors.body && <Text className="form-field-error">{t(advancedErrors.body)}</Text>}
              </Box>

              <Box className="form-field" mt="4">
                <Text as="label" size="2" weight="medium" color="gray">
                  {t("models.labelBodyExpression")}
                </Text>
                <Text size="1" color="gray" as="p" mb="2">
                  {t("models.helperBodyExpression")}
                </Text>
                <CodeEditor
                  value={getExtraStr(extras, "bodyExpression")}
                  language="javascript"
                  height={120}
                  onChange={(v) => {
                    if (!v.trim()) removeExtra("bodyExpression");
                    else setExtra("bodyExpression", v);
                  }}
                />
              </Box>
            </Tabs.Content>

            {/* Health */}
            <Tabs.Content value="health">
              {healthCells.length === 0 ? (
                <EmptyState
                  title={t("models.noHealthData")}
                  description={t("models.meta")}
                  icon={<ActivityLogIcon />}
                />
              ) : (
                <Box>
                  <Text size="2" weight="medium" color="gray" mb="2" as="p">
                    {t("models.healthTitle")}
                  </Text>
                  <Flex gap="4px" mb="3" wrap="wrap" align="center">
                    {healthCells.map((cell, i) => (
                      <Tooltip key={i} content={`${cell.successRate.toFixed(1)}%`}>
                        <Box
                          width="12px"
                          height="12px"
                          style={{
                            borderRadius: 2,
                            backgroundColor: TONE_COLORS[getHealthTone(cell)],
                            cursor: "pointer",
                          }}
                        />
                      </Tooltip>
                    ))}
                  </Flex>
                  <Separator size="4" my="3" />
                  <Flex gap="4" mt="2" wrap="wrap">
                    <Text size="2">
                      {t("models.healthInput")} <Text weight="bold">{formatTokenM(agg.ni)}</Text>
                    </Text>
                    <Text size="2">
                      {t("models.healthCache")} <Text weight="bold">{formatTokenM(agg.cr)}</Text>
                    </Text>
                    <Text size="2">
                      {t("models.healthOutput")} <Text weight="bold">{formatTokenM(agg.ot)}</Text>
                    </Text>
                    <Text size="2">
                      {t("models.healthSpeed")} <Text weight="bold">{formatSpeed(speed)}</Text>
                    </Text>
                  </Flex>
                </Box>
              )}
            </Tabs.Content>
          </Box>
        </Tabs.Root>
      </Card>
    </Flex>
  );
}

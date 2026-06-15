import { useState, useRef, useEffect, useCallback } from "react";
import { Card, Flex, Box, Button, Text, TextField, Select, IconButton, Badge, Grid, Tooltip, Switch, Separator, Callout } from "@radix-ui/themes";
import { ChevronDownIcon, ChevronRightIcon, TrashIcon, EyeOpenIcon, EyeClosedIcon } from "@radix-ui/react-icons";
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
import ConfirmDialog from "./ConfirmDialog";
import KeyValueEditor from "./KeyValueEditor";
import CodeEditor from "./CodeEditor";
import { validateModel, validateModelAdvanced, hasErrors } from "../utils/validation";

// Re-export for backwards compatibility (StatusPage imports from here).
export { getHealthTone } from "./health";

const PROVIDERS = ["openai-chat", "openai-responses", "anthropic", "openai-image"];

// --- Extras helpers ---

/** Read a string-valued extra, returning "" if missing. */
function getExtraStr(extras: Record<string, unknown>, key: string): string {
  const v = extras[key];
  if (v === undefined || v === null) return "";
  return String(v);
}

/** Read a boolean-valued extra, returning the provided default if missing. */
function getExtraBool(extras: Record<string, unknown>, key: string, defaultValue: boolean): boolean {
  const v = extras[key];
  if (v === undefined || v === null) return defaultValue;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.trim().toLowerCase() === "true";
  return defaultValue;
}

/** Read a Record<string,string> extra, returning {} if missing. */
function getExtraHeaders(extras: Record<string, unknown>): Record<string, string> {
  const v = extras.headers;
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const result: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    result[k] = String(val);
  }
  return result;
}

/** Read the `body` extra as a JSON string for the code editor. */
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

// --- ModelCard ---

interface ModelCardProps {
  index: number;
  statusData: StatusData | null | undefined;
}

export default function ModelCard({ index, statusData }: ModelCardProps) {
  const { t } = useT();
  const { form, updateForm } = useConfigContext();
  const [expanded, setExpanded] = useState(false);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testState, setTestState] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testResult, setTestResult] = useState<TestModelResult | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  if (!form) return null;
  const model = form.models[index];
  if (!model) return null;

  const extras = model.extras || {};
  const healthCells = getModelHealthCells(model.name, statusData);
  const latest = getModelLatestCell(model.name, statusData);
  const tone = getHealthTone(latest);

  const fieldErrors = expanded
    ? validateModel(model, form.models.map((m) => m.name), index)
    : {};
  const advancedErrors = expanded && advancedExpanded
    ? validateModelAdvanced(extras)
    : {};

  const summary = `${model.provider || t("models.noProvider")} · ${model.model || t("models.noModel")} · ${model.base_url || t("models.noBaseUrl")}`;

  const toggle = () => setExpanded((prev) => !prev);

  useEffect(() => {
    if (expanded && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [expanded]);

  // Reset test result when model name changes (result belongs to old name).
  useEffect(() => {
    setTestState("idle");
    setTestResult(null);
  }, [model.name]);

  // --- Form update helpers ---

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

  /** Update a single key in model.extras. */
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

  /** Remove a key from model.extras (set to undefined to clean up). */
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

  const agg = aggregateHealth(healthCells);
  const speed = aggSpeed(agg);

  // Count non-empty advanced fields for the badge
  const advancedFieldCount = [
    extras.ttfb_timeout !== undefined && extras.ttfb_timeout !== null && extras.ttfb_timeout !== "",
    extras.proxy !== undefined && extras.proxy !== null && extras.proxy !== "",
    extras.image !== undefined && extras.image !== true,
    extras.ignore_invalid_history !== undefined && extras.ignore_invalid_history !== true,
    extras.headers && typeof extras.headers === "object" && Object.keys(extras.headers as object).length > 0,
    extras.body !== undefined && extras.body !== null && extras.body !== "",
    extras.bodyExpression !== undefined && extras.bodyExpression !== null && extras.bodyExpression !== "",
  ].filter(Boolean).length;

  return (
    <Card size="2" className="app-hover-card">
      <Flex justify="between" align="center" gap="3" wrap="wrap">
        <Flex
          align="center"
          gap="3"
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          aria-label={t(expanded ? "common.collapse" : "common.expand")}
          style={{ cursor: "pointer", minWidth: 280, flex: 1 }}
          onClick={toggle}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggle();
            }
          }}
        >
          <IconButton variant="ghost" size="1" color="gray" style={{ flexShrink: 0 }} tabIndex={-1} aria-hidden>
            {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </IconButton>

          <Tooltip content={latest ? t("models.successRate", { rate: latest.successRate.toFixed(1) }) : t("models.noHealthData")}>
            <Box
              width="10px"
              height="10px"
              style={{ borderRadius: "50%", backgroundColor: TONE_COLORS[tone], flexShrink: 0 }}
              className="app-status-dot"
              data-status={tone === "empty" ? "no-data" : "stable"}
            />
          </Tooltip>

          <Flex align="center" gap="2" wrap="wrap">
            <Text weight="bold" size="3">
              {model.name?.trim() || t("models.unnamedModel", { index: index + 1 })}
            </Text>
            {advancedFieldCount > 0 && (
              <Badge color="indigo" variant="soft">
                {t("models.advancedFields")}
              </Badge>
            )}
          </Flex>

          <Text size="2" color="gray" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {summary}
          </Text>
        </Flex>

        <ConfirmDialog
          title={t("models.confirmDeleteTitle")}
          description={t("models.confirmDeleteDescription", { name: model.name || t("models.unnamedModel", { index: index + 1 }) })}
          confirmLabel={t("common.delete")}
          cancelLabel={t("common.no")}
          destructive
          onConfirm={deleteModel}
          trigger={
            <IconButton
              color="red"
              variant="ghost"
              size="2"
              aria-label={t("common.delete")}
              onClick={(e) => e.stopPropagation()}
            >
              <TrashIcon />
            </IconButton>
          }
        />
      </Flex>

      {expanded && (
        <>
          <Box style={{ borderTop: "1px solid var(--gray-5)" }} mt="4" mb="4" />

          {/* ─── Basic Fields ─── */}
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
                      {p}
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

          {/* ─── Test Connection ─── */}
          <Flex justify="between" align="center" mt="4">
            <Box>
              {testState === "success" && testResult && (
                <Callout.Root color="green" variant="soft" size="1">
                  <Callout.Text>
                    {t("models.testSuccess", { ttfb: testResult.ttfbMs ?? "?" })}
                  </Callout.Text>
                </Callout.Root>
              )}
              {testState === "error" && testResult && (
                <Callout.Root color="red" variant="soft" size="1">
                  <Callout.Text>
                    {testResult.error
                      ? t("models.testError", { error: testResult.error })
                      : t("models.testFailed")}
                  </Callout.Text>
                </Callout.Root>
              )}
            </Box>
            <Button
              variant="outline"
              size="2"
              disabled={testState === "testing" || !model.name?.trim()}
              onClick={handleTest}
            >
              {testState === "testing" ? t("models.testing") : t("models.testConnection")}
            </Button>
          </Flex>

          {/* ─── Advanced Fields (collapsible) ─── */}
          <Box mt="4">
            <Flex
              align="center"
              gap="2"
              role="button"
              tabIndex={0}
              style={{ cursor: "pointer", userSelect: "none" }}
              onClick={() => setAdvancedExpanded((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setAdvancedExpanded((v) => !v);
                }
              }}
            >
              <IconButton variant="ghost" size="1" color="gray" tabIndex={-1} aria-hidden>
                {advancedExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
              </IconButton>
              <Text size="2" weight="medium" color="gray">
                {t("models.advancedSection")}
              </Text>
              {advancedFieldCount > 0 && (
                <Badge color="indigo" variant="soft" size="1">
                  {advancedFieldCount}
                </Badge>
              )}
            </Flex>

            {advancedExpanded && (
              <Box mt="3">
                <Grid columns="2" gap="4">
                  {/* ttfb_timeout */}
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

                  {/* proxy */}
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

                  {/* image (only for openai-chat) */}
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

                  {/* ignore_invalid_history (only for anthropic) */}
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

                {/* headers */}
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

                {/* body */}
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
                      if (!v.trim()) {
                        removeExtra("body");
                      } else {
                        // Always store as string; dehydrateForm will parse to
                        // object when valid JSON so the backend receives a
                        // proper object instead of a JSON string.
                        setExtra("body", v);
                      }
                    }}
                  />
                  {advancedErrors.body && <Text className="form-field-error">{t(advancedErrors.body)}</Text>}
                </Box>

                {/* bodyExpression */}
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
              </Box>
            )}
          </Box>

          {/* ─── Health ─── */}
          {healthCells.length > 0 && (
            <Box style={{ borderTop: "1px solid var(--gray-5)" }} mt="4" pt="4">
              <Text size="2" weight="medium" color="gray" mb="2" as="p">
                {t("models.healthTitle")}
              </Text>
              <Flex gap="4px" mb="3" wrap="wrap" align="center">
                {healthCells.map((cell, i) => (
                  <Tooltip key={i} content={`${cell.successRate.toFixed(1)}%`}>
                    <Box
                      width="10px"
                      height="10px"
                      style={{ borderRadius: 2, backgroundColor: TONE_COLORS[getHealthTone(cell)], cursor: "pointer" }}
                    />
                  </Tooltip>
                ))}
              </Flex>
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
        </>
      )}
    </Card>
  );
}

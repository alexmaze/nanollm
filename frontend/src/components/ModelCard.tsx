import { useState, useRef, useEffect } from "react";
import { Card, Flex, Box, Button, Text, TextField, Select, IconButton, Badge, Grid } from "@radix-ui/themes";
import { ChevronDownIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { useT } from "../i18n";
import { useConfigContext } from "../hooks/ConfigContext";
import type { HydratedForm } from "../hooks/useConfig";
import type { HealthCell, StatusData } from "../api";

const PROVIDERS = ["openai-chat", "openai-responses", "anthropic", "openai-image"];
const BUCKETS_PER_HOUR = 12;

// --- health helpers ---

export function getHealthTone(cell: HealthCell | null): "empty" | "green" | "lightgreen" | "orange" | "red" {
  if (!cell || cell.totalRequests === 0) return "empty";
  if (cell.successRate >= 100) return "green";
  if (cell.successRate >= 80) return "lightgreen";
  if (cell.successRate >= 50) return "orange";
  return "red";
}

const TONE_COLORS: Record<string, string> = {
  empty: "var(--gray-4)",
  green: "var(--green-9)",
  lightgreen: "var(--green-6)",
  orange: "var(--orange-9)",
  red: "var(--red-9)",
};

export function getModelHealthCells(modelName: string, statusData: StatusData | null | undefined): HealthCell[] {
  if (!statusData) return [];
  const model = statusData.models.find((m) => m.name === modelName);
  if (!model || !model.series) return [];
  return model.series.slice(-BUCKETS_PER_HOUR);
}

export function getModelLatestCell(modelName: string, statusData: StatusData | null | undefined): HealthCell | null {
  const cells = getModelHealthCells(modelName, statusData);
  return cells.length > 0 ? cells[cells.length - 1] : null;
}

function formatToken(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return "0K";
  const k = v / 1000;
  return k >= 100 ? Math.round(k) + "K" : k.toFixed(1) + "K";
}

function formatTokenM(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return "0M";
  const m = v / 1000000;
  if (m >= 100) return Math.round(m) + "M";
  if (m >= 10) return m.toFixed(1) + "M";
  return m.toFixed(2) + "M";
}

function formatSpeed(v: number | null): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return "-";
  if (v >= 100) return Math.round(v) + " tok/s";
  if (v >= 10) return v.toFixed(1) + " tok/s";
  return v.toFixed(2) + " tok/s";
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
  const nameInputRef = useRef<HTMLInputElement>(null);

  if (!form) return null;
  const model = form.models[index];
  if (!model) return null;

  const healthCells = getModelHealthCells(model.name, statusData);
  const latest = getModelLatestCell(model.name, statusData);
  const tone = getHealthTone(latest);
  const hasExtras = model.extras && Object.keys(model.extras).length > 0;

  const summary = `${model.provider || t("models.noProvider")} · ${model.model || t("models.noModel")} · ${model.base_url || t("models.noModel")}`;

  const toggle = () => setExpanded((prev) => !prev);

  // auto-focus name input
  useEffect(() => {
    if (expanded && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [expanded]);

  const set = (field: string, value: string) => {
    updateForm((prev) => {
      const next = { ...prev };
      const models = [...next.models];
      const m = { ...models[index] };
      (m as Record<string, unknown>)[field] = value;

      // sync name changes to fallback group members
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

  // Health aggregates
  const agg = healthCells.reduce(
    (a, c) => ({ ni: a.ni + c.nonCacheInputTokens, cr: a.cr + c.cacheReadInputTokens, ot: a.ot + c.outputTokens, ts: a.ts + (c.totalStreamMs || 0) }),
    { ni: 0, cr: 0, ot: 0, ts: 0 },
  );
  const speed = agg.ts > 0 ? agg.ot / (agg.ts / 1000) : null;

  return (
    <Card size="2">
      <Flex justify="between" align="center" gap="3" wrap="wrap">
        <Flex align="center" gap="2" style={{ cursor: "pointer", minWidth: 280, flex: 1 }} onClick={toggle}>
          <IconButton variant="soft" size="1" radius="full" style={{ flexShrink: 0 }}>
            {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </IconButton>
          <Flex align="center" gap="2" wrap="wrap">
            <Text weight="bold" size="3">
              {model.name?.trim() || t("models.unnamedModel", { index: index + 1 })}
            </Text>
            <Box
              width="12px"
              height="12px"
              style={{ borderRadius: 3, backgroundColor: TONE_COLORS[tone], flexShrink: 0, border: "1px solid rgba(0,0,0,0.08)" }}
              title={latest ? t("models.successRate", { rate: latest.successRate.toFixed(1) }) : t("models.noHealthData")}
            />
            {hasExtras && (
              <Badge color="blue" title={JSON.stringify(model.extras)}>
                {t("models.advancedFields")}
              </Badge>
            )}
          </Flex>
          <Text size="2" color="gray" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {summary}
          </Text>
        </Flex>
        <Button color="red" variant="ghost" size="2" onClick={deleteModel}>
          {t("common.delete")}
        </Button>
      </Flex>

      {expanded && (
        <>
          <Grid columns="2" gap="3" mt="3">
            <Box>
              <Text as="label" size="2" weight="bold" color="gray">
                {t("models.labelName")}
              </Text>
              <TextField.Root
                ref={nameInputRef}
                mt="1"
                value={model.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </Box>
            <Box>
              <Text as="label" size="2" weight="bold" color="gray">
                {t("models.labelProvider")}
              </Text>
              <Select.Root value={model.provider || PROVIDERS[0]} onValueChange={(v) => set("provider", v)}>
                <Select.Trigger mt="1" style={{ width: "100%" }} />
                <Select.Content>
                  {PROVIDERS.map((p) => (
                    <Select.Item key={p} value={p}>
                      {p}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Box>
            <Box>
              <Text as="label" size="2" weight="bold" color="gray">
                {t("models.labelBaseUrl")}
              </Text>
              <TextField.Root
                mt="1"
                value={model.base_url}
                placeholder={t("models.baseUrlPlaceholder")}
                onChange={(e) => set("base_url", e.target.value)}
              />
            </Box>
            <Box>
              <Text as="label" size="2" weight="bold" color="gray">
                {t("models.labelModel")}
              </Text>
              <TextField.Root
                mt="1"
                value={model.model}
                placeholder={t("models.modelPlaceholder")}
                onChange={(e) => set("model", e.target.value)}
              />
            </Box>
            <Box style={{ gridColumn: "span 2" }}>
              <Text as="label" size="2" weight="bold" color="gray">
                {t("models.labelApiKey")}
              </Text>
              <TextField.Root
                mt="1"
                value={model.api_key}
                placeholder={t("models.apiKeyPlaceholder")}
                onChange={(e) => set("api_key", e.target.value)}
              />
            </Box>
          </Grid>

          {healthCells.length > 0 && (
            <Box style={{ borderTop: "1px solid var(--gray-4)" }} mt="3" pt="3">
              <Text size="2" weight="bold" color="gray">
                {t("models.healthTitle")}
              </Text>
              <Flex gap="2px" mt="2" wrap="wrap" align="center">
                {healthCells.map((cell, i) => (
                  <Box
                    key={i}
                    width="10px"
                    height="10px"
                    style={{ borderRadius: 2, backgroundColor: TONE_COLORS[getHealthTone(cell)], border: "1px solid rgba(0,0,0,0.06)" }}
                    title={`${cell.successRate.toFixed(1)}%`}
                  />
                ))}
              </Flex>
              <Flex gap="3" mt="2" wrap="wrap">
                <Text size="1">
                  {t("models.healthInput")} <Text weight="bold">{formatTokenM(agg.ni)}</Text>
                </Text>
                <Text size="1">
                  {t("models.healthCache")} <Text weight="bold">{formatTokenM(agg.cr)}</Text>
                </Text>
                <Text size="1">
                  {t("models.healthOutput")} <Text weight="bold">{formatTokenM(agg.ot)}</Text>
                </Text>
                <Text size="1">
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

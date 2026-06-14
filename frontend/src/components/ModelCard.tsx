import { useState, useRef, useEffect } from "react";
import { Card, Flex, Box, Button, Text, TextField, Select, IconButton, Badge, Grid, Tooltip } from "@radix-ui/themes";
import { ChevronDownIcon, ChevronRightIcon, TrashIcon, EyeOpenIcon, EyeClosedIcon } from "@radix-ui/react-icons";
import { useT } from "../i18n";
import { useConfigContext } from "../hooks/ConfigContext";
import type { HydratedForm } from "../hooks/useConfig";
import type { StatusData } from "../api";
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
import { validateModel } from "../utils/validation";

// Re-export for backwards compatibility (StatusPage imports from here).
export { getHealthTone } from "./health";

const PROVIDERS = ["openai-chat", "openai-responses", "anthropic", "openai-image"];

// --- ModelCard ---

interface ModelCardProps {
  index: number;
  statusData: StatusData | null | undefined;
}

export default function ModelCard({ index, statusData }: ModelCardProps) {
  const { t } = useT();
  const { form, updateForm } = useConfigContext();
  const [expanded, setExpanded] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  if (!form) return null;
  const model = form.models[index];
  if (!model) return null;

  const healthCells = getModelHealthCells(model.name, statusData);
  const latest = getModelLatestCell(model.name, statusData);
  const tone = getHealthTone(latest);
  const hasExtras = model.extras && Object.keys(model.extras).length > 0;

  const fieldErrors = expanded
    ? validateModel(model, form.models.map((m) => m.name), index)
    : {};

  const summary = `${model.provider || t("models.noProvider")} · ${model.model || t("models.noModel")} · ${model.base_url || t("models.noModel")}`;

  const toggle = () => setExpanded((prev) => !prev);

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

  const agg = aggregateHealth(healthCells);
  const speed = aggSpeed(agg);

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
            {hasExtras && (
              <Badge color="indigo" variant="soft" title={JSON.stringify(model.extras)}>
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

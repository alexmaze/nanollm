import { Badge, Box, Flex, Text, Tooltip } from "@radix-ui/themes";
import type { StatusData, TestModelResult } from "../api";
import { useT } from "../i18n";
import { useConfigContext } from "../hooks/ConfigContext";
import type { HydratedForm } from "../hooks/useConfig";
import {
  getHealthTone,
  getModelHealthCells,
  getModelLatestCell,
  aggregateHealth,
  aggSpeed,
  formatSpeed,
  TONE_COLORS,
} from "./health";
import { validateModel, validateModelAdvanced, hasErrors } from "../utils/validation";

export const PROVIDERS = ["openai-chat", "openai-responses", "anthropic", "openai-image"];

const PROVIDER_LABEL: Record<string, string> = {
  "openai-chat": "OpenAI Chat",
  "openai-responses": "OpenAI Responses",
  "openai-image": "OpenAI Image",
  anthropic: "Anthropic",
};

export function providerLabel(p: string): string {
  return PROVIDER_LABEL[p] || p;
}

/** Count non-empty advanced extras fields for the badge. */
function advancedFieldCount(extras: Record<string, unknown>): number {
  return [
    extras.ttfb_timeout !== undefined && extras.ttfb_timeout !== null && extras.ttfb_timeout !== "",
    extras.proxy !== undefined && extras.proxy !== null && extras.proxy !== "",
    extras.image !== undefined && extras.image !== true,
    extras.ignore_invalid_history !== undefined && extras.ignore_invalid_history !== true,
    extras.headers && typeof extras.headers === "object" && Object.keys(extras.headers as object).length > 0,
    extras.body !== undefined && extras.body !== null && extras.body !== "",
    extras.bodyExpression !== undefined && extras.bodyExpression !== null && extras.bodyExpression !== "",
  ].filter(Boolean).length;
}

export interface BatchTestEntry {
  state: "testing" | "done";
  result?: TestModelResult;
}

interface ModelListItemProps {
  index: number;
  active: boolean;
  statusData: StatusData | null | undefined;
  batchResult?: BatchTestEntry;
  onClick: () => void;
}

/**
 * Compact list row for the models master column. Always computes validation
 * (so invalid / duplicate models surface a badge even without being opened).
 */
export default function ModelListItem({ index, active, statusData, batchResult, onClick }: ModelListItemProps) {
  const { t } = useT();
  const { form } = useConfigContext();
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
  const hasFieldErrors = hasErrors(fieldErrors);
  const hasAdvancedErrors = hasErrors(advancedErrors);
  const isDuplicate = fieldErrors.name === "validation.duplicateName";
  const advCount = advancedFieldCount(extras);

  const name = model.name?.trim() || t("models.unnamedModel", { index: index + 1 });
  const speedText = speed != null ? formatSpeed(speed) : t("models.noHealthDataShort");

  const batchTone: "green" | "red" | "amber" =
    batchResult?.state === "done"
      ? batchResult.result?.ok
        ? "green"
        : "red"
      : "amber";

  return (
    <button
      type="button"
      className="models-item"
      data-active={active}
      onClick={onClick}
    >
      <Flex justify="between" align="center" gap="2">
        <Flex align="center" gap="2" style={{ minWidth: 0 }}>
          <Tooltip
            content={
              latest
                ? t("models.successRate", { rate: latest.successRate.toFixed(1) })
                : t("models.noHealthData")
            }
          >
            <Box
              width="10px"
              height="10px"
              style={{
                borderRadius: "50%",
                backgroundColor: TONE_COLORS[tone],
                flexShrink: 0,
              }}
              className="app-status-dot"
              data-status={tone === "empty" ? "no-data" : "stable"}
            />
          </Tooltip>
          <Text as="div" size="2" weight="medium" className="app-truncate" style={{ minWidth: 0 }}>
            {name}
          </Text>
        </Flex>
        <Flex align="center" gap="1" style={{ flexShrink: 0 }}>
          {batchResult && (
            <Badge variant="soft" color={batchTone} size="1">
              {batchResult.state === "testing"
                ? "…"
                : batchResult.result?.ok
                  ? "✓"
                  : "✗"}
            </Badge>
          )}
          <Text size="1" color="gray">
            {speedText}
          </Text>
        </Flex>
      </Flex>

      <Flex gap="2" mt="2" align="center" wrap="wrap">
        <Badge variant="soft" color="gray" size="1">
          {providerLabel(model.provider)}
        </Badge>
        {model.model?.trim() && (
          <Text as="div" size="1" color="gray" className="app-truncate" style={{ minWidth: 0, maxWidth: "100%" }}>
            {model.model}
          </Text>
        )}
      </Flex>

      {(hasFieldErrors || isDuplicate || advCount > 0 || hasAdvancedErrors) && (
        <Flex gap="2" mt="2" align="center" wrap="wrap">
          {hasFieldErrors && !isDuplicate && (
            <Badge variant="soft" color="red" size="1">
              {t("models.errorBadge")}
            </Badge>
          )}
          {isDuplicate && (
            <Badge variant="soft" color="amber" size="1">
              {t("models.duplicateBadge")}
            </Badge>
          )}
          {advCount > 0 && (
            <Badge variant="soft" color="indigo" size="1">
              {t("models.advancedFields")} {advCount}
            </Badge>
          )}
        </Flex>
      )}
    </button>
  );
}

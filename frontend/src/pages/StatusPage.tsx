import { useState } from "react";
import { Card, Flex, Box, Heading, Text, Badge, SegmentedControl, Tooltip, Table } from "@radix-ui/themes";
import { useT } from "../i18n";
import { ThemeProvider, useAppearance } from "../theme/ThemeProvider";
import { I18nProvider } from "../i18n";
import { useStatusData } from "../hooks/useStatus";
import type { HealthCell, StatusData } from "../api";
import { getHealthTone, getModelHealthCells } from "../components/ModelCard";

const TONE_COLORS: Record<string, string> = {
  empty: "var(--gray-4)",
  green: "var(--green-9)",
  lightgreen: "var(--green-6)",
  orange: "var(--orange-9)",
  red: "var(--red-9)",
};

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

function CellTooltip({ cell, modelName, timeLabel }: { cell: HealthCell; modelName: string; timeLabel: string }) {
  const { t } = useT();
  return (
    <Flex direction="column" gap="1" style={{ minWidth: 180 }}>
      <Text weight="bold" size="1">
        {modelName} @ {timeLabel}
      </Text>
      <Box style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 8px", fontSize: 12 }}>
        <Text color="gray">{t("status.totalRequests")}</Text><Text align="right">{cell.totalRequests}</Text>
        <Text color="gray">{t("status.success")}</Text><Text align="right">{cell.successCount}</Text>
        <Text color="gray">{t("status.successRate")}</Text><Text align="right">{cell.successRate.toFixed(1)}%</Text>
        <Text color="gray">{t("status.avgTtfb")}</Text><Text align="right">{Math.round(cell.avgTtfbMs)}ms</Text>
        <Text color="gray">{t("status.avgDuration")}</Text><Text align="right">{Math.round(cell.avgDurationMs)}ms</Text>
        <Text color="gray">{t("status.input")}</Text><Text align="right">{formatTokenM(cell.nonCacheInputTokens)}</Text>
        <Text color="gray">{t("status.cache")}</Text><Text align="right">{formatTokenM(cell.cacheReadInputTokens)}</Text>
        <Text color="gray">{t("status.output")}</Text><Text align="right">{formatTokenM(cell.outputTokens)}</Text>
        <Text color="gray">{t("status.avgSpeed")}</Text><Text align="right">{formatSpeed(cell.totalStreamMs > 0 ? cell.outputTokens / (cell.totalStreamMs / 1000) : null)}</Text>
      </Box>
    </Flex>
  );
}

function StatusContent() {
  const { t, locale } = useT();
  const { data: statusData } = useStatusData();
  const { appearance, toggleAppearance } = useAppearance();
  const [range, setRange] = useState<string>("1h");

  const rangeMap: Record<string, number> = { "1h": 1, "3h": 3, "6h": 6 };
  const hours = rangeMap[range] || 1;
  const bucketCount = hours * 12;

  const models = statusData?.models || [];
  const fallbackGroups = statusData?.fallbackGroups || [];

  const totalledModelData = models.map((model) => {
    const allCells = model.series || [];
    const visible = allCells.slice(-bucketCount);
    const agg = visible.reduce(
      (a, c) => ({
        ni: a.ni + c.nonCacheInputTokens,
        cr: a.cr + c.cacheReadInputTokens,
        ot: a.ot + c.outputTokens,
        ts: a.ts + (c.totalStreamMs || 0),
      }),
      { ni: 0, cr: 0, ot: 0, ts: 0 },
    );
    return { model, visibleCells: visible, agg };
  });

  const totalAgg = totalledModelData.reduce(
    (a, { agg }) => ({ ni: a.ni + agg.ni, cr: a.cr + agg.cr, ot: a.ot + agg.ot }),
    { ni: 0, cr: 0, ot: 0 },
  );

  const timeLabels = Array.from({ length: bucketCount }, (_, i) => {
    const d = new Date(Date.now() - (bucketCount - 1 - i) * 5 * 60 * 1000);
    return d.toLocaleTimeString(locale === "en" ? "en-US" : "zh-CN", { hour: "2-digit", minute: "2-digit" });
  });

  return (
    <Box style={{ background: "var(--color-background)", minHeight: "100vh", padding: 16 }}>
      <Flex justify="end" mb="3">
        <SegmentedControl.Root value={range} onValueChange={setRange}>
          {["1h", "3h", "6h"].map((r) => (
            <SegmentedControl.Item key={r} value={r}>
              {r}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl.Root>
      </Flex>

      <Heading mb="2">{t("status.heading")}</Heading>

      <Flex gap="4" mb="3" wrap="wrap">
        <Text size="2">{t("status.input")} <Text weight="bold">{formatTokenM(totalAgg.ni)}</Text></Text>
        <Text size="2">{t("status.cache")} <Text weight="bold">{formatTokenM(totalAgg.cr)}</Text></Text>
        <Text size="2">{t("status.output")} <Text weight="bold">{formatTokenM(totalAgg.ot)}</Text></Text>
      </Flex>

      <Flex gap="3" mb="3" wrap="wrap">
        {[
          { label: "100%", color: "var(--green-9)" },
          { label: "80%+", color: "var(--green-6)" },
          { label: "50%+", color: "var(--orange-9)" },
          { label: "<50%", color: "var(--red-9)" },
          { label: t("status.noData"), color: "var(--gray-4)" },
        ].map((item) => (
          <Flex key={item.label} align="center" gap="1">
            <Box width="12px" height="12px" style={{ borderRadius: 3, backgroundColor: item.color, border: "1px solid rgba(0,0,0,0.08)" }} />
            <Text size="1">{item.label}</Text>
          </Flex>
        ))}
      </Flex>

      <Flex gap="4" style={{ overflowX: "auto" }} flexGrow="1">
        <Box flexGrow="1" minWidth="300px">
          <Table.Root size="1">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell width="220px">{t("status.modelsHeader")}</Table.ColumnHeaderCell>
                {timeLabels.map((label, i) => (
                  <Table.ColumnHeaderCell key={i} width="14px" style={{ padding: "2px 1px", fontSize: 9 }}>
                    {label}
                  </Table.ColumnHeaderCell>
                ))}
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {totalledModelData.map(({ model, visibleCells, agg }) => {
                const speed = agg.ts > 0 ? agg.ot / (agg.ts / 1000) : null;
                return (
                  <Table.Row key={model.name}>
                    <Table.Cell style={{ paddingRight: 8 }}>
                      <Text weight="bold">{model.name}</Text>
                      <Text size="1" color="gray" as="p">
                        {t("status.input")} {formatTokenM(agg.ni)} · {t("status.output")} {formatTokenM(agg.ot)} · {formatSpeed(speed)}
                      </Text>
                    </Table.Cell>
                    {visibleCells.map((cell, ci) => {
                      const tone = getHealthTone(cell);
                      return (
                        <Table.Cell key={ci} style={{ padding: "2px 1px" }}>
                          <Tooltip content={<CellTooltip cell={cell} modelName={model.name} timeLabel={timeLabels[ci] || ""} />}>
                            <button
                              style={{
                                borderRadius: 3,
                                backgroundColor: TONE_COLORS[tone],
                                border: "1px solid rgba(0,0,0,0.08)",
                                cursor: "pointer",
                                padding: 0,
                                width: 14,
                                height: 14,
                              }}
                            />
                          </Tooltip>
                        </Table.Cell>
                      );
                    })}
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </Box>

        <Box width="340px" flexShrink="0" style={{ position: "sticky", top: 0, alignSelf: "flex-start" }}>
          <Heading size="3" mb="3">{t("status.fallbackGroups")}</Heading>
          {fallbackGroups.length === 0 ? (
            <Text color="gray">{t("status.noFallbackGroups")}</Text>
          ) : (
            <Flex direction="column" gap="2">
              {fallbackGroups.map((g) => (
                <Card key={g.name} size="2">
                  <Text weight="bold">{g.name}</Text>
                  <Badge variant="soft" size="1" ml="2">
                    {g.members.length}{t("status.models")}
                  </Badge>
                  {g.members.map((m, i) => (
                    <Text key={i} size="1" color="gray" as="p">
                      {i + 1}. {m}
                    </Text>
                  ))}
                </Card>
              ))}
            </Flex>
          )}
        </Box>
      </Flex>
    </Box>
  );
}

export default function StatusPage() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <StatusContent />
      </I18nProvider>
    </ThemeProvider>
  );
}

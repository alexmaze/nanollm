import { useState } from "react";
import { Card, Flex, Box, Heading, Text, Badge, SegmentedControl, Tooltip, Table } from "@radix-ui/themes";
import { ActivityLogIcon } from "@radix-ui/react-icons";
import { useT } from "../i18n";
import { useStatusData } from "../hooks/useStatus";
import type { HealthCell } from "../api";
import { getHealthTone, formatTokenM, formatSpeed, formatPercent, cacheRatio, TONE_COLORS } from "../components/health";
import StatCard from "../components/StatCard";
import ErrorState from "../components/ErrorState";
import PageSkeleton from "../components/PageSkeleton";

function CellTooltip({ cell, modelName, timeLabel }: { cell: HealthCell; modelName: string; timeLabel: string }) {
  const { t } = useT();
  return (
    <Flex direction="column" gap="1" style={{ minWidth: 180 }}>
      <Text weight="bold" size="1">
        {modelName} @ {timeLabel}
      </Text>
      <Box style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 8px", fontSize: 12 }}>
        <Text color="gray">{t("status.totalRequests")}</Text>
        <Text align="right">{cell.totalRequests}</Text>
        <Text color="gray">{t("status.success")}</Text>
        <Text align="right">{cell.successCount}</Text>
        <Text color="gray">{t("status.successRate")}</Text>
        <Text align="right">{cell.successRate.toFixed(1)}%</Text>
        <Text color="gray">{t("status.avgTtfb")}</Text>
        <Text align="right">{Math.round(cell.avgTtfbMs)}ms</Text>
        <Text color="gray">{t("status.avgDuration")}</Text>
        <Text align="right">{Math.round(cell.avgDurationMs)}ms</Text>
        <Text color="gray">{t("status.input")}</Text>
        <Text align="right">{formatTokenM(cell.nonCacheInputTokens)}</Text>
        <Text color="gray">{t("status.cache")}</Text>
        <Text align="right">{formatTokenM(cell.cacheReadInputTokens)}</Text>
        <Text color="gray">{t("status.output")}</Text>
        <Text align="right">{formatTokenM(cell.outputTokens)}</Text>
        <Text color="gray">{t("status.avgSpeed")}</Text>
        <Text align="right">{formatSpeed(cell.totalStreamMs > 0 ? cell.outputTokens / (cell.totalStreamMs / 1000) : null)}</Text>
      </Box>
    </Flex>
  );
}

function StatusContent() {
  const { t, locale } = useT();
  const { data: statusData, error, isLoading, mutate } = useStatusData();
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
    <Flex direction="column" gap="5">
      <Flex justify="between" align="start" wrap="wrap" gap="4">
        <Box>
          <Heading size="6" weight="bold" style={{ letterSpacing: "-0.02em" }}>
              {t("status.heading")}
            </Heading>
            <Text size="2" color="gray" mt="1">
              {t("status.meta")}
            </Text>
          </Box>
          <SegmentedControl.Root value={range} onValueChange={setRange}>
            {["1h", "3h", "6h"].map((r) => (
              <SegmentedControl.Item key={r} value={r}>
                {r}
              </SegmentedControl.Item>
            ))}
          </SegmentedControl.Root>
        </Flex>

        {isLoading && !statusData ? (
          <PageSkeleton cards={3} />
        ) : error && !statusData ? (
          <ErrorState
            message={error instanceof Error ? error.message : t("common.loadFailed")}
            onRetry={() => mutate()}
          />
        ) : (
          <>
            <Flex gap="3" mb="5" wrap="wrap">
          <StatCard label={t("status.input")} value={formatTokenM(totalAgg.ni)} icon={<ActivityLogIcon />} color="blue" />
          <StatCard label={t("status.cache")} value={formatTokenM(totalAgg.cr)} icon={<ActivityLogIcon />} color="amber" />
          <StatCard label={t("status.output")} value={formatTokenM(totalAgg.ot)} icon={<ActivityLogIcon />} color="green" />
        </Flex>

        <Flex gap="3" mb="4" wrap="wrap">
          {[
            { label: "100%", color: "var(--green-9)" },
            { label: "80%+", color: "var(--green-6)" },
            { label: "50%+", color: "var(--orange-9)" },
            { label: "<50%", color: "var(--red-9)" },
            { label: t("status.noData"), color: "var(--gray-4)" },
          ].map((item) => (
            <Flex key={item.label} align="center" gap="1">
              <Box width="12px" height="12px" style={{ borderRadius: 4, backgroundColor: item.color, border: "1px solid rgba(0,0,0,0.08)" }} />
              <Text size="1">{item.label}</Text>
            </Flex>
          ))}
        </Flex>

        <Flex gap="5" style={{ overflowX: "auto" }} flexGrow="1" align="start">
          <Box flexGrow="1" minWidth="300px">
            <Card size="3">
              <Table.Root size="1">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell width="220px">{t("status.modelsHeader")}</Table.ColumnHeaderCell>
                    {timeLabels.map((label, i) => (
                      <Table.ColumnHeaderCell key={i} width="16px" style={{ padding: "2px 1px", fontSize: 9 }}>
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
                            {t("status.input")} {formatTokenM(agg.ni)} · {t("status.cache")} {formatTokenM(agg.cr)} ({formatPercent(cacheRatio(agg))}) · {t("status.output")} {formatTokenM(agg.ot)} · {formatSpeed(speed)}
                          </Text>
                        </Table.Cell>
                        {visibleCells.map((cell, ci) => {
                          const tone = getHealthTone(cell);
                          return (
                            <Table.Cell key={ci} style={{ padding: "2px 1px" }}>
                              <Tooltip content={<CellTooltip cell={cell} modelName={model.name} timeLabel={timeLabels[ci] || ""} />}>
                                <button
                                  className="health-cell-button"
                                  style={{
                                    width: 16,
                                    height: 16,
                                    backgroundColor: TONE_COLORS[tone],
                                  }}
                                  aria-label={`${model.name} ${timeLabels[ci] || ""} ${t("status.successRate")} ${cell.successRate.toFixed(1)}% ${t("status.totalRequests")} ${cell.totalRequests}`}
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
            </Card>
          </Box>

          <Box width="360px" flexShrink="0" style={{ position: "sticky", top: 0, alignSelf: "flex-start" }}>
            <Card size="3">
              <Heading size="3" mb="3">
                {t("status.fallbackGroups")}
              </Heading>
              {fallbackGroups.length === 0 ? (
                <Text color="gray">{t("status.noFallbackGroups")}</Text>
              ) : (
                <Flex direction="column" gap="2">
                  {fallbackGroups.map((g) => (
                    <Card key={g.name} size="2" variant="surface">
                      <Flex align="center" gap="2" mb="1">
                        <Text weight="bold">{g.name}</Text>
                        <Badge variant="soft" size="1">
                          {g.members.length}
                          {t("status.models")}
                        </Badge>
                      </Flex>
                      {g.members.map((m, i) => (
                        <Text key={i} size="1" color="gray" as="p">
                          {i + 1}. {m}
                        </Text>
                      ))}
                    </Card>
                  ))}
                </Flex>
              )}
            </Card>
          </Box>
        </Flex>
          </>
        )}
    </Flex>
  );
}

export default function StatusPage() {
  return <StatusContent />;
}

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, Flex, Box, Button, Heading, Text, TextField, Badge, Spinner, Table, Tooltip, IconButton } from "@radix-ui/themes";
import { ClockIcon, MagnifyingGlassIcon, ReloadIcon, PlayIcon, CopyIcon, CheckIcon } from "@radix-ui/react-icons";
import { useT } from "../i18n";
import { api, type RecordSummary, type RecordDetail, type RecentRecordItem } from "../api";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import JsonTree from "../components/JsonTree";
import StreamEvents from "../components/StreamEvents";

const SUMMARY_POLL_INTERVAL = 3000;
const RECENT_LIMIT = 10;
const REQUEST_ID_DATALIST = "req-id-opts";

function getSourceLabel(s: string | undefined, t: (k: string) => string): string {
  const map: Record<string, string> = {
    claudecode: "source.claudecode",
    codex: "source.codex",
    opencode: "source.opencode",
  };
  const key = s && map[s] ? map[s] : "source.other";
  return t(key);
}

function getStatusClass(item: RecentRecordItem): string {
  if (typeof item.responseStatus === "number") {
    return item.responseStatus >= 400 ? "failure" : item.responseStatus >= 200 && item.responseStatus < 300 ? "success" : "in_progress";
  }
  return item.status;
}

function getStatusColor(s: string): "green" | "red" | "blue" | "gray" {
  if (s === "success" || s === "status-code-success") return "green";
  if (s === "failure") return "red";
  if (s === "in_progress") return "blue";
  return "gray";
}

function getStatusText(item: RecentRecordItem, t: (k: string) => string): string {
  if (typeof item.responseStatus === "number") return String(item.responseStatus);
  if (item.status === "success") return t("recordDetail.statusSuccess");
  if (item.status === "failure") return t("recordDetail.statusFailure");
  return t("recordDetail.statusInProgress");
}

export default function RecordsPage() {
  const { t, locale } = useT();
  const [summary, setSummary] = useState<RecordSummary | null>(null);
  const [record, setRecord] = useState<RecordDetail | null>(null);
  const [requestId, setRequestId] = useState("");
  const [querying, setQuerying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentExpanded, setRecentExpanded] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [replayStatus, setReplayStatus] = useState<{ kind: "success" | "failure"; text: string } | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval>>(undefined);

  const fetchSummary = useCallback(async () => {
    try {
      const s = await api.fetchRecordSummary();
      setSummary(s);
      setSummaryError(null);
    } catch (e) {
      setSummaryError(e instanceof Error ? e.message : t("common.loadFailed"));
    }
  }, [t]);

  useEffect(() => {
    fetchSummary();
    pollTimer.current = setInterval(fetchSummary, SUMMARY_POLL_INTERVAL);
    return () => clearInterval(pollTimer.current);
  }, [fetchSummary]);

  const queryRecord = useCallback(
    async (id: string) => {
      if (!id) {
        setError(t("records.emptyRequestId"));
        return;
      }
      setQuerying(true);
      setError(null);
      setRecord(null);
      setReplayStatus(null);
      try {
        const result = await api.fetchRecord(id);
        if (result.summary) setSummary(result.summary);
        setRecord(result.record);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("records.queryFailed"));
      } finally {
        setQuerying(false);
      }
    },
    [t],
  );

  const replayRecord = useCallback(async () => {
    if (!record?.requestId) return;
    setReplaying(true);
    setReplayStatus(null);
    try {
      const result = await api.replayRecord(record.requestId);
      if (result.summary) setSummary(result.summary);
      if (result.error || !result.requestId) {
        setReplayStatus({ kind: "failure", text: result.error || t("records.replayFailed") });
        return;
      }
      setReplayStatus({ kind: "success", text: t("records.replayCreated", { requestId: result.requestId }) });
      setRequestId(result.requestId);
      await queryRecord(result.requestId);
    } catch (e) {
      setReplayStatus({ kind: "failure", text: e instanceof Error ? e.message : t("records.replayFailed") });
    } finally {
      setReplaying(false);
    }
  }, [record, t, queryRecord]);

  const recentItems = summary?.recentKeys || [];
  const visibleRecent = recentExpanded ? recentItems : recentItems.slice(0, RECENT_LIMIT);

  return (
    <Flex direction="column" gap="5">
      <PageHeader title={t("records.heading")} description={t("records.meta")}>
        <Button variant="ghost" onClick={fetchSummary}>
          <ReloadIcon />
          {t("common.refresh")}
        </Button>
      </PageHeader>

      <Card size="3">
        <Flex gap="3" align="end" wrap="wrap">
          <Box style={{ flex: 1, minWidth: 280 }}>
            <Text as="label" size="2" weight="medium" color="gray" mb="2">
              {t("records.labelRequestId")}
            </Text>
            <TextField.Root
              mt="2"
              placeholder={t("records.placeholder")}
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              list={REQUEST_ID_DATALIST}
              onKeyDown={(e) => {
                if (e.key === "Enter") queryRecord(requestId);
              }}
            >
              <TextField.Slot>
                <MagnifyingGlassIcon />
              </TextField.Slot>
            </TextField.Root>
            <datalist id={REQUEST_ID_DATALIST}>
              {recentItems.map((item) => (
                <option key={item.requestId} value={item.requestId}>
                  {item.key} · {item.path}
                </option>
              ))}
            </datalist>
          </Box>
          <Button size="3" onClick={() => queryRecord(requestId)} disabled={querying}>
            {querying ? <Spinner /> : null}
            {t("records.query")}
          </Button>
        </Flex>

        {summary && (
          <Flex gap="2" mt="4" wrap="wrap">
            <Badge color="green" variant="soft" size="2">
              {t("records.captured")}：{summary.capturedCount}
            </Badge>
            <Badge color="blue" variant="soft" size="2">
              {t("records.limit")}：{summary.limit}
            </Badge>
            <Badge variant="soft" size="2">
              {t("records.startedAt")}：
              {new Date(summary.sessionStartedAt ?? Date.now()).toLocaleString(locale === "en" ? "en-US" : "zh-CN")}
            </Badge>
          </Flex>
        )}

        {summaryError && (
          <Text size="1" color="red" mt="2" as="p">
            {t("records.summaryLoadError")}：{summaryError}
          </Text>
        )}
      </Card>

      {recentItems.length > 0 && (
        <Card size="3">
          <Heading size="3" mb="3">
            {t("records.recent")}
          </Heading>
          <Table.Root size="1" variant="ghost">
            <Table.Body>
              {visibleRecent.map((item) => (
                <Table.Row
                  key={item.requestId}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setRequestId(item.requestId);
                    queryRecord(item.requestId);
                  }}
                >
                  <Table.Cell>
                    <Text weight="medium">{item.key}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="1" color="gray">
                      {item.path}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="soft" size="1">
                      {getSourceLabel(item.source, t)}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="soft" color={getStatusColor(getStatusClass(item))} size="1">
                      {getStatusText(item, t)}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="1" color="gray">
                      {new Date(item.createdAt).toLocaleTimeString(locale === "en" ? "en-US" : "zh-CN")}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
          {recentItems.length > RECENT_LIMIT && (
            <Button variant="ghost" size="1" mt="2" onClick={() => setRecentExpanded((p) => !p)}>
              {recentExpanded ? t("common.collapse") : t("records.showMore", { count: recentItems.length - RECENT_LIMIT })}
            </Button>
          )}
        </Card>
      )}

      {error && (
        <Card size="2" style={{ backgroundColor: "var(--red-2)", borderColor: "var(--red-6)" }}>
          <Text color="red">{error}</Text>
        </Card>
      )}

      {!error && !record && (
        <EmptyState title={t("records.noRecords")} description={t("records.meta")} icon={<ClockIcon />} />
      )}

      {record && <RecordDetailView record={record} replaying={replaying} replayStatus={replayStatus} onReplay={replayRecord} />}
    </Flex>
  );
}

// --- Inline RecordDetail ---

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const { t } = useT();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card style={{ overflow: "hidden" }} asChild>
      <details open={open}>
        <summary
          style={{
            padding: "14px 16px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            listStyle: "none",
            fontWeight: 600,
            color: "var(--gray-12)",
            backgroundColor: "var(--gray-2)",
            borderBottom: open ? "1px solid var(--gray-5)" : "none",
          }}
          onClick={(e) => {
            e.preventDefault();
            setOpen(!open);
          }}
        >
          <span>{title}</span>
          <Text size="1" color="gray">
            {open ? t("common.collapse") : t("common.expand")}
          </Text>
        </summary>
        <Box px="4" py="4">
          {children}
        </Box>
      </details>
    </Card>
  );
}

function BodyBox({ title, value, streamText }: { title: string; value: unknown; streamText?: boolean }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);

  if (value == null || value === "") {
    return (
      <Box style={{ border: "1px solid var(--gray-5)", borderRadius: "var(--radius-3)", padding: 16, position: "relative", backgroundColor: "var(--gray-1)" }}>
        <Text weight="medium" size="2">
          {title}
        </Text>
        <Box mt="2">
          <Text color="gray">{t("common.empty")}</Text>
        </Box>
      </Box>
    );
  }

  const isStream = streamText === true && typeof value === "string";

  const copyText = () => {
    const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Box style={{ border: "1px solid var(--gray-5)", borderRadius: "var(--radius-3)", padding: 16, position: "relative", backgroundColor: "var(--gray-1)" }}>
      <Flex justify="between" align="center" mb="2">
        <Text weight="medium" size="2">
          {title}
        </Text>
        <IconButton variant="ghost" size="1" onClick={copyText}>
          {copied ? <CheckIcon /> : <CopyIcon />}
        </IconButton>
      </Flex>
      <Box>
        {isStream ? (
          <StreamEvents text={value as string} />
        ) : typeof value === "string" ? (
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, lineHeight: 1.6 }}>{value}</pre>
        ) : (
          <JsonTree value={value} />
        )}
      </Box>
    </Box>
  );
}

interface RecordDetailViewProps {
  record: RecordDetail;
  replaying: boolean;
  replayStatus: { kind: "success" | "failure"; text: string } | null;
  onReplay: () => void;
}

function RecordDetailView({ record, replaying, replayStatus, onReplay }: RecordDetailViewProps) {
  const { t, locale } = useT();

  return (
    <Flex direction="column" gap="3">
      {/* Basic Info */}
      <Card size="3">
        <Flex justify="between" align="start" wrap="wrap" gap="3" mb="3">
          <Heading size="3">{t("recordDetail.basicInfo")}</Heading>
          <Button onClick={onReplay} disabled={replaying} variant="soft" color="indigo">
            {replaying ? <Spinner /> : <PlayIcon />}
            {replaying ? t("records.replaying") : t("records.replay")}
          </Button>
        </Flex>

        <Box style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "8px 16px", fontSize: 14 }}>
          <Text color="gray">{t("recordDetail.labelRequestId")}</Text>
          <Text>{record.requestId}</Text>
          <Text color="gray">{t("recordDetail.labelKey")}</Text>
          <Text>{record.key}</Text>
          <Text color="gray">{t("recordDetail.labelPath")}</Text>
          <Text>{record.clientRequest?.path ?? "-"}</Text>
          <Text color="gray">{t("recordDetail.labelStream")}</Text>
          <Text>{String(record.stream)}</Text>
          <Text color="gray">{t("recordDetail.labelCreatedAt")}</Text>
          <Text>{record.createdAt ? new Date(record.createdAt).toLocaleString(locale === "en" ? "en-US" : "zh-CN") : "-"}</Text>
          <Text color="gray">{t("recordDetail.labelError")}</Text>
          <Text>{record.error?.message || "-"}</Text>
        </Box>

        {replayStatus && (
          <Text size="2" mt="3" color={replayStatus.kind === "success" ? "green" : "red"}>
            {replayStatus.text}
          </Text>
        )}
      </Card>

      {/* Client Request */}
      <Section title={t("recordDetail.clientRequest")}>
        <Flex direction="column" gap="3">
          <BodyBox title={t("recordDetail.labelHeaders")} value={record.clientRequest?.headers} />
          <BodyBox title={t("recordDetail.labelBody")} value={record.clientRequest?.body} streamText={record.stream} />
        </Flex>
      </Section>

      {/* Attempts */}
      <Card size="3">
        <Heading size="3" mb="3">
          {t("recordDetail.attempts")}
        </Heading>
        {!record.attempts?.length ? (
          <Text color="gray" as="p">
            {t("records.noAttempts")}
          </Text>
        ) : (
          <Flex direction="column" gap="3">
            {record.attempts.map((att) => (
              <Box key={att.index} style={{ border: "1px solid var(--gray-5)", borderRadius: "var(--radius-3)", padding: 16, backgroundColor: "var(--gray-1)" }}>
                <Flex justify="between" align="center" wrap="wrap" mb="3">
                  <Text weight="bold">
                    #{att.index} {att.modelName} ({att.provider})
                  </Text>
                </Flex>
                <Box style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "8px 16px", fontSize: 13 }}>
                  <Text color="gray">{t("recordDetail.labelUrl")}</Text>
                  <Text style={{ wordBreak: "break-all" }}>{att.url}</Text>
                  <Text color="gray">{t("recordDetail.labelStatus")}</Text>
                  <Text>{att.response?.status || "-"}</Text>
                  <Text color="gray">{t("recordDetail.labelError")}</Text>
                  <Text>{att.error?.message || "-"}</Text>
                </Box>

                <Box mt="3">
                  <Section title={t("recordDetail.upstreamRequest")}>
                    <Flex direction="column" gap="2">
                      <BodyBox title={t("recordDetail.labelHeaders")} value={att.request?.headers} />
                      <BodyBox title={t("recordDetail.labelBody")} value={att.request?.body} />
                    </Flex>
                  </Section>
                </Box>

                <Box mt="3">
                  <Section title={t("recordDetail.upstreamResponse")}>
                    <Flex direction="column" gap="2">
                      <BodyBox title={t("recordDetail.labelHeaders")} value={att.response?.headers} />
                      <BodyBox title={t("recordDetail.labelBody")} value={att.response?.body} streamText={record.stream} />
                      {att.error?.upstream !== undefined && <BodyBox title={t("recordDetail.upstreamErrorBody")} value={att.error.upstream} />}
                    </Flex>
                  </Section>
                </Box>
              </Box>
            ))}
          </Flex>
        )}
      </Card>

      {/* Client Response */}
      <Section title={t("recordDetail.clientResponse")} defaultOpen>
        <Box style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "8px 16px", fontSize: 14 }}>
          <Text color="gray">{t("recordDetail.labelStatus")}</Text>
          <Text>{record.clientResponse?.status ?? "-"}</Text>
          <Text color="gray">{t("recordDetail.labelTruncated")}</Text>
          <Text>{record.clientResponse?.truncated ? t("common.yes") : t("common.no")}</Text>
        </Box>
        <Flex direction="column" gap="3" mt="3">
          <BodyBox title={t("recordDetail.labelHeaders")} value={record.clientResponse?.headers} />
          <BodyBox title={t("recordDetail.labelBody")} value={record.clientResponse?.body} streamText={record.stream} />
        </Flex>
      </Section>
    </Flex>
  );
}

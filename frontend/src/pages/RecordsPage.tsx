import { useState, useEffect, useCallback, useRef } from "react";
import { Card, Flex, Box, Button, Heading, Text, TextField, Badge, Spinner } from "@radix-ui/themes";
import { useT } from "../i18n";
import { api, type RecordSummary, type RecordDetail, type RecentRecordItem } from "../api";
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
  const pollTimer = useRef<ReturnType<typeof setInterval>>(undefined);

  const fetchSummary = useCallback(async () => {
    try {
      const s = await api.fetchRecordSummary();
      setSummary(s);
    } catch {}
  }, []);

  useEffect(() => {
    fetchSummary();
    pollTimer.current = setInterval(fetchSummary, SUMMARY_POLL_INTERVAL);
    return () => clearInterval(pollTimer.current);
  }, [fetchSummary]);

  const queryRecord = useCallback(async (id: string) => {
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
  }, [t]);

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
    <Flex direction="column" gap="4">
      <Card>
        <Heading>{t("records.heading")}</Heading>
        <Text color="gray" mb="3" as="p">
          {t("records.meta")}
        </Text>

        <Flex gap="2">
          <TextField.Root
            style={{ flex: 1 }}
            placeholder={t("records.placeholder")}
            value={requestId}
            onChange={(e) => setRequestId(e.target.value)}
            list={REQUEST_ID_DATALIST}
            onKeyDown={(e) => { if (e.key === "Enter") queryRecord(requestId); }}
          />
          <datalist id={REQUEST_ID_DATALIST}>
            {recentItems.map((item) => (
              <option key={item.requestId} value={item.requestId}>
                {item.key} · {item.path}
              </option>
            ))}
          </datalist>
          <Button onClick={() => queryRecord(requestId)} disabled={querying}>
            {querying ? <Spinner /> : null}
            {t("records.query")}
          </Button>
        </Flex>

        {summary && (
          <Flex gap="2" mt="3" wrap="wrap">
            <Badge color="green">{t("records.captured")}：{summary.capturedCount}</Badge>
            <Badge color="blue">{t("records.limit")}：{summary.limit}</Badge>
            <Badge>{t("records.startedAt")}：{new Date(summary.sessionStartedAt ?? Date.now()).toLocaleString(locale === "en" ? "en-US" : "zh-CN")}</Badge>
          </Flex>
        )}

        {recentItems.length > 0 && (
          <Flex gap="2" mt="2" wrap="wrap">
            {visibleRecent.map((item) => (
              <Button
                key={item.requestId}
                variant="soft"
                size="1"
                onClick={() => {
                  setRequestId(item.requestId);
                  queryRecord(item.requestId);
                }}
                style={{ textAlign: "left", height: "auto", padding: "6px 10px" }}
              >
                <Flex direction="column" align="start" gap="1">
                  <Flex align="center" gap="1">
                    <Text size="1" weight="bold" truncate style={{ maxWidth: 160 }}>
                      {item.key}
                    </Text>
                    <Badge variant="soft" size="1">
                      {getSourceLabel(item.source, t)}
                    </Badge>
                    <Badge variant="soft" color={getStatusColor(getStatusClass(item))} size="1">
                      {getStatusText(item, t)}
                    </Badge>
                  </Flex>
                  <Text size="1" color="gray">
                    {item.path} · {new Date(item.createdAt).toLocaleTimeString(locale === "en" ? "en-US" : "zh-CN")}
                  </Text>
                </Flex>
              </Button>
            ))}
            {!recentExpanded && recentItems.length > RECENT_LIMIT && (
              <Button variant="ghost" size="1" onClick={() => setRecentExpanded(true)}>
                ...
              </Button>
            )}
            {recentExpanded && recentItems.length > RECENT_LIMIT && (
              <Button variant="ghost" size="1" onClick={() => setRecentExpanded(false)}>
                &lt;
              </Button>
            )}
          </Flex>
        )}
      </Card>

      {error && (
        <Card>
          <Text color="red">{error}</Text>
        </Card>
      )}

      {!error && !record && (
        <Card>
          <Text color="gray">{t("records.noRecords")}</Text>
        </Card>
      )}

      {record && (
        <RecordDetailView
          record={record}
          replaying={replaying}
          replayStatus={replayStatus}
          onReplay={replayRecord}
        />
      )}
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
          style={{ padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, listStyle: "none", fontWeight: 700, color: "var(--accent-9)" }}
          onClick={(e) => { e.preventDefault(); setOpen(!open); }}
        >
          <span>{title}</span>
          <Text size="1">{open ? t("common.collapse") : t("common.expand")}</Text>
        </summary>
        <Box px="3" pb="3">
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
      <Box style={{ border: "1px solid var(--gray-4)", borderRadius: "var(--radius-3)", padding: 12, position: "relative" }}>
        <Text weight="bold" size="2">{title}</Text>
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
    <Box style={{ border: "1px solid var(--gray-4)", borderRadius: "var(--radius-3)", padding: 12, position: "relative" }}>
      <Text weight="bold" size="2">{title}</Text>
      <Button
        variant="ghost"
        size="1"
        onClick={copyText}
        style={{ position: "absolute", top: 8, right: 8 }}
      >
        {copied ? t("common.copied") : t("common.copyText")}
      </Button>
      <Box mt="2">
        {isStream ? (
          <StreamEvents text={value as string} />
        ) : typeof value === "string" ? (
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, lineHeight: 1.5 }}>{value}</pre>
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
      <Card>
        <Heading size="3">{t("recordDetail.basicInfo")}</Heading>
        <Box style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: "6px 12px", marginTop: 12, fontSize: 14 }}>
          <Text color="gray">{t("recordDetail.labelRequestId")}</Text><Text>{record.requestId}</Text>
          <Text color="gray">{t("recordDetail.labelKey")}</Text><Text>{record.key}</Text>
          <Text color="gray">{t("recordDetail.labelPath")}</Text><Text>{record.clientRequest?.path ?? "-"}</Text>
          <Text color="gray">{t("recordDetail.labelStream")}</Text><Text>{String(record.stream)}</Text>
          <Text color="gray">{t("recordDetail.labelCreatedAt")}</Text><Text>{record.createdAt ? new Date(record.createdAt).toLocaleString(locale === "en" ? "en-US" : "zh-CN") : "-"}</Text>
          <Text color="gray">{t("recordDetail.labelError")}</Text><Text>{record.error?.message || "-"}</Text>
        </Box>
        <Flex gap="2" mt="3" align="center" wrap="wrap">
          <Button onClick={onReplay} disabled={replaying}>
            {replaying ? <Spinner /> : null}
            {replaying ? t("records.replaying") : t("records.replay")}
          </Button>
          <Text size="1" color="gray">{t("records.replayNote")}</Text>
          {replayStatus && (
            <Text size="1" color={replayStatus.kind === "success" ? "green" : "red"}>
              {replayStatus.text}
            </Text>
          )}
        </Flex>
      </Card>

      {/* Client Request */}
      <Section title={t("recordDetail.clientRequest")}>
        <Flex direction="column" gap="3">
          <BodyBox title={t("recordDetail.labelHeaders")} value={record.clientRequest?.headers} />
          <BodyBox title={t("recordDetail.labelBody")} value={record.clientRequest?.body} streamText={record.stream} />
        </Flex>
      </Section>

      {/* Attempts */}
      <Card>
        <Heading size="3">{t("recordDetail.attempts")}</Heading>
        {!record.attempts?.length ? (
          <Text color="gray" mt="2" as="p">{t("records.noAttempts")}</Text>
        ) : (
          <Flex direction="column" gap="3" mt="2">
            {record.attempts.map((att) => (
              <Box key={att.index} style={{ border: "1px solid var(--gray-4)", borderRadius: "var(--radius-3)", padding: 14 }}>
                <Flex justify="between" align="center" wrap="wrap" mb="2">
                  <Text weight="bold">
                    #{att.index} {att.modelName} ({att.provider})
                  </Text>
                </Flex>
                <Box style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: "6px 12px", fontSize: 13 }}>
                  <Text color="gray">{t("recordDetail.labelUrl")}</Text><Text style={{ wordBreak: "break-all" }}>{att.url}</Text>
                  <Text color="gray">{t("recordDetail.labelStatus")}</Text><Text>{att.response?.status || "-"}</Text>
                  <Text color="gray">{t("recordDetail.labelError")}</Text><Text>{att.error?.message || "-"}</Text>
                </Box>

                <Section title={t("recordDetail.upstreamRequest")}>
                  <Flex direction="column" gap="2">
                    <BodyBox title={t("recordDetail.labelHeaders")} value={att.request?.headers} />
                    <BodyBox title={t("recordDetail.labelBody")} value={att.request?.body} />
                  </Flex>
                </Section>

                <Section title={t("recordDetail.upstreamResponse")}>
                  <Flex direction="column" gap="2">
                    <BodyBox title={t("recordDetail.labelHeaders")} value={att.response?.headers} />
                    <BodyBox title={t("recordDetail.labelBody")} value={att.response?.body} streamText={record.stream} />
                    {att.error?.upstream !== undefined && (
                      <BodyBox title={t("recordDetail.upstreamErrorBody")} value={att.error.upstream} />
                    )}
                  </Flex>
                </Section>
              </Box>
            ))}
          </Flex>
        )}
      </Card>

      {/* Client Response */}
      <Section title={t("recordDetail.clientResponse")}>
        <Box style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: "6px 12px", fontSize: 14 }}>
          <Text color="gray">{t("recordDetail.labelStatus")}</Text><Text>{record.clientResponse?.status ?? "-"}</Text>
          <Text color="gray">{t("recordDetail.labelTruncated")}</Text><Text>{record.clientResponse?.truncated ? t("common.yes") : t("common.no")}</Text>
        </Box>
        <Flex direction="column" gap="3" mt="3">
          <BodyBox title={t("recordDetail.labelHeaders")} value={record.clientResponse?.headers} />
          <BodyBox title={t("recordDetail.labelBody")} value={record.clientResponse?.body} streamText={record.stream} />
        </Flex>
      </Section>
    </Flex>
  );
}

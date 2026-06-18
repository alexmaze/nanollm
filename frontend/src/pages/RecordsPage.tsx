import { useState, useEffect, useCallback, useRef, useMemo, Fragment, type ReactNode } from "react";
import { Card, Flex, Box, Button, Heading, Text, TextField, Badge, Spinner, Tooltip, IconButton, Tabs } from "@radix-ui/themes";
import { ClockIcon, MagnifyingGlassIcon, ReloadIcon, PlayIcon, CopyIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, ArrowLeftIcon } from "@radix-ui/react-icons";
import { useT } from "../i18n";
import { api, type RecordSummary, type RecordDetail, type RecordAttempt, type RecentRecordItem } from "../api";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import ReadonlyEditor from "../components/ReadonlyEditor";
import StreamEvents from "../components/StreamEvents";

const SUMMARY_POLL_INTERVAL = 3000;
const RECENT_LIMIT = 10;

function getSourceLabel(s: string | undefined, t: (k: string) => string): string {
  const map: Record<string, string> = {
    claudecode: "source.claudecode",
    codex: "source.codex",
    opencode: "source.opencode",
    playground: "source.playground",
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

function getStatusDotColor(s: string): string {
  const c = getStatusColor(s);
  return c === "green" ? "var(--green-9)" : c === "red" ? "var(--red-9)" : c === "blue" ? "var(--blue-9)" : "var(--gray-8)";
}

function getStatusText(item: RecentRecordItem, t: (k: string) => string): string {
  if (typeof item.responseStatus === "number") return String(item.responseStatus);
  if (item.status === "success") return t("recordDetail.statusSuccess");
  if (item.status === "failure") return t("recordDetail.statusFailure");
  return t("recordDetail.statusInProgress");
}

function getDetailStatus(record: RecordDetail, t: (k: string) => string): { color: "green" | "red" | "blue" | "gray"; text: string } {
  if (record.error?.message) return { color: "red", text: t("recordDetail.statusFailure") };
  const s = record.clientResponse?.status;
  if (typeof s === "number") {
    if (s >= 400) return { color: "red", text: String(s) };
    if (s >= 200 && s < 300) return { color: "green", text: String(s) };
    return { color: "blue", text: String(s) };
  }
  return { color: "gray", text: t("recordDetail.statusInProgress") };
}

function attemptStatusColor(att: RecordAttempt): "green" | "red" | "blue" | "gray" {
  if (att.error?.message) return "red";
  const s = att.response?.status;
  if (typeof s === "number") {
    if (s >= 400) return "red";
    if (s >= 200 && s < 300) return "green";
    return "blue";
  }
  return "gray";
}

export default function RecordsPage() {
  const { t, locale } = useT();
  const [summary, setSummary] = useState<RecordSummary | null>(null);
  const [record, setRecord] = useState<RecordDetail | null>(null);
  const [search, setSearch] = useState("");
  const [querying, setQuerying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentExpanded, setRecentExpanded] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [replayStatus, setReplayStatus] = useState<{ kind: "success" | "failure"; text: string } | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
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
      setMobileView("detail");
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
      await queryRecord(result.requestId);
    } catch (e) {
      setReplayStatus({ kind: "failure", text: e instanceof Error ? e.message : t("records.replayFailed") });
    } finally {
      setReplaying(false);
    }
  }, [record, t, queryRecord]);

  const selectItem = useCallback(
    (item: RecentRecordItem) => {
      queryRecord(item.requestId);
    },
    [queryRecord],
  );

  const recentItems = summary?.recentKeys || [];

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recentItems;
    return recentItems.filter(
      (it) =>
        it.requestId.toLowerCase().includes(q) ||
        it.key.toLowerCase().includes(q) ||
        it.path.toLowerCase().includes(q),
    );
  }, [recentItems, search]);

  const isFiltering = search.trim().length > 0;
  const visibleItems = isFiltering ? filteredItems : recentExpanded ? recentItems : recentItems.slice(0, RECENT_LIMIT);

  const localeTag = locale === "en" ? "en-US" : "zh-CN";
  const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString(localeTag);
  const fmtDateTime = (ts: number) => new Date(ts).toLocaleString(localeTag);

  const emptyTitle = recentItems.length === 0 ? t("records.noRecords") : t("records.selectHint");

  return (
    <Flex direction="column" gap="5">
      <PageHeader title={t("records.heading")} description={t("records.meta")} />

      <div className="records-split">
        {/* ---- Left: list ---- */}
        <Box className="records-list-col" data-hidden={mobileView === "detail" ? "true" : "false"}>
          <Card size="3">
            <Flex justify="between" align="center" mb="3">
              <Heading size="3">{t("records.recent")}</Heading>
              <Tooltip content={t("common.refresh")}>
                <IconButton variant="ghost" size="2" onClick={fetchSummary}>
                  <ReloadIcon />
                </IconButton>
              </Tooltip>
            </Flex>

            <TextField.Root
              placeholder={t("records.placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") queryRecord(search.trim());
              }}
            >
              <TextField.Slot>
                {querying ? <Spinner size="1" /> : <MagnifyingGlassIcon />}
              </TextField.Slot>
            </TextField.Root>

            {summary && (
              <Text size="1" color="gray" mt="2" as="p">
                {t("records.captured")} {summary.capturedCount} / {t("records.limit")} {summary.limit} · {t("records.startedAt")}{" "}
                {new Date(summary.sessionStartedAt ?? Date.now()).toLocaleString(localeTag)}
              </Text>
            )}

            {summaryError && (
              <Text size="1" color="red" mt="2" as="p">
                {t("records.summaryLoadError")}：{summaryError}
              </Text>
            )}

            <Box mt="3" className="records-list-scroll">
              {visibleItems.length === 0 ? (
                <Box py="4" style={{ textAlign: "center" }}>
                  <Text color="gray" size="2">
                    {recentItems.length === 0 ? t("records.noRecords") : t("records.noMatch")}
                  </Text>
                </Box>
              ) : (
                <Flex direction="column" gap="1">
                  {visibleItems.map((item) => (
                    <RecordListItem
                      key={item.requestId}
                      item={item}
                      active={record?.requestId === item.requestId}
                      onClick={() => selectItem(item)}
                      fmtTime={fmtTime}
                    />
                  ))}
                </Flex>
              )}
            </Box>

            {!isFiltering && recentItems.length > RECENT_LIMIT && (
              <Button variant="ghost" size="1" mt="2" onClick={() => setRecentExpanded((p) => !p)}>
                {recentExpanded ? t("common.collapse") : t("records.showMore", { count: recentItems.length - RECENT_LIMIT })}
              </Button>
            )}
          </Card>
        </Box>

        {/* ---- Right: detail ---- */}
        <Box className="records-detail-col" data-hidden={mobileView === "detail" ? "false" : "true"}>
          <Button variant="ghost" size="1" mb="3" className="records-back-btn" onClick={() => setMobileView("list")}>
            <ArrowLeftIcon />
            {t("records.backToList")}
          </Button>

          {querying && !record && (
            <Card size="3">
              <Flex align="center" justify="center" py="6">
                <Spinner size="3" />
              </Flex>
            </Card>
          )}

          {!querying && !record && !error && (
            <EmptyState title={emptyTitle} description={t("records.meta")} icon={<ClockIcon />} />
          )}

          {error && (
            <Card size="2" style={{ backgroundColor: "var(--red-2)", borderColor: "var(--red-6)" }}>
              <Text color="red">{error}</Text>
            </Card>
          )}

          {record && (
            <RecordDetailView
              record={record}
              replaying={replaying}
              replayStatus={replayStatus}
              onReplay={replayRecord}
              fmtDateTime={fmtDateTime}
            />
          )}
        </Box>
      </div>
    </Flex>
  );
}

// --- List item ---

interface RecordListItemProps {
  item: RecentRecordItem;
  active: boolean;
  onClick: () => void;
  fmtTime: (ts: number) => string;
}

function RecordListItem({ item, active, onClick, fmtTime }: RecordListItemProps) {
  const { t } = useT();
  const cls = getStatusClass(item);
  const color = getStatusColor(cls);
  return (
    <button type="button" className="records-item" data-active={active} onClick={onClick}>
      <Flex justify="between" align="center" gap="2">
        <Text as="div" size="2" weight="medium" className="app-truncate" style={{ minWidth: 0 }}>
          {item.key}
        </Text>
        <Flex align="center" gap="1" style={{ flexShrink: 0 }}>
          <Box style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: getStatusDotColor(cls), flexShrink: 0 }} />
          <Text size="1" color="gray">
            {fmtTime(item.createdAt)}
          </Text>
        </Flex>
      </Flex>
      <Text as="div" size="1" color="gray" className="app-truncate" style={{ marginTop: 2 }}>
        {item.path}
      </Text>
      <Flex gap="2" mt="2" align="center" wrap="wrap">
        <Badge variant="soft" size="1">
          {getSourceLabel(item.source, t)}
        </Badge>
        <Badge variant="soft" color={color} size="1">
          {getStatusText(item, t)}
        </Badge>
      </Flex>
    </button>
  );
}

// --- Shared bits ---

function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const onClick = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <Tooltip content={copied ? t("common.copied") : (label ?? t("common.copyText"))}>
      <IconButton variant="ghost" size="1" onClick={onClick}>
        {copied ? <CheckIcon /> : <CopyIcon />}
      </IconButton>
    </Tooltip>
  );
}

function InfoGrid({ rows }: { rows: Array<{ label: string; value: ReactNode }> }) {
  return (
    <Box style={{ display: "grid", gridTemplateColumns: "max-content minmax(0, 1fr)", gap: "6px 14px", fontSize: 13 }}>
      {rows.map((r, i) => (
        <Fragment key={i}>
          <Text color="gray" size="2">
            {r.label}
          </Text>
          <Text size="2" style={{ wordBreak: "break-word" }}>
            {r.value}
          </Text>
        </Fragment>
      ))}
    </Box>
  );
}

/** Card-style collapsible with a chevron. */
function Section({ title, children, defaultOpen = false, badge }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean; badge?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card style={{ overflow: "hidden", padding: 0 }}>
      <Flex
        align="center"
        justify="between"
        gap="3"
        px="4"
        py="3"
        style={{ cursor: "pointer", backgroundColor: "var(--gray-2)", borderBottom: open ? "1px solid var(--gray-4)" : "none" }}
        onClick={() => setOpen((o) => !o)}
      >
        <Flex align="center" gap="2" style={{ minWidth: 0 }}>
          {open ? <ChevronDownIcon /> : <ChevronRightIcon />}
          <Box className="app-truncate" style={{ minWidth: 0, fontWeight: 600, fontSize: 14 }}>
            {title}
          </Box>
        </Flex>
        {badge && <Box style={{ flexShrink: 0 }}>{badge}</Box>}
      </Flex>
      {open && <Box px="4" py="4">{children}</Box>}
    </Card>
  );
}

/** Lightweight inline collapsible (no card chrome) — used inside attempts. */
function SubSection({ title, children, defaultOpen = true }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Box>
      <Flex align="center" gap="2" py="1" style={{ cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronDownIcon width="14" height="14" /> : <ChevronRightIcon width="14" height="14" />}
        <Text size="1" weight="bold" color="gray">
          {title}
        </Text>
      </Flex>
      {open && <Box mt="1">{children}</Box>}
    </Box>
  );
}

function detectLanguage(text: string): "json" | "plaintext" {
  const t = text.trim();
  if (!t) return "plaintext";
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      JSON.parse(t);
      return "json";
    } catch {}
  }
  return "plaintext";
}

function BodyBox({ title, value, streamText }: { title: string; value: unknown; streamText?: boolean }) {
  const { t } = useT();

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

  let text: string;
  let language: "json" | "plaintext";
  if (typeof value === "string") {
    language = detectLanguage(value);
    if (language === "json") {
      try {
        text = JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        text = value;
      }
    } else {
      text = value;
    }
  } else {
    text = JSON.stringify(value, null, 2);
    language = "json";
  }

  return (
    <Box style={{ border: "1px solid var(--gray-5)", borderRadius: "var(--radius-3)", padding: 16, position: "relative", backgroundColor: "var(--gray-1)" }}>
      <Flex justify="between" align="center" mb="2">
        <Text weight="medium" size="2">
          {title}
        </Text>
        <CopyButton text={text} />
      </Flex>
      <Box>
        {isStream ? (
          <StreamEvents text={value as string} />
        ) : (
          <ReadonlyEditor value={text} language={language} />
        )}
      </Box>
    </Box>
  );
}

// --- Detail view ---

interface RecordDetailViewProps {
  record: RecordDetail;
  replaying: boolean;
  replayStatus: { kind: "success" | "failure"; text: string } | null;
  onReplay: () => void;
  fmtDateTime: (ts: number) => string;
}

function RecordDetailView({ record, replaying, replayStatus, onReplay, fmtDateTime }: RecordDetailViewProps) {
  const { t } = useT();
  const [tab, setTab] = useState("overview");
  const status = getDetailStatus(record, t);
  const attempts = record.attempts ?? [];
  const createdAt = record.createdAt ? fmtDateTime(record.createdAt) : "-";

  return (
    <Flex direction="column" gap="3">
      {/* Sticky header */}
      <Card size="3" className="records-sticky-head">
        <Flex justify="between" align="start" gap="3" wrap="wrap">
          <Box style={{ minWidth: 0, flex: "1 1 260px" }}>
            <Flex align="center" gap="2" wrap="wrap">
              <Text size="1" color="gray">
                {t("recordDetail.labelRequestId")}
              </Text>
              <Text
                as="div"
                size="2"
                weight="bold"
                className="app-truncate"
                style={{ minWidth: 0, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
              >
                {record.requestId}
              </Text>
              <Box style={{ flexShrink: 0 }}>
                <CopyButton text={record.requestId} label={t("records.copyId")} />
              </Box>
            </Flex>
            <Flex gap="2" mt="2" align="center" wrap="wrap">
              <Badge variant="soft">{record.key}</Badge>
              <Badge variant="soft" color={status.color} size="1">
                {status.text}
              </Badge>
              <Text size="1" color="gray">
                {createdAt}
              </Text>
            </Flex>
          </Box>

          <Tooltip content={t("records.replayNote")}>
            <Button onClick={onReplay} disabled={replaying} variant="soft" color="indigo">
              {replaying ? <Spinner /> : <PlayIcon />}
              {replaying ? t("records.replaying") : t("records.replay")}
            </Button>
          </Tooltip>
        </Flex>

        {replayStatus && (
          <Text size="2" mt="3" color={replayStatus.kind === "success" ? "green" : "red"} as="p">
            {replayStatus.text}
          </Text>
        )}
      </Card>

      {/* Tabs */}
      <Card size="3">
        <Tabs.Root value={tab} onValueChange={setTab}>
          <Tabs.List>
            <Tabs.Trigger value="overview">{t("records.tabOverview")}</Tabs.Trigger>
            <Tabs.Trigger value="clientReq">{t("recordDetail.clientRequest")}</Tabs.Trigger>
            <Tabs.Trigger value="attempts">
              {t("recordDetail.attempts")}
              {attempts.length > 0 && (
                <Badge variant="soft" size="1" ml="2">
                  {attempts.length}
                </Badge>
              )}
            </Tabs.Trigger>
            <Tabs.Trigger value="clientResp">{t("recordDetail.clientResponse")}</Tabs.Trigger>
          </Tabs.List>

          <Box pt="4">
            {/* Overview */}
            <Tabs.Content value="overview">
              <InfoGrid
                rows={[
                  { label: t("recordDetail.labelRequestId"), value: record.requestId },
                  { label: t("recordDetail.labelKey"), value: record.key },
                  { label: t("recordDetail.labelPath"), value: record.clientRequest?.path ?? "-" },
                  { label: t("recordDetail.labelStream"), value: record.stream ? t("common.yes") : t("common.no") },
                  { label: t("recordDetail.labelCreatedAt"), value: createdAt },
                  {
                    label: t("recordDetail.labelError"),
                    value: record.error?.message ? <Text color="red">{record.error.message}</Text> : "-",
                  },
                ]}
              />
            </Tabs.Content>

            {/* Client Request */}
            <Tabs.Content value="clientReq">
              <Flex direction="column" gap="3">
                <BodyBox title={t("recordDetail.labelHeaders")} value={record.clientRequest?.headers} />
                <BodyBox title={t("recordDetail.labelBody")} value={record.clientRequest?.body} streamText={record.stream} />
              </Flex>
            </Tabs.Content>

            {/* Attempts */}
            <Tabs.Content value="attempts">
              {attempts.length === 0 ? (
                <Text color="gray" as="p">
                  {t("records.noAttempts")}
                </Text>
              ) : (
                <Flex direction="column" gap="3">
                  {attempts.map((att, i) => (
                    <Section
                      key={att.index}
                      title={`#${att.index} ${att.modelName} (${att.provider})`}
                      defaultOpen={i === 0}
                      badge={
                        <Badge variant="soft" color={attemptStatusColor(att)} size="1">
                          {att.response?.status ?? "—"}
                        </Badge>
                      }
                    >
                      <InfoGrid
                        rows={[
                          { label: t("recordDetail.labelUrl"), value: att.url },
                          { label: t("recordDetail.labelStatus"), value: att.response?.status ?? "-" },
                          {
                            label: t("recordDetail.labelError"),
                            value: att.error?.message ? <Text color="red">{att.error.message}</Text> : "-",
                          },
                        ]}
                      />
                      <Box mt="3">
                        <SubSection title={t("recordDetail.upstreamRequest")}>
                          <Flex direction="column" gap="2">
                            <BodyBox title={t("recordDetail.labelHeaders")} value={att.request?.headers} />
                            <BodyBox title={t("recordDetail.labelBody")} value={att.request?.body} />
                          </Flex>
                        </SubSection>
                        <SubSection title={t("recordDetail.upstreamResponse")}>
                          <Flex direction="column" gap="2">
                            <BodyBox title={t("recordDetail.labelHeaders")} value={att.response?.headers} />
                            <BodyBox title={t("recordDetail.labelBody")} value={att.response?.body} streamText={record.stream} />
                            {att.error?.upstream !== undefined && (
                              <BodyBox title={t("recordDetail.upstreamErrorBody")} value={att.error.upstream} />
                            )}
                          </Flex>
                        </SubSection>
                      </Box>
                    </Section>
                  ))}
                </Flex>
              )}
            </Tabs.Content>

            {/* Client Response */}
            <Tabs.Content value="clientResp">
              <Flex direction="column" gap="3">
                <Card size="2" style={{ backgroundColor: "var(--gray-2)" }}>
                  <InfoGrid
                    rows={[
                      { label: t("recordDetail.labelStatus"), value: record.clientResponse?.status ?? "-" },
                      {
                        label: t("recordDetail.labelTruncated"),
                        value: record.clientResponse?.truncated ? t("common.yes") : t("common.no"),
                      },
                    ]}
                  />
                </Card>
                <BodyBox title={t("recordDetail.labelHeaders")} value={record.clientResponse?.headers} />
                <BodyBox title={t("recordDetail.labelBody")} value={record.clientResponse?.body} streamText={record.stream} />
              </Flex>
            </Tabs.Content>
          </Box>
        </Tabs.Root>
      </Card>
    </Flex>
  );
}

import { useState, useMemo, type ReactNode } from "react";
import { Flex, Button, Text, Box } from "@radix-ui/themes";
import { ChevronDownIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { useT } from "../i18n";
import ReadonlyEditor from "./ReadonlyEditor";

interface SSEEvent {
  event?: string;
  data: string;
  parsed?: unknown;
  id?: string;
  retry?: string;
}

function parseSSE(text: string): SSEEvent[] | null {
  const normalized = text.replaceAll("\r\n", "\n");
  if (!/^(data|event|id|retry):/m.test(normalized)) return null;

  const events: SSEEvent[] = [];
  let curEvent: string | undefined;
  let curData: string[] = [];
  let curId: string | undefined;
  let curRetry: string | undefined;
  let sawField = false;
  let sawAny = false;

  function flush() {
    if (!sawField) return;
    const data = curData.join("\n");
    let parsed: unknown;
    if (data && data !== "[DONE]") {
      try { parsed = JSON.parse(data); } catch {}
    }
    events.push({ event: curEvent, data, parsed, id: curId, retry: curRetry });
    curEvent = undefined;
    curData = [];
    curId = undefined;
    curRetry = undefined;
    sawField = false;
    sawAny = true;
  }

  for (const line of normalized.split("\n")) {
    if (line === "") { flush(); continue; }
    if (line.startsWith(":")) { sawField = true; continue; }
    if (line.startsWith("data:")) { curData.push(line.slice(5).trimStart()); sawField = true; continue; }
    if (line.startsWith("event:")) { curEvent = line.slice(6).trimStart(); sawField = true; continue; }
    if (line.startsWith("id:")) { curId = line.slice(3).trimStart(); sawField = true; continue; }
    if (line.startsWith("retry:")) { curRetry = line.slice(6).trimStart(); sawField = true; continue; }
    if (!sawField || curData.length === 0) return null;
    curData[curData.length - 1] += "\n" + line;
  }
  flush();
  return sawAny ? events : null;
}

function reconstructResponse(events: SSEEvent[]): Record<string, unknown> | null {
  // Try OpenAI Responses stream
  let lastResponse: Record<string, unknown> | null = null;
  for (const item of events) {
    const p = item.parsed;
    if (!p || typeof p !== "object") continue;
    const type = (item.event || (p as { type?: string }).type || "");
    if (typeof type !== "string" || !type.startsWith("response.")) continue;
    if ((p as { response?: unknown }).response && typeof (p as { response?: unknown }).response === "object") {
      lastResponse = (p as { response?: unknown }).response as Record<string, unknown>;
    }
    if (type === "response.completed" && (p as { response?: unknown }).response) {
      const r = (p as { response?: { output?: unknown[] } }).response;
      if (Array.isArray(r?.output) && r.output.length > 0) return r;
    }
  }
  if (lastResponse) return lastResponse as Record<string, unknown>;

  // Try OpenAI Chat stream
  let state: Record<string, unknown> | null = null;
  let text = "", saw = false;
  const toolMap = new Map<number, { id: string; type: string; function: { name: string; arguments: string } }>();
  for (const { parsed: p } of events) {
    if (!p || typeof p !== "object" || (p as { object?: string }).object !== "chat.completion.chunk") continue;
    saw = true;
    const pObj = p as { id?: string; created?: number; model?: string; usage?: unknown; choices?: Array<{ finish_reason?: string; delta?: { content?: string; refusal?: string; reasoning?: string; reasoning_content?: string; tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }> } }> };
    if (!state) state = { id: pObj.id, created: pObj.created, model: pObj.model, finishReason: null, usage: null };
    if (pObj.usage) state.usage = pObj.usage;
    const c = Array.isArray(pObj.choices) ? pObj.choices[0] : null;
    if (!c) continue;
    const d = c.delta ?? {};
    if (typeof d.content === "string" && d.content) text += d.content;
    if (Array.isArray(d.tool_calls)) {
      d.tool_calls.forEach((tc) => {
        const idx = typeof tc.index === "number" ? tc.index : 0;
        let e = toolMap.get(idx);
        if (!e) { e = { id: tc.id || "call_" + idx, type: "function", function: { name: tc.function?.name || "", arguments: "" } }; toolMap.set(idx, e); }
        if (tc.id) e.id = tc.id;
        if (tc.function?.name) e.function.name = tc.function.name;
        if (tc.function?.arguments) e.function.arguments += tc.function.arguments;
      });
    }
  }
  if (!saw || !state) return null;
  const msg: Record<string, unknown> = { role: "assistant", content: text || null };
  const tcs = [...toolMap.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  if (tcs.length > 0) (msg as Record<string, unknown>).tool_calls = tcs;
  return { id: state.id, object: "chat.completion", created: state.created, model: state.model, choices: [{ index: 0, message: msg }], usage: state.usage };
}

const VISIBLE_LIMIT = 50;

export default function StreamEvents({ text }: { text: string }) {
  const { t } = useT();
  const [showAll, setShowAll] = useState(false);
  const events = parseSSE(text);

  if (!events || events.length === 0) {
    return <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.5 }}>{text}</pre>;
  }

  const reconstructed = reconstructResponse(events);
  const visibleEvents = showAll ? events : events.slice(0, VISIBLE_LIMIT);
  const reconstructedText = reconstructed ? JSON.stringify(reconstructed, null, 2) : "";

  return (
    <Flex direction="column" gap="2">
      {reconstructed && (
        <CollapsibleBox title={t("recordDetail.fullResponse")} defaultOpen={false}>
          <ReadonlyEditor value={reconstructedText} language="json" />
        </CollapsibleBox>
      )}

      <CollapsibleBox title={t("recordDetail.streamEvents", { count: events.length })} defaultOpen>
        <Flex direction="column" gap="2">
          {visibleEvents.map((e, i) => (
            <EventItem key={i} index={i} event={e} />
          ))}
          {events.length > VISIBLE_LIMIT && !showAll && (
            <Button variant="outline" size="1" onClick={() => setShowAll(true)}>
              {t("records.showAllEvents", { count: events.length })}
            </Button>
          )}
        </Flex>
      </CollapsibleBox>
    </Flex>
  );
}

function CollapsibleBox({ title, defaultOpen, children }: { title: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Box style={{ border: "1px solid var(--gray-4)", borderRadius: "var(--radius-3)", background: "var(--gray-1)" }}>
      <Flex
        align="center"
        justify="between"
        px="3"
        py="2"
        style={{ cursor: "pointer", userSelect: "none" }}
        onClick={() => setOpen((o) => !o)}
      >
        <Text size="1" weight="bold" color="gray">
          {title}
        </Text>
        {open ? <ChevronDownIcon /> : <ChevronRightIcon />}
      </Flex>
      {open && <Box px="3" pb="3">{children}</Box>}
    </Box>
  );
}

function EventItem({ index, event }: { index: number; event: SSEEvent }) {
  const [open, setOpen] = useState(false);
  const text = useMemo(() => {
    if (event.parsed != null) return JSON.stringify(event.parsed, null, 2);
    return event.data;
  }, [event]);
  const language: "json" | "plaintext" = event.parsed != null ? "json" : "plaintext";

  return (
    <Box style={{ border: "1px solid var(--gray-4)", borderRadius: "var(--radius-3)", background: "var(--gray-1)" }}>
      <Flex
        align="center"
        justify="between"
        px="3"
        py="2"
        style={{ cursor: "pointer", userSelect: "none" }}
        onClick={() => setOpen((o) => !o)}
      >
        <Text size="1" weight="bold" color="gray">
          #{index + 1} {event.event || "data"}
        </Text>
        {open ? <ChevronDownIcon width="14" height="14" /> : <ChevronRightIcon width="14" height="14" />}
      </Flex>
      {open && (
        <Box px="3" pb="3">
          {event.event && (
            <Text size="1" color="gray" as="p" mb="1">
              event: {event.event}
            </Text>
          )}
          <ReadonlyEditor value={text} language={language} maxHeight={280} />
        </Box>
      )}
    </Box>
  );
}

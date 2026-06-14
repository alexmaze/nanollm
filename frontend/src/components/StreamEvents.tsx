import { useState } from "react";
import { Flex, Button, Text } from "@radix-ui/themes";
import { useT } from "../i18n";
import JsonTree from "./JsonTree";

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

  return (
    <Flex direction="column" gap="2">
      {reconstructed && (
        <details style={{ border: "1px solid var(--gray-4)", borderRadius: "var(--radius-3)", background: "var(--gray-1)" }}>
          <summary style={{ padding: "8px 12px", cursor: "pointer", fontWeight: 700, color: "var(--accent-9)", display: "flex", justifyContent: "space-between", listStyle: "none" }}>
            <span>{t("recordDetail.fullResponse")}</span>
          </summary>
          <div style={{ padding: "0 12px 12px" }}>
            <JsonTree value={reconstructed} />
          </div>
        </details>
      )}

      <details style={{ border: "1px solid var(--gray-4)", borderRadius: "var(--radius-3)", background: "var(--gray-1)" }} open>
        <summary style={{ padding: "8px 12px", cursor: "pointer", fontWeight: 700, color: "var(--accent-9)", display: "flex", justifyContent: "space-between", listStyle: "none" }}>
          <span>{t("recordDetail.streamEvents", { count: events.length })}</span>
        </summary>
        <div style={{ padding: "0 12px 12px" }}>
          <Flex direction="column" gap="2">
            {visibleEvents.map((e, i) => (
              <details key={i} style={{ border: "1px solid var(--gray-4)", borderRadius: "var(--radius-3)", background: "var(--gray-1)" }}>
                <summary style={{ padding: "8px 12px", cursor: "pointer", fontWeight: 700, color: "var(--accent-9)", display: "flex", justifyContent: "space-between", listStyle: "none" }}>
                  <span>#{i + 1} {e.event || "data"}</span>
                </summary>
                <div style={{ padding: "0 12px 12px" }}>
                  {e.event && (
                    <Text size="1" color="gray" style={{ display: "block", marginBottom: 8 }}>
                      event: {e.event}
                    </Text>
                  )}
                  <JsonTree value={e.parsed ?? e.data} />
                </div>
              </details>
            ))}
            {events.length > VISIBLE_LIMIT && !showAll && (
              <Button variant="outline" size="1" onClick={() => setShowAll(true)}>
                {t("records.showAllEvents", { count: events.length })}
              </Button>
            )}
          </Flex>
        </div>
      </details>
    </Flex>
  );
}

/**
 * Streaming + request body helpers for the Playground page.
 *
 * The gateway proxies `/v1/chat/completions`, `/v1/responses` and `/v1/messages`
 * and performs cross-protocol conversion server-side. The playground always
 * sends the native request shape for the selected API type so the recorded
 * client request is easy to read.
 */

import { PLAYGROUND_ENDPOINT_BY_API, type PlaygroundApiType, type PlaygroundReasoningEffort } from "../../api";

export interface PlaygroundImage {
  id: string;
  url: string;
  mediaType: string;
  name: string;
}

export interface PlaygroundUsage {
  inputTokens?: number;
  nonCacheInputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
}

export interface PlaygroundParams {
  system: string;
  temperature: string;
  topP: string;
  maxTokens: string;
  reasoningEffort: PlaygroundReasoningEffort;
}

export interface PlaygroundHistoryMessage {
  role: "user" | "assistant";
  content: string;
  images?: PlaygroundImage[];
}

export interface BuildBodyOptions extends PlaygroundParams {
  modelName: string;
  history: PlaygroundHistoryMessage[];
  newContent: string;
  images: PlaygroundImage[];
}

export function endpointForApiType(apiType: PlaygroundApiType): string {
  return PLAYGROUND_ENDPOINT_BY_API[apiType];
}

// ─── Image conversion ────────────────────────────────────────────────────────

interface ChatImagePart {
  type: "image_url";
  image_url: { url: string };
}
interface ResponsesImagePart {
  type: "input_image";
  image_url: string;
}
interface AnthropicImageBlock {
  type: "image";
  source: { type: "url" | "base64"; url?: string; media_type?: string; data?: string };
}

function splitDataUrl(url: string): { mediaType: string; data: string } | null {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(url);
  if (!m) return null;
  return { mediaType: m[1], data: m[2] };
}

function toChatImage(img: PlaygroundImage): ChatImagePart {
  return { type: "image_url", image_url: { url: img.url } };
}

function toResponsesImage(img: PlaygroundImage): ResponsesImagePart {
  return { type: "input_image", image_url: img.url };
}

function toAnthropicImage(img: PlaygroundImage): AnthropicImageBlock {
  const dataUrl = splitDataUrl(img.url);
  if (dataUrl) {
    return { type: "image", source: { type: "base64", media_type: dataUrl.mediaType, data: dataUrl.data } };
  }
  return { type: "image", source: { type: "url", url: img.url } };
}

// ─── reasoning_effort ────────────────────────────────────────────────────────

function effortToBudget(effort: PlaygroundReasoningEffort): number {
  switch (effort) {
    case "low":
      return 2048;
    case "medium":
      return 8000;
    case "high":
      return 16000;
    case "max":
      return 32000;
    default:
      return 8000;
  }
}

// ─── Request body builders ───────────────────────────────────────────────────

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function buildRequestBody(apiType: PlaygroundApiType, opts: BuildBodyOptions): unknown {
  const temperature = parseOptionalNumber(opts.temperature);
  const topP = parseOptionalNumber(opts.topP);
  const maxTokens = parseOptionalNumber(opts.maxTokens);
  const system = opts.system.trim();
  const effort = opts.reasoningEffort || "";

  if (apiType === "openai-chat") {
    const messages: unknown[] = [];
    if (system) messages.push({ role: "system", content: system });
    for (const msg of opts.history) {
      messages.push(historyToChatMessage(msg));
    }
    const userParts: unknown[] = [{ type: "text", text: opts.newContent }];
    for (const img of opts.images) userParts.push(toChatImage(img));
    messages.push({ role: "user", content: userParts });
    return {
      model: opts.modelName,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      ...(temperature != null && { temperature }),
      ...(topP != null && { top_p: topP }),
      ...(maxTokens != null && { max_tokens: maxTokens }),
      ...(effort && { reasoning_effort: effort, reasoning: { effort } }),
    };
  }

  if (apiType === "openai-responses") {
    const input: unknown[] = [];
    for (const msg of opts.history) {
      input.push(historyToResponsesMessage(msg));
    }
    const userContent: unknown[] = [{ type: "input_text", text: opts.newContent }];
    for (const img of opts.images) userContent.push(toResponsesImage(img));
    input.push({ type: "message", role: "user", content: userContent });
    return {
      model: opts.modelName,
      ...(system && { instructions: system }),
      input,
      stream: true,
      ...(temperature != null && { temperature }),
      ...(topP != null && { top_p: topP }),
      ...(maxTokens != null && { max_output_tokens: maxTokens }),
      ...(effort && { reasoning: { effort } }),
    };
  }

  // anthropic
  const messages: unknown[] = [];
  for (const msg of opts.history) {
    messages.push(historyToAnthropicMessage(msg));
  }
  const userBlocks: unknown[] = [{ type: "text", text: opts.newContent }];
  for (const img of opts.images) userBlocks.push(toAnthropicImage(img));
  messages.push({ role: "user", content: userBlocks });
  return {
    model: opts.modelName,
    ...(system && { system }),
    max_tokens: maxTokens ?? 4096,
    messages,
    stream: true,
    ...(temperature != null && { temperature }),
    ...(topP != null && { top_p: topP }),
    ...(effort && {
      thinking: { type: "enabled", budget_tokens: effortToBudget(effort) },
      output_config: { effort },
    }),
  };
}

function historyToChatMessage(msg: PlaygroundHistoryMessage): unknown {
  if (msg.role === "user" && msg.images && msg.images.length > 0) {
    const parts: unknown[] = [{ type: "text", text: msg.content }];
    for (const img of msg.images) parts.push(toChatImage(img));
    return { role: "user", content: parts };
  }
  return { role: msg.role, content: msg.content };
}

function historyToResponsesMessage(msg: PlaygroundHistoryMessage): unknown {
  if (msg.role === "user" && msg.images && msg.images.length > 0) {
    const content: unknown[] = [{ type: "input_text", text: msg.content }];
    for (const img of msg.images) content.push(toResponsesImage(img));
    return { type: "message", role: "user", content };
  }
  if (msg.role === "assistant") {
    return { type: "message", role: "assistant", content: [{ type: "output_text", text: msg.content }] };
  }
  return { type: "message", role: "user", content: [{ type: "input_text", text: msg.content }] };
}

function historyToAnthropicMessage(msg: PlaygroundHistoryMessage): unknown {
  if (msg.role === "user" && msg.images && msg.images.length > 0) {
    const blocks: unknown[] = [{ type: "text", text: msg.content }];
    for (const img of msg.images) blocks.push(toAnthropicImage(img));
    return { role: "user", content: blocks };
  }
  return { role: msg.role, content: [{ type: "text", text: msg.content }] };
}

// ─── SSE parsing ─────────────────────────────────────────────────────────────

export async function parseSSEStream(response: Response, onEvent: (obj: Record<string, unknown>) => void, signal?: AbortSignal): Promise<void> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      if (signal?.aborted) {
        try { await reader.cancel(); } catch {}
        return;
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        for (const line of raw.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const obj = JSON.parse(payload) as Record<string, unknown>;
            onEvent(obj);
          } catch {
            // ignore malformed lines
          }
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch {}
  }
}

// ─── Delta + usage extraction ────────────────────────────────────────────────

export interface DeltaResult {
  delta?: string;
  reasoningDelta?: string;
  usage?: PlaygroundUsage;
  done?: boolean;
}

export function extractDeltaAndUsage(apiType: PlaygroundApiType, event: Record<string, unknown>): DeltaResult {
  if (apiType === "openai-chat") {
    const choices = event.choices as Array<{ delta?: { content?: string; reasoning?: string; reasoning_content?: string; thinking?: string }; finish_reason?: string | null }> | undefined;
    const choice = choices?.[0];
    const delta = choice?.delta?.content;
    const reasoningDelta =
      (typeof choice?.delta?.reasoning_content === "string" && choice.delta.reasoning_content) ||
      (typeof choice?.delta?.reasoning === "string" && choice.delta.reasoning) ||
      (typeof choice?.delta?.thinking === "string" && choice.delta.thinking) ||
      undefined;
    const finishReason = choice?.finish_reason;
    const usage = event.usage ? normalizeUsage(event.usage as Record<string, unknown>) : undefined;
    return {
      ...(delta ? { delta } : {}),
      ...(reasoningDelta ? { reasoningDelta } : {}),
      ...(usage ? { usage } : {}),
      ...(finishReason ? { done: true } : {}),
    };
  }

  if (apiType === "openai-responses") {
    const type = event.type as string | undefined;
    let delta: string | undefined;
    let reasoningDelta: string | undefined;
    if (type === "response.output_text.delta") {
      delta = event.delta as string | undefined;
    } else if (type === "response.reasoning_summary_text.delta") {
      reasoningDelta = event.delta as string | undefined;
    }
    let usage: PlaygroundUsage | undefined;
    let done = false;
    if (type === "response.completed") {
      const response = event.response as Record<string, unknown> | undefined;
      usage = response?.usage ? normalizeUsage(response.usage as Record<string, unknown>) : undefined;
      done = true;
    }
    return {
      ...(delta ? { delta } : {}),
      ...(reasoningDelta ? { reasoningDelta } : {}),
      ...(usage ? { usage } : {}),
      ...(done ? { done } : {}),
    };
  }

  // anthropic
  const type = event.type as string | undefined;
  let delta: string | undefined;
  let reasoningDelta: string | undefined;
  if (type === "content_block_delta") {
    const d = event.delta as { type?: string; text?: string; thinking?: string } | undefined;
    if (d?.type === "text_delta") delta = d.text;
    else if (d?.type === "thinking_delta") reasoningDelta = d.thinking;
  }
  let usage: PlaygroundUsage | undefined;
  let done = false;
  if (type === "message_start") {
    const message = event.message as { usage?: Record<string, unknown> } | undefined;
    if (message?.usage) usage = normalizeUsage(message.usage);
  } else if (type === "message_delta") {
    const u = event.usage as Record<string, unknown> | undefined;
    if (u) usage = normalizeUsage(u);
  } else if (type === "message_stop") {
    done = true;
  }
  return {
    ...(delta ? { delta } : {}),
    ...(reasoningDelta ? { reasoningDelta } : {}),
    ...(usage ? { usage } : {}),
    ...(done ? { done } : {}),
  };
}

// ─── Usage normalization (mirrors src/converters/shared.ts normalizeUsage) ──

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function normalizeUsage(usage: Record<string, unknown>): PlaygroundUsage {
  const providerInputTokens = asNumber(usage.input_tokens) ?? asNumber(usage.prompt_tokens);
  const outputTokens = asNumber(usage.output_tokens) ?? asNumber(usage.completion_tokens);
  const reasoningTokens =
    asNumber((usage.completion_tokens_details as Record<string, unknown> | undefined)?.reasoning_tokens) ??
    asNumber((usage.output_tokens_details as Record<string, unknown> | undefined)?.reasoning_tokens);
  const cacheCreationInputTokens = asNumber(usage.cache_creation_input_tokens);
  const cacheReadInputTokens =
    asNumber(usage.cache_read_input_tokens) ??
    asNumber(usage.prompt_cache_hit_tokens) ??
    asNumber((usage.prompt_tokens_details as Record<string, unknown> | undefined)?.cached_tokens) ??
    asNumber((usage.input_tokens_details as Record<string, unknown> | undefined)?.cached_tokens);
  const hasAnthropicCacheUsage =
    cacheCreationInputTokens != null || asNumber(usage.cache_read_input_tokens) != null;
  const nonCacheInputTokens = hasAnthropicCacheUsage
    ? providerInputTokens
    : providerInputTokens != null
      ? Math.max(0, providerInputTokens - (cacheReadInputTokens ?? 0))
      : undefined;
  const inputTokens = hasAnthropicCacheUsage
    ? (nonCacheInputTokens ?? 0) + (cacheCreationInputTokens ?? 0) + (cacheReadInputTokens ?? 0)
    : providerInputTokens;
  const totalTokens =
    asNumber(usage.total_tokens) ??
    (inputTokens != null || outputTokens != null ? (inputTokens ?? 0) + (outputTokens ?? 0) : undefined);

  return {
    inputTokens,
    nonCacheInputTokens,
    outputTokens,
    totalTokens,
    reasoningTokens,
    cacheCreationInputTokens,
    cacheReadInputTokens,
  };
}

// ─── tokens/s ────────────────────────────────────────────────────────────────

export function computeTokensPerSecond(outputTokens: number | undefined, startedAt: number | undefined, endedAt: number | undefined): number | null {
  if (outputTokens == null || !startedAt || !endedAt) return null;
  const seconds = (endedAt - startedAt) / 1000;
  if (seconds <= 0) return null;
  return outputTokens / seconds;
}

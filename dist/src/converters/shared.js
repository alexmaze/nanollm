export function fail(message) {
    throw new Error(message);
}
export function text(textValue) {
    return { type: "text", text: textValue };
}
export function refusal(textValue) {
    return { type: "refusal", text: textValue };
}
export function collapseText(parts) {
    return parts
        .map((part) => {
        if (part.type === "text" || part.type === "refusal") {
            return part.text;
        }
        fail(`Cannot collapse "${part.type}" to text`);
    })
        .join("\n");
}
export function requireTextOnly(parts, context) {
    for (const part of parts) {
        if (part.type !== "text" && part.type !== "refusal") {
            fail(`${context} only supports text content`);
        }
    }
    return parts;
}
export function parseJson(textValue, context) {
    try {
        return JSON.parse(textValue);
    }
    catch {
        fail(`${context} contains invalid JSON`);
    }
}
export function stringifyJson(value) {
    return typeof value === "string" ? value : JSON.stringify(value);
}
function stringifyCustomToolValue(input) {
    if (typeof input === "string")
        return input;
    if (input === undefined || input === null)
        return "";
    return typeof input === "object" ? JSON.stringify(input) : String(input);
}
export function createResponsesCustomToolSchema(format) {
    let contentDescription;
    if (format && typeof format === "object") {
        const f = format;
        if (typeof f.definition === "string") {
            const label = typeof f.syntax === "string" ? `${f.syntax} grammar` : `${f.type ?? "format"} grammar`;
            contentDescription = `${label}:\n${f.definition}`;
        }
    }
    return {
        type: "object",
        additionalProperties: false,
        properties: {
            content: {
                type: "string",
                ...(contentDescription ? { description: contentDescription } : {}),
            },
        },
        required: ["content"],
    };
}
export function wrapResponsesCustomToolInput(input) {
    return JSON.stringify({ content: stringifyCustomToolValue(input) });
}
export function unwrapResponsesCustomToolInput(argumentsText) {
    try {
        const parsed = JSON.parse(argumentsText);
        if (typeof parsed === "string")
            return parsed;
        if (parsed && typeof parsed === "object") {
            if (typeof parsed.content === "string") {
                return parsed.content;
            }
            if (typeof parsed.arg === "string") {
                return parsed.arg;
            }
            return stringifyCustomToolValue(parsed);
        }
        return stringifyCustomToolValue(parsed);
    }
    catch {
        return stringifyCustomToolValue(argumentsText);
    }
}
const OPENAI_RESPONSES_MCP_QUALIFIED_TOOL_PATTERN = /^(mcp__.+?__)(.+)$/;
export function isOpenAIResponsesMcpNamespace(namespace) {
    return typeof namespace === "string" && namespace.startsWith("mcp__");
}
export function joinOpenAIResponsesNamespacePath(name, namespace) {
    if (!namespace)
        return name;
    return namespace.endsWith("__") ? `${namespace}${name}` : `${namespace}__${name}`;
}
export function qualifyOpenAIResponsesToolName(name, namespace) {
    if (!namespace)
        return name;
    return namespace.endsWith("__") ? namespace + name : namespace + "__" + name;
}
export function splitQualifiedOpenAIResponsesToolName(name) {
    // First try the mcp__ pattern for backward compatibility
    const mcpMatch = OPENAI_RESPONSES_MCP_QUALIFIED_TOOL_PATTERN.exec(name);
    if (mcpMatch) {
        const [, namespace, localName] = mcpMatch;
        if (isOpenAIResponsesMcpNamespace(namespace) && localName)
            return { namespace, name: localName };
    }
    // Generic fallback: split at the first "__" (namespace__toolname)
    const idx = name.indexOf("__");
    if (idx > 0) {
        const namespace = name.substring(0, idx);
        const localName = name.substring(idx + 2);
        if (namespace && localName)
            return { namespace, name: localName };
    }
    return { name };
}
export function makeDataUrl(mediaType, data) {
    return `data:${mediaType};base64,${data}`;
}
export function parseDataUrl(url) {
    const match = url.match(/^data:(.+);base64,(.+)$/);
    if (!match) {
        return null;
    }
    return {
        mediaType: match[1],
        data: match[2],
    };
}
function asNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
export function normalizeReasoningEffortFromBudget(thinkingBudgetTokens) {
    if (thinkingBudgetTokens == null)
        return null;
    if (thinkingBudgetTokens <= 3000)
        return "low";
    if (thinkingBudgetTokens <= 7500)
        return "medium";
    return "high";
}
export function normalizeUsage(usage) {
    if (!usage)
        return undefined;
    const providerInputTokens = asNumber(usage.input_tokens) ?? asNumber(usage.prompt_tokens);
    const outputTokens = asNumber(usage.output_tokens) ?? asNumber(usage.completion_tokens);
    const reasoningTokens = asNumber(usage.completion_tokens_details?.reasoning_tokens) ??
        asNumber(usage.output_tokens_details?.reasoning_tokens);
    const cacheCreationInputTokens = asNumber(usage.cache_creation_input_tokens);
    const cacheReadInputTokens = asNumber(usage.cache_read_input_tokens) ??
        asNumber(usage.prompt_cache_hit_tokens) ??
        asNumber(usage.prompt_tokens_details?.cached_tokens) ??
        asNumber(usage.input_tokens_details?.cached_tokens);
    const hasAnthropicCacheUsage = cacheCreationInputTokens != null || asNumber(usage.cache_read_input_tokens) != null;
    const nonCacheInputTokens = hasAnthropicCacheUsage
        ? providerInputTokens
        : providerInputTokens != null
            ? Math.max(0, providerInputTokens - (cacheReadInputTokens ?? 0))
            : undefined;
    const inputTokens = hasAnthropicCacheUsage
        ? (nonCacheInputTokens ?? 0) + (cacheCreationInputTokens ?? 0) + (cacheReadInputTokens ?? 0)
        : providerInputTokens;
    const totalTokens = asNumber(usage.total_tokens) ??
        (inputTokens != null || outputTokens != null ? (inputTokens ?? 0) + (outputTokens ?? 0) : undefined);
    if (inputTokens == null &&
        nonCacheInputTokens == null &&
        outputTokens == null &&
        totalTokens == null &&
        reasoningTokens == null &&
        cacheCreationInputTokens == null &&
        cacheReadInputTokens == null) {
        return undefined;
    }
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
export function denormalizeUsageToOpenAIChat(usage) {
    if (!usage)
        return undefined;
    const promptTokens = usage.inputTokens;
    const completionTokens = usage.outputTokens;
    const totalTokens = usage.totalTokens ?? (promptTokens != null || completionTokens != null ? (promptTokens ?? 0) + (completionTokens ?? 0) : undefined);
    if (promptTokens == null && completionTokens == null && totalTokens == null)
        return undefined;
    return {
        ...(promptTokens != null ? { prompt_tokens: promptTokens } : {}),
        ...(completionTokens != null ? { completion_tokens: completionTokens } : {}),
        ...(totalTokens != null ? { total_tokens: totalTokens } : {}),
        ...(usage.reasoningTokens != null ? { completion_tokens_details: { reasoning_tokens: usage.reasoningTokens } } : {}),
        ...(usage.cacheReadInputTokens != null ? { prompt_tokens_details: { cached_tokens: usage.cacheReadInputTokens }, prompt_cache_hit_tokens: usage.cacheReadInputTokens } : {}),
    };
}
export function denormalizeUsageToOpenAIResponses(usage) {
    if (!usage)
        return undefined;
    const inputTokens = usage.inputTokens;
    const outputTokens = usage.outputTokens;
    const totalTokens = usage.totalTokens ?? (inputTokens != null || outputTokens != null ? (inputTokens ?? 0) + (outputTokens ?? 0) : undefined);
    if (inputTokens == null && outputTokens == null && totalTokens == null)
        return undefined;
    return {
        ...(inputTokens != null ? { input_tokens: inputTokens } : {}),
        ...(outputTokens != null ? { output_tokens: outputTokens } : {}),
        ...(totalTokens != null ? { total_tokens: totalTokens } : {}),
        ...(usage.reasoningTokens != null ? { output_tokens_details: { reasoning_tokens: usage.reasoningTokens } } : {}),
        ...(usage.cacheReadInputTokens != null ? { input_tokens_details: { cached_tokens: usage.cacheReadInputTokens } } : {}),
    };
}
export function denormalizeUsageToAnthropic(usage) {
    if (!usage)
        return undefined;
    const inputTokens = usage.nonCacheInputTokens ?? usage.inputTokens;
    const outputTokens = usage.outputTokens;
    if (inputTokens == null && outputTokens == null && usage.cacheCreationInputTokens == null && usage.cacheReadInputTokens == null)
        return undefined;
    return {
        ...(inputTokens != null ? { input_tokens: inputTokens } : {}),
        ...(outputTokens != null ? { output_tokens: outputTokens } : {}),
        ...(usage.cacheCreationInputTokens != null ? { cache_creation_input_tokens: usage.cacheCreationInputTokens } : {}),
        ...(usage.cacheReadInputTokens != null ? { cache_read_input_tokens: usage.cacheReadInputTokens } : {}),
        server_tool_use: null,
    };
}

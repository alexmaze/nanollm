import { collapseText, createResponsesCustomToolSchema, fail, joinOpenAIResponsesNamespacePath, makeDataUrl, normalizeReasoningEffortFromBudget, parseDataUrl, parseJson, qualifyOpenAIResponsesToolName, refusal, requireTextOnly, splitQualifiedOpenAIResponsesToolName, text, unwrapResponsesCustomToolInput, wrapResponsesCustomToolInput, } from "./shared.js";
import { isResponsesCustomToolName, markResponsesCustomToolName } from "../request-context.js";
export function normalizeOpenAIChatRequest(request) {
    const tools = request.tools?.flatMap((tool) => {
        const normalized = normalizeOpenAIChatTool(tool);
        return normalized ? [normalized] : [];
    });
    const toolChoice = request.tool_choice !== undefined
        ? normalizeOpenAIChatToolChoice(request.tool_choice)
        : request.function_call !== undefined
            ? normalizeOpenAIChatLegacyFunctionChoice(request.function_call)
            : undefined;
    return {
        model: request.model,
        sourceFormat: "openai-chat",
        maxOutputTokens: request.max_completion_tokens ?? request.max_tokens ?? undefined,
        messages: request.messages.flatMap((message) => normalizeOpenAIChatMessage(message)),
        tools: [
            ...(tools ?? []),
            ...(request.functions?.map((tool) => ({
                kind: "function",
                name: tool.name,
                description: tool.description,
                inputSchema: tool.parameters ?? { type: "object" },
            })) ?? []),
        ],
        toolChoice: filterUnsupportedToolChoice(toolChoice, [...(tools ?? []), ...(request.functions?.map((tool) => ({ kind: "function", name: tool.name })) ?? [])]),
        metadata: request.metadata ?? null,
        serviceTier: request.service_tier ?? null,
        stream: request.stream ?? false,
        temperature: request.temperature ?? null,
        topP: request.top_p ?? null,
        stopSequences: request.stop === undefined || request.stop === null ? undefined : Array.isArray(request.stop) ? request.stop : [request.stop],
        parallelToolCalls: request.parallel_tool_calls,
        promptCacheKey: request.prompt_cache_key ?? request.promptCacheKey,
        promptCacheRetention: request.prompt_cache_retention ?? request.promptCacheRetention ?? null,
        safetyIdentifier: request.safety_identifier,
        reasoningEffort: request.reasoning_effort ?? request.reasoning?.effort ?? null,
        thinkingBudgetTokens: null,
        textVerbosity: request.verbosity ?? null,
        responseFormat: normalizeOpenAIChatResponseFormat(request.response_format),
        cacheControl: { type: "ephemeral" },
    };
}
export function normalizeOpenAIResponsesRequest(request) {
    const messages = [];
    if (request.instructions) {
        if (typeof request.instructions === "string")
            messages.push({ role: "developer", parts: [text(request.instructions)] });
        else
            messages.push(...normalizeOpenAIResponsesInput(request.instructions));
    }
    if (request.input !== undefined)
        messages.push(...normalizeOpenAIResponsesInput(typeof request.input === "string" ? request.input : request.input));
    const tools = request.tools?.flatMap((tool) => normalizeOpenAIResponsesTool(tool));
    const normalizedToolChoice = request.tool_choice ? normalizeOpenAIResponsesToolChoice(request.tool_choice) : undefined;
    return {
        model: request.model ?? "",
        sourceFormat: "openai-responses",
        maxOutputTokens: request.max_output_tokens ?? undefined,
        messages,
        tools,
        toolChoice: filterUnsupportedToolChoice(normalizedToolChoice, tools),
        metadata: request.metadata ?? null,
        serviceTier: request.service_tier ?? null,
        stream: request.stream ?? false,
        temperature: request.temperature ?? null,
        topP: request.top_p ?? null,
        parallelToolCalls: request.parallel_tool_calls,
        promptCacheKey: request.prompt_cache_key ?? request.promptCacheKey,
        promptCacheRetention: request.prompt_cache_retention ?? request.promptCacheRetention ?? null,
        safetyIdentifier: request.safety_identifier,
        reasoningEffort: request.reasoning?.effort ?? null,
        thinkingBudgetTokens: null,
        textVerbosity: request.text?.verbosity ?? null,
        responseFormat: normalizeOpenAIResponsesFormat(request.text?.format),
        cacheControl: { type: "ephemeral" },
    };
}
export function normalizeAnthropicRequest(request) {
    const messages = [];
    if (request.system)
        messages.push(normalizeAnthropicSystem(request.system));
    for (const message of request.messages)
        messages.push(...normalizeAnthropicMessage(message));
    let promptCacheKey;
    if (request.metadata?.user_id) {
        try {
            const userIdData = JSON.parse(request.metadata.user_id);
            if (userIdData.session_id) {
                promptCacheKey = userIdData.session_id;
            }
        }
        catch { }
    }
    if (!promptCacheKey) {
        promptCacheKey = makeDatePromptCacheKey();
    }
    const tools = request.tools?.flatMap((tool) => {
        const normalized = normalizeAnthropicTool(tool);
        return normalized ? [normalized] : [];
    });
    const normalizedToolChoice = request.tool_choice ? normalizeAnthropicToolChoice(request.tool_choice) : undefined;
    return {
        model: request.model,
        sourceFormat: "anthropic",
        maxOutputTokens: request.max_tokens,
        messages,
        tools,
        toolChoice: filterUnsupportedToolChoice(normalizedToolChoice, tools),
        metadata: request.metadata ? { user_id: request.metadata.user_id ?? null } : null,
        serviceTier: request.service_tier ?? null,
        stream: request.stream ?? false,
        temperature: request.temperature ?? null,
        topP: request.top_p ?? null,
        stopSequences: request.stop_sequences,
        parallelToolCalls: normalizedToolChoice?.type === "none" ? undefined : normalizedToolChoice?.disableParallel === undefined ? undefined : !normalizedToolChoice.disableParallel,
        promptCacheKey,
        reasoningEffort: request.thinking?.type === "adaptive"
            ? request.output_config?.effort ?? null
            : normalizeReasoningEffortFromBudget(request.thinking?.type === "enabled" ? request.thinking.budget_tokens : null),
        thinkingBudgetTokens: request.thinking?.type === "enabled" ? request.thinking.budget_tokens : null,
        textVerbosity: null,
        responseFormat: request.output_config?.format ? { type: "json_schema", name: "anthropic_output", schema: request.output_config.format.schema } : undefined,
        cacheControl: { type: "ephemeral" },
    };
}
export function denormalizeToOpenAIChatRequest(request) {
    const reasoningEffort = normalizeOpenAITargetReasoningEffort(request.reasoningEffort, request.thinkingBudgetTokens, "OpenAI Chat");
    return {
        model: request.model,
        messages: denormalizeOpenAIChatMessages(reorderMessagesForOpenAIChatToolResults(request.messages), request.image ?? true),
        max_completion_tokens: request.maxOutputTokens,
        metadata: request.metadata ?? undefined,
        service_tier: normalizeOpenAIServiceTier(request.serviceTier),
        stream: request.stream,
        stream_options: request.stream ? { include_usage: true } : undefined,
        temperature: request.temperature ?? undefined,
        top_p: request.topP ?? undefined,
        stop: request.stopSequences,
        parallel_tool_calls: request.parallelToolCalls,
        prompt_cache_key: request.promptCacheKey,
        prompt_cache_retention: request.promptCacheRetention ?? undefined,
        safety_identifier: request.safetyIdentifier,
        reasoning_effort: (reasoningEffort ?? undefined),
        reasoning: reasoningEffort ? { effort: reasoningEffort } : undefined,
        verbosity: request.textVerbosity ?? undefined,
        response_format: denormalizeOpenAIChatResponseFormat(request.responseFormat),
        tools: request.tools?.map((tool) => tool.kind === "function"
            ? { type: "function", function: { name: tool.name, description: tool.description ?? undefined, parameters: tool.inputSchema, strict: tool.strict ?? undefined } }
            : { type: "custom", custom: { name: tool.name, description: tool.description ?? undefined, format: tool.format } }),
        tool_choice: denormalizeOpenAIChatToolChoice(request.toolChoice),
    };
}
function denormalizeOpenAIChatMessages(messages, imageEnabled) {
    const denormalized = messages.flatMap((message) => denormalizeOpenAIChatMessage(message, imageEnabled));
    if (!imageEnabled) {
        const merged = [];
        for (const message of denormalized) {
            const previous = merged.at(-1);
            if (previous?.role === "assistant" && message?.role === "assistant") {
                if (previous.content === null && message.content !== null) {
                    previous.content = message.content;
                }
                else if (previous.content !== null && message.content !== null) {
                    previous.content = [previous.content, message.content].filter(Boolean).join("\n");
                }
                if (message.tool_calls?.length) {
                    previous.tool_calls = [...(previous.tool_calls ?? []), ...message.tool_calls];
                }
                const prevThinking = previous.thinking || previous.reasoning || previous.reasoning_content || "";
                const msgThinking = message.thinking || message.reasoning || message.reasoning_content || "";
                const mergedThinking = [prevThinking, msgThinking].filter(Boolean).join("\n");
                if (mergedThinking) {
                    previous.thinking = mergedThinking;
                    previous.reasoning = mergedThinking;
                    previous.reasoning_content = mergedThinking;
                }
                if (message.refusal && !previous.refusal) {
                    previous.refusal = message.refusal;
                }
                continue;
            }
            if (previous?.role === "user" && message?.role === "user" && typeof previous.content === "string" && typeof message.content === "string") {
                previous.content = [previous.content, message.content].filter(Boolean).join("\n");
                continue;
            }
            merged.push(message);
        }
        return merged;
    }
    const merged = [];
    const pendingToolResultMedia = [];
    const flushToolResultMedia = () => {
        if (pendingToolResultMedia.length === 0)
            return;
        merged.push({ role: "user", content: pendingToolResultMedia.splice(0) });
    };
    for (const message of denormalized) {
        if (message?.__toolResultMedia) {
            pendingToolResultMedia.push(...(Array.isArray(message.content) ? message.content : []));
            continue;
        }
        if (pendingToolResultMedia.length > 0 && message?.role !== "tool") {
            flushToolResultMedia();
        }
        const previous = merged.at(-1);
        if (previous?.role === "assistant" && message?.role === "assistant") {
            if (previous.content === null && message.content !== null) {
                previous.content = message.content;
            }
            else if (previous.content !== null && message.content !== null) {
                previous.content = [previous.content, message.content].filter(Boolean).join("\n");
            }
            if (message.tool_calls?.length) {
                previous.tool_calls = [...(previous.tool_calls ?? []), ...message.tool_calls];
            }
            const prevThinking = previous.thinking || previous.reasoning || previous.reasoning_content || "";
            const msgThinking = message.thinking || message.reasoning || message.reasoning_content || "";
            const mergedThinking = [prevThinking, msgThinking].filter(Boolean).join("\n");
            if (mergedThinking) {
                previous.thinking = mergedThinking;
                previous.reasoning = mergedThinking;
                previous.reasoning_content = mergedThinking;
            }
            if (message.refusal && !previous.refusal) {
                previous.refusal = message.refusal;
            }
            continue;
        }
        if (previous?.role === "user" &&
            message?.role === "user" &&
            Array.isArray(previous.content) &&
            Array.isArray(message.content)) {
            previous.content.push(...message.content);
            continue;
        }
        if (previous?.role === "user" &&
            message?.role === "user" &&
            Array.isArray(previous.content) &&
            typeof message.content === "string" &&
            message.content) {
            previous.content.unshift({ type: "text", text: message.content });
            continue;
        }
        if (previous?.role === "user" &&
            message?.role === "user" &&
            typeof previous.content === "string" &&
            Array.isArray(message.content)) {
            message.content.unshift({ type: "text", text: previous.content });
            merged[merged.length - 1] = { ...message };
            continue;
        }
        merged.push(message);
    }
    flushToolResultMedia();
    return merged;
}
export function denormalizeToOpenAIResponsesRequest(request) {
    const reasoningEffort = normalizeOpenAITargetReasoningEffort(request.reasoningEffort, request.thinkingBudgetTokens, "OpenAI Responses");
    const instructionLines = [];
    let index = 0;
    while (index < request.messages.length) {
        const message = request.messages[index];
        if (message.role === "system" || message.role === "developer") {
            instructionLines.push(collapseText(requireTextOnly(message.parts, "Responses instructions")));
            index += 1;
            continue;
        }
        break;
    }
    return {
        model: request.model,
        instructions: instructionLines.length > 0 ? instructionLines.join("\n") : undefined,
        input: request.messages.slice(index).flatMap((message) => denormalizeOpenAIResponsesMessage(message, request.sourceFormat === "openai-responses")),
        max_output_tokens: request.maxOutputTokens,
        // metadata: request.metadata ?? undefined,
        service_tier: normalizeOpenAIResponsesServiceTier(request.serviceTier),
        stream: request.stream,
        temperature: request.temperature ?? undefined,
        top_p: request.topP ?? undefined,
        parallel_tool_calls: request.parallelToolCalls,
        prompt_cache_key: request.promptCacheKey,
        prompt_cache_retention: request.promptCacheRetention ?? undefined,
        safety_identifier: request.safetyIdentifier,
        reasoning: reasoningEffort ? { effort: reasoningEffort } : undefined,
        text: request.responseFormat || request.textVerbosity ? { format: request.responseFormat ? denormalizeOpenAIResponsesFormat(request.responseFormat) : undefined, verbosity: request.textVerbosity ?? undefined } : undefined,
        tools: denormalizeOpenAIResponsesTools(request.tools),
        tool_choice: denormalizeOpenAIResponsesToolChoice(request.toolChoice),
    };
}
export function denormalizeToAnthropicRequest(request, options) {
    const systemBlocks = [];
    const filteredMessages = [];
    const maxTokens = request.maxOutputTokens ?? 10240;
    const ignoreInvalidHistory = options?.ignoreInvalidHistory ?? true;
    for (const message of request.messages) {
        if (message.role === "system" || message.role === "developer") {
            for (const part of requireTextOnly(message.parts, "Anthropic [REDACTED]"))
                systemBlocks.push({ type: "text", text: part.text });
        }
        else {
            filteredMessages.push(message);
        }
    }
    const anthropicMessages = request.sourceFormat === "anthropic"
        ? filteredMessages
        : ensureAnthropicMessagesEndWithUser(reorderMessagesForAnthropicToolResults(filteredMessages));
    return {
        model: request.model,
        max_tokens: maxTokens,
        system: systemBlocks.length > 0 ? systemBlocks : undefined,
        messages: mergeAnthropicMessages(anthropicMessages.flatMap((message) => denormalizeAnthropicMessage(message, request.sourceFormat === "anthropic", ignoreInvalidHistory))),
        metadata: denormalizeAnthropicMetadata(request.metadata),
        service_tier: normalizeAnthropicServiceTier(request.serviceTier),
        stream: request.stream,
        stop_sequences: request.stopSequences,
        temperature: request.temperature ?? undefined,
        top_p: request.topP ?? undefined,
        tools: request.tools?.filter(tool => tool.kind === "function").map((tool) => denormalizeAnthropicTool(tool)),
        tool_choice: denormalizeAnthropicToolChoice(request.toolChoice, request.parallelToolCalls, (request.tools?.length ?? 0) > 0),
        output_config: denormalizeAnthropicOutputConfig(request.responseFormat, request.reasoningEffort, request.thinkingBudgetTokens),
        thinking: denormalizeAnthropicThinking(request.reasoningEffort, request.thinkingBudgetTokens),
        cache_control: request.cacheControl ?? { type: "ephemeral" },
    };
}
function makeDatePromptCacheKey(now = new Date()) {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
}
function normalizeOpenAIChatMessage(message) {
    switch (message.role) {
        case "system":
        case "developer":
            return [{ role: message.role, parts: [text(typeof message.content === "string" ? message.content : message.content.map((part) => part.text).join("\n"))] }];
        case "user":
            return [{ role: "user", parts: normalizeOpenAIChatUserParts(message.content) }];
        case "assistant":
            return [{ role: "assistant", parts: normalizeOpenAIChatAssistantParts(message), toolCalls: [...(message.tool_calls?.map((toolCall) => normalizeOpenAIChatToolCall(toolCall)) ?? []), ...(message.function_call ? [{ kind: "function", id: `${message.function_call.name}:legacy`, name: message.function_call.name, payload: message.function_call.arguments }] : [])] }];
        case "tool":
            return [{ role: "tool", toolCallId: message.tool_call_id, parts: normalizeOpenAIChatToolResultParts(message.content) }];
        case "function":
            return [{ role: "function", name: message.name, parts: message.content ? [text(message.content)] : [] }];
        default:
            fail(`Unsupported chat role "${message.role}"`);
    }
}
function normalizeOpenAIChatToolResultParts(content) {
    if (typeof content === "string")
        return [text(content)];
    return content.map((part) => {
        if (part.type === "text")
            return text(part.text);
        if (part.type === "image_url")
            return { type: "image_url", url: part.image_url.url, detail: part.image_url.detail };
        if (part.type === "input_audio")
            return { type: "input_audio", data: part.input_audio.data, format: part.input_audio.format };
        if (part.type === "document_url")
            return { type: "document_url", url: part.document_url.url, title: part.document_url.title ?? null };
        if (part.type === "document_base64")
            return { type: "document_base64", data: part.document_base64.data, mediaType: part.document_base64.media_type ?? null, title: part.document_base64.title ?? null };
        if (part.type === "refusal")
            return refusal(part.refusal);
        fail(`Unsupported chat tool content part "${part.type}"`);
    });
}
function normalizeOpenAIChatUserParts(content) {
    if (typeof content === "string")
        return [text(content)];
    return content.map((part) => {
        if (part.type === "text")
            return text(part.text);
        if (part.type === "image_url")
            return { type: "image_url", url: part.image_url.url, detail: part.image_url.detail };
        if (part.type === "input_audio")
            return { type: "input_audio", data: part.input_audio.data, format: part.input_audio.format };
        fail(`Unsupported chat user content part "${part.type}"`);
    });
}
function normalizeOpenAIChatAssistantParts(message) {
    const parts = [];
    const thinking = message.thinking ?? message.reasoning ?? message.reasoning_content;
    if (typeof thinking === "string" && thinking)
        parts.push({ type: "thinking", thinking });
    if (typeof message.content === "string")
        parts.push(text(message.content));
    else
        for (const part of message.content ?? []) {
            if (part.type === "text")
                parts.push(text(part.text));
            else if (part.type === "thinking")
                parts.push({ type: "thinking", thinking: part.thinking ?? part.text, signature: part.signature });
            else if (part.type === "redacted_thinking")
                parts.push({ type: "redacted_thinking", data: part.data });
            else
                parts.push(refusal(part.refusal));
        }
    if (message.refusal)
        parts.push(refusal(message.refusal));
    return parts;
}
function normalizeOpenAIChatToolCall(toolCall) {
    return toolCall.type === "function" ? { kind: "function", id: toolCall.id, name: toolCall.function.name, payload: toolCall.function.arguments } : { kind: "custom", id: toolCall.id, name: toolCall.custom.name, payload: toolCall.custom.input };
}
function normalizeOpenAIChatTool(tool) {
    return tool.type === "function"
        ? { kind: "function", name: tool.function.name, description: tool.function.description, inputSchema: tool.function.parameters ?? { type: "object" }, strict: tool.function.strict ?? null }
        : undefined;
}
function normalizeOpenAIChatToolChoice(choice) {
    if (typeof choice === "string")
        return choice === "required" ? { type: "required" } : { type: choice };
    if (choice.type === "function")
        return { type: "tool", kind: "function", name: choice.function.name };
    if (choice.type === "custom")
        return { type: "tool", kind: "custom", name: choice.custom.name };
    if (choice.allowed_tools)
        return { type: choice.allowed_tools.mode === "required" ? "required" : "auto" };
    return undefined;
}
function normalizeOpenAIChatLegacyFunctionChoice(choice) {
    if (choice === "auto")
        return { type: "auto" };
    if (choice === "none")
        return { type: "none" };
    return { type: "tool", kind: "function", name: choice.name };
}
function normalizeOpenAIChatResponseFormat(format) {
    if (!format)
        return undefined;
    if (format.type === "text" || format.type === "json_object")
        return { type: format.type };
    return { type: "json_schema", name: format.json_schema.name, schema: format.json_schema.schema, description: format.json_schema.description, strict: format.json_schema.strict ?? null };
}
function normalizeOpenAIResponsesInput(input) {
    if (typeof input === "string")
        return [{ role: "user", parts: [text(input)] }];
    return input.flatMap((item) => {
        const itemType = item.type ?? "message";
        if (itemType === "message")
            return [normalizeOpenAIResponsesMessage(item)];
        if (itemType === "reasoning") {
            const reasoningParts = Array.isArray(item.summary) && item.summary.length > 0 ? item.summary : Array.isArray(item.content) ? item.content : [];
            const thinking = reasoningParts.map((part) => ({ type: "thinking", thinking: part.text }));
            const redactedThinking = item.encrypted_content && thinking.length === 0 ? [{ type: "redacted_thinking", data: item.encrypted_content }] : [];
            return [{
                    role: "assistant",
                    parts: [...thinking, ...redactedThinking],
                }];
        }
        if (itemType === "function_call") {
            return [{
                    role: "assistant",
                    parts: [],
                    toolCalls: [{ kind: "function", id: item.call_id, name: qualifyOpenAIResponsesToolName(item.name, item.namespace), payload: item.arguments }],
                }];
        }
        if (itemType === "custom_tool_call") {
            const name = qualifyOpenAIResponsesToolName(item.name, item.namespace);
            markResponsesCustomToolName(name);
            return [{ role: "assistant", parts: [], toolCalls: [{ kind: "function", id: item.call_id, name, payload: normalizeCustomToolInputToFunctionArguments(item.input) }] }];
        }
        if (itemType === "function_call_output" || itemType === "custom_tool_call_output") {
            return [{ role: "tool", toolCallId: item.call_id, parts: normalizeOpenAIResponsesToolOutput(item.output) }];
        }
        if (itemType === "tool_search_call" || itemType === "tool_search_output") {
            console.warn(`Dropping unsupported Responses input item type "${itemType}" during conversion`);
            return [];
        }
        if (itemType === "item_reference")
            return [];
        fail(`Responses input item type "${itemType}" is not supported`);
    });
}
function normalizeCustomToolInputToFunctionArguments(input) {
    return wrapResponsesCustomToolInput(input);
}
function normalizeOpenAIResponsesMessage(item) {
    if (typeof item.content === "string")
        return { role: item.role, parts: [text(item.content)] };
    return {
        role: item.role,
        parts: item.content.map((part) => {
            if (part.type === "input_text" || part.type === "output_text")
                return text(part.text);
            if (part.type === "refusal")
                return refusal(part.refusal);
            if (part.type === "input_image") {
                if (!part.image_url)
                    fail("Responses input_image without image_url is not supported");
                return { type: "image_url", url: part.image_url, detail: part.detail === "original" ? "auto" : part.detail ?? undefined };
            }
            if (part.type === "input_audio")
                return { type: "input_audio", data: part.input_audio.data, format: part.input_audio.format };
            if (part.type === "input_file") {
                if (part.file_url)
                    return { type: "document_url", url: part.file_url, title: part.filename ?? null };
                if (part.file_data)
                    return { type: "document_base64", data: part.file_data, title: part.filename ?? null };
                fail("Responses input_file without file_url or file_data is not supported");
            }
            fail(`Unsupported Responses content part "${part.type}"`);
        }),
    };
}
function normalizeOpenAIResponsesToolOutput(output) {
    if (typeof output === "string")
        return [text(output)];
    return output.map((part) => {
        if (part.type === "input_text")
            return text(String(part.text));
        if (part.type === "input_image") {
            if (!part.image_url)
                fail("Responses tool output input_image without image_url is not supported");
            return { type: "image_url", url: part.image_url, detail: part.detail === "original" ? "auto" : part.detail ?? undefined };
        }
        if (part.type === "input_file") {
            if (part.file_url)
                return { type: "document_url", url: part.file_url, title: part.filename ?? null };
            if (part.file_data)
                return { type: "document_base64", data: part.file_data, title: part.filename ?? null };
            fail("Responses tool output input_file without file_url or file_data is not supported");
        }
        fail(`Unsupported Responses tool output part "${part.type}"`);
    });
}
function normalizeOpenAIResponsesTool(tool, namespace) {
    if (tool.type === "namespace") {
        const qualifiedNamespace = joinOpenAIResponsesNamespacePath(tool.name, namespace);
        return (tool.tools ?? []).flatMap((child) => normalizeOpenAIResponsesTool(child, qualifiedNamespace));
    }
    const name = qualifyOpenAIResponsesToolName(tool.name, namespace);
    if (tool.type === "function")
        return [{ kind: "function", name, description: tool.description, inputSchema: tool.parameters ?? { type: "object" }, strict: tool.strict ?? null }];
    if (tool.type === "custom") {
        markResponsesCustomToolName(name);
        return [{
                kind: "function",
                name,
                description: tool.description,
                inputSchema: createResponsesCustomToolSchema(tool.format),
                strict: null,
            }];
    }
    return [];
}
function normalizeOpenAIResponsesToolChoice(choice) {
    if (typeof choice === "string")
        return choice === "required" ? { type: "required" } : { type: choice };
    if (choice.type === "function")
        return { type: "tool", kind: "function", name: choice.name };
    if (choice.type === "custom") {
        markResponsesCustomToolName(choice.name);
        return { type: "tool", kind: "function", name: choice.name };
    }
    if (choice.type === "allowed_tools")
        return { type: choice.mode === "required" ? "required" : "auto" };
    return undefined;
}
function normalizeOpenAIResponsesFormat(format) {
    if (!format)
        return undefined;
    if (format.type === "text" || format.type === "json_object")
        return { type: format.type };
    return { type: "json_schema", name: format.name, schema: format.schema, description: format.description, strict: format.strict ?? null };
}
function normalizeAnthropicSystem(system) {
    return typeof system === "string" ? { role: "system", parts: [text(system)] } : { role: "system", parts: system.map((block) => text(block.text)) };
}
function normalizeAnthropicMessage(message) {
    if (typeof message.content === "string")
        return [{ role: message.role, parts: [text(message.content)] }];
    if (message.role === "assistant") {
        const parts = [];
        const toolCalls = [];
        for (const block of message.content) {
            if (block.type === "text")
                parts.push(text(block.text));
            else if (block.type === "thinking")
                parts.push({ type: "thinking", thinking: block.thinking, signature: block.signature });
            else if (block.type === "redacted_thinking")
                parts.push({ type: "redacted_thinking", data: block.data });
            else if (block.type === "tool_use" || block.type === "server_tool_use")
                toolCalls.push({ kind: "function", id: block.id, name: block.name, payload: JSON.stringify(block.input) });
        }
        return [{ role: "assistant", parts, toolCalls }];
    }
    const normalized = [];
    for (const block of message.content) {
        if (block.type === "text") {
            normalized.push({ role: "user", parts: [{ type: "text", text: block.text, cacheControl: block.cache_control }] });
            continue;
        }
        if (block.type === "image") {
            normalized.push({ role: "user", parts: [{ type: "image_url", url: block.source.type === "url" ? block.source.url : makeDataUrl(block.source.media_type, block.source.data), cacheControl: block.cache_control }] });
            continue;
        }
        if (block.type === "document") {
            if (block.source.type === "url")
                normalized.push({ role: "user", parts: [{ type: "document_url", url: block.source.url, title: block.title ?? null, cacheControl: block.cache_control }] });
            else if (block.source.type === "base64")
                normalized.push({ role: "user", parts: [{ type: "document_base64", data: block.source.data, mediaType: block.source.media_type, title: block.title ?? null, cacheControl: block.cache_control }] });
            else if (block.source.type === "text")
                normalized.push({ role: "user", parts: [{ type: "text", text: block.source.data, cacheControl: block.cache_control }] });
            else if (block.source.type === "content") {
                const textParts = [];
                for (const child of block.source.content) {
                    if (child.type !== "text")
                        fail(`Anthropic document content block "${child.type}" is not supported`);
                    textParts.push({ type: "text", text: child.text, cacheControl: block.cache_control });
                }
                if (textParts.length > 0)
                    normalized.push({ role: "user", parts: textParts });
            }
            continue;
        }
        if (block.type === "tool_result") {
            normalized.push({ role: "tool", toolCallId: block.tool_use_id, isError: block.is_error, parts: normalizeAnthropicToolResultParts(block.content) });
            continue;
        }
        if (isAnthropicServerToolResultBlock(block)) {
            normalized.push({ role: "tool", toolCallId: block.tool_use_id, isError: isAnthropicServerToolErrorContent(block.content), parts: normalizeAnthropicServerToolResultParts(block.content) });
            continue;
        }
        fail(`Anthropic block "${block.type}" is not supported`);
    }
    return normalized;
}
function isAnthropicServerToolResultBlock(block) {
    return typeof block?.type === "string" && block.type.endsWith("_tool_result");
}
function isAnthropicServerToolErrorContent(content) {
    return !!content && !Array.isArray(content) && typeof content.type === "string" && content.type.endsWith("_error");
}
function normalizeAnthropicServerToolResultParts(content) {
    if (!content)
        return [];
    if (typeof content === "string")
        return [text(content)];
    if (Array.isArray(content)) {
        return content.flatMap((block) => normalizeAnthropicServerToolResultParts(block));
    }
    if (content.type === "web_search_result") {
        return [text([content.title, content.url, content.page_age ?? null].filter(Boolean).join("\n"))];
    }
    if (content.type === "web_fetch_result") {
        const documentParts = normalizeAnthropicToolResultParts([content.content]);
        if (documentParts.length > 0)
            return documentParts;
        return [text(content.url ?? "web_fetch_result")];
    }
    if (content.type === "tool_search_tool_search_result") {
        return [text((content.tool_references ?? []).map((tool) => tool.tool_name).join("\n"))];
    }
    return [text(JSON.stringify(content))];
}
function normalizeAnthropicToolResultParts(content) {
    if (!content)
        return [];
    if (typeof content === "string")
        return [text(content)];
    return content.map((block) => {
        if (block.type === "text")
            return text(block.text);
        if (block.type === "image")
            return { type: "image_url", url: block.source.type === "url" ? block.source.url : makeDataUrl(block.source.media_type, block.source.data) };
        if (block.type === "document") {
            if (block.source.type === "url")
                return { type: "document_url", url: block.source.url, title: block.title ?? null };
            if (block.source.type === "base64")
                return { type: "document_base64", data: block.source.data, mediaType: block.source.media_type, title: block.title ?? null };
            if (block.source.type === "text")
                return text(block.source.data);
        }
        fail(`Anthropic tool_result block "${block.type}" is not supported`);
    });
}
function normalizeAnthropicTool(tool) {
    if (!("input_schema" in tool))
        return undefined;
    if ("type" in tool && tool.type !== undefined && tool.type !== "function")
        return undefined;
    return {
        kind: "function",
        name: tool.name,
        description: "description" in tool ? tool.description : undefined,
        inputSchema: tool.input_schema ?? { type: "object" },
        strict: "strict" in tool ? tool.strict ?? null : null,
    };
}
function filterUnsupportedToolChoice(choice, tools) {
    if (!choice || choice.type !== "tool")
        return choice;
    if (!tools?.some((tool) => tool.kind === choice.kind && tool.name === choice.name))
        return undefined;
    return choice;
}
function normalizeAnthropicToolChoice(choice) {
    switch (choice.type) {
        case "auto":
            return { type: "auto", disableParallel: choice.disable_parallel_tool_use };
        case "any":
            return { type: "required", disableParallel: choice.disable_parallel_tool_use };
        case "none":
            return { type: "none" };
        case "tool":
            return { type: "tool", kind: "function", name: choice.name, disableParallel: choice.disable_parallel_tool_use };
    }
}
function denormalizeOpenAIChatMessage(message, imageEnabled) {
    switch (message.role) {
        case "system":
            return [{ role: "system", content: collapseText(requireTextOnly(message.parts, "Chat system message")) }];
        case "developer":
            return [{ role: "system", content: collapseText(requireTextOnly(message.parts, "Chat developer message")) }];
        case "user":
            return [{ role: "user", content: denormalizeOpenAIChatUserParts(message.parts, imageEnabled) }];
        case "assistant": {
            let content = denormalizeOpenAIChatAssistantParts(message.parts);
            const toolCalls = message.toolCalls?.map((toolCall) => denormalizeOpenAIChatToolCall(toolCall));
            const thinking = message.parts.filter((part) => part.type === "thinking").map((part) => part.thinking).filter(Boolean).join("\n");
            if (content === null && thinking)
                content = "";
            if (content === null && (!toolCalls || toolCalls.length === 0))
                return [];
            return [{
                    role: "assistant",
                    content,
                    refusal: message.parts.find((part) => part.type === "refusal")?.text ?? null,
                    ...(thinking ? { thinking, reasoning: thinking, reasoning_content: thinking } : {}),
                    // DeepSeek-compatible string-only chat mode may reject assistant history
                    // without a reasoning_content field, so keep an empty placeholder when
                    // model.image is false and there is no preserved thinking text.
                    ...(!imageEnabled && !thinking ? { reasoning_content: "", reasoning: "", thinking: "" } : {}),
                    tool_calls: toolCalls?.length ? toolCalls : null,
                }];
        }
        case "tool":
            return denormalizeOpenAIChatToolResultMessage(message, message.toolCallId ?? "tool", undefined, imageEnabled);
        case "function":
            return denormalizeOpenAIChatToolResultMessage(message, message.name ?? "function", message.name, imageEnabled);
    }
}
function denormalizeOpenAIChatUserParts(parts, imageEnabled) {
    const preserveImages = imageEnabled && parts.some((part) => part.type === "image_url");
    if (preserveImages) {
        return parts.map((part) => denormalizeOpenAIChatUserPart(part, true));
    }
    return parts.map((part) => stringifyOpenAIChatPart(part, "Chat user message")).filter(Boolean).join("\n");
}
function denormalizeOpenAIChatAssistantParts(parts) {
    if (parts.length === 0)
        return null;
    const chatParts = parts.filter(part => part.type === "text" || part.type === "refusal").map((part) => {
        if (part.type === "text")
            return { type: "text", text: part.text };
        return { type: "refusal", refusal: part.text };
    });
    if (chatParts.length === 0)
        return null;
    if (chatParts.every((part) => part.type === "text"))
        return chatParts.map((part) => part.text).join("\n");
    return chatParts;
}
function denormalizeOpenAIChatToolCall(toolCall) {
    return toolCall.kind === "function" ? { id: toolCall.id, type: "function", function: { name: toolCall.name, arguments: toolCall.payload } } : { id: toolCall.id, type: "custom", custom: { name: toolCall.name, input: toolCall.payload } };
}
function denormalizeOpenAIChatToolResultMessage(message, identifier, legacyFunctionName, imageEnabled = true) {
    if (message.parts.every((part) => part.type === "text" || part.type === "refusal")) {
        const content = collapseText(requireTextOnly(message.parts, legacyFunctionName ? "Chat function result" : "Chat tool result"));
        return legacyFunctionName
            ? [{ role: "function", name: legacyFunctionName, content }]
            : [{ role: "tool", tool_call_id: message.toolCallId ?? "", content }];
    }
    if (imageEnabled && message.parts.some((part) => part.type === "image_url")) {
        const textContent = message.parts
            .filter((part) => part.type === "text" || part.type === "refusal")
            .map((part) => part.text)
            .join("\n");
        const toolContent = textContent || "[multimedia tool result returned separately]";
        const imageContent = message.parts
            .filter((part) => part.type === "image_url")
            .map((part) => denormalizeOpenAIChatUserPart(part, true));
        return [
            legacyFunctionName
                ? { role: "function", name: legacyFunctionName, content: toolContent }
                : { role: "tool", tool_call_id: message.toolCallId ?? "", content: toolContent },
            ...(imageContent.length > 0 ? [{ role: "user", content: imageContent, __toolResultMedia: true }] : []),
        ];
    }
    // image=false fallback: keep tool/function role, drop multimedia content to avoid
    // huge base64 data URLs inflating context and breaking strict API role gateways.
    const textContent = message.parts
        .filter((part) => part.type === "text" || part.type === "refusal")
        .map((part) => part.text)
        .join("\n");
    const tag = (ptype) => ptype === "image_url" ? "image" :
        ptype === "input_audio" ? "audio" :
            ptype === "document_url" || ptype === "document_base64" ? "file" : ptype;
    const omittedTypes = [...new Set(message.parts.filter((p) => p.type !== "text" && p.type !== "refusal").map((p) => tag(p.type)))];
    const omittedNote = omittedTypes.length > 0 ? `\n[${omittedTypes.join(", ")} content omitted - not supported by current model]` : "";
    const content = (textContent + omittedNote) || `Tool result for ${identifier}: [multimedia content omitted - not supported by current model]`;
    return legacyFunctionName
        ? [{ role: "function", name: legacyFunctionName, content }]
        : [{ role: "tool", tool_call_id: message.toolCallId ?? "", content }];
}
function denormalizeOpenAIChatUserPart(part, preserveImages) {
    if (part.type === "text" || part.type === "refusal")
        return { type: "text", text: part.text };
    if (part.type === "image_url" && preserveImages)
        return { type: "image_url", image_url: { url: part.url, detail: part.detail } };
    return { type: "text", text: stringifyOpenAIChatPart(part, "Chat user message") };
}
function stringifyOpenAIChatPart(part, context) {
    if (part.type === "text" || part.type === "refusal")
        return part.text;
    if (part.type === "image_url")
        return part.detail ? `Attached image: ${part.url} (detail: ${part.detail})` : `Attached image: ${part.url}`;
    if (part.type === "input_audio")
        return `Attached audio (${part.format})`;
    if (part.type === "document_url" || part.type === "document_base64")
        return describeNormalizedDocumentPart(part);
    if (part.type === "thinking" || part.type === "redacted_thinking")
        return "";
    fail(`${context} cannot stringify part "${part.type}"`);
}
function describeNormalizedDocumentPart(part) {
    if (part.type === "document_url") {
        return part.title ? `Attached file: ${part.title} (${part.url})` : `Attached file URL: ${part.url}`;
    }
    return part.title ? `Attached file: ${part.title} (${part.mediaType ?? "application/octet-stream"})` : `Attached file content (${part.mediaType ?? "application/octet-stream"})`;
}
function denormalizeOpenAIResponsesToolOutput(parts, context) {
    const outputParts = parts.map((part) => {
        if (part.type === "text" || part.type === "refusal")
            return { type: "input_text", text: part.text };
        if (part.type === "image_url")
            return { type: "input_image", image_url: part.url, detail: part.detail };
        if (part.type === "document_url")
            return { type: "input_file", file_url: part.url, filename: part.title ?? undefined };
        if (part.type === "document_base64")
            return { type: "input_file", file_data: part.data, filename: part.title ?? undefined };
        fail(`${context} does not support part "${part.type}"`);
    });
    return outputParts.every((part) => part.type === "input_text") ? outputParts.map((part) => part.text).join("\n") : outputParts;
}
function denormalizeOpenAIResponsesMessage(message, preserveThinking) {
    switch (message.role) {
        case "system":
        case "developer":
        case "user": {
            const contentParts = message.parts
                .filter((part) => part.type !== "thinking" && part.type !== "redacted_thinking")
                .map((part) => {
                if (part.type === "text")
                    return { type: "input_text", text: part.text };
                if (part.type === "refusal")
                    return { type: "refusal", refusal: part.text };
                if (part.type === "image_url")
                    return { type: "input_image", image_url: part.url, detail: part.detail };
                if (part.type === "input_audio")
                    return { type: "input_audio", input_audio: { data: part.data, format: part.format } };
                if (part.type === "document_url")
                    return { type: "input_file", file_url: part.url, filename: part.title ?? undefined };
                return { type: "input_file", file_data: part.data, filename: part.title ?? undefined };
            });
            return contentParts.length > 0 ? [{ type: "message", role: message.role, content: contentParts }] : [];
        }
        case "assistant": {
            const contentParts = message.parts
                .filter((part) => part.type !== "thinking" && part.type !== "redacted_thinking")
                .map((part) => {
                if (part.type === "text")
                    return { type: "output_text", text: part.text, annotations: [] };
                if (part.type === "refusal")
                    return { type: "refusal", refusal: part.text };
                if (part.type === "image_url")
                    return { type: "input_image", image_url: part.url, detail: part.detail };
                if (part.type === "input_audio")
                    return { type: "input_audio", input_audio: { data: part.data, format: part.format } };
                if (part.type === "document_url")
                    return { type: "input_file", file_url: part.url, filename: part.title ?? undefined };
                return { type: "input_file", file_data: part.data, filename: part.title ?? undefined };
            });
            const toolCallItems = message.toolCalls?.map((toolCall) => {
                const { name, namespace } = splitQualifiedOpenAIResponsesToolName(toolCall.name);
                const isCustom = toolCall.kind === "custom" || (toolCall.kind === "function" && isResponsesCustomToolName(toolCall.name));
                return isCustom
                    ? {
                        type: "custom_tool_call",
                        call_id: toolCall.id,
                        name,
                        ...(namespace ? { namespace } : {}),
                        input: toolCall.kind === "custom" ? toolCall.payload : unwrapResponsesCustomToolInput(toolCall.payload),
                    }
                    : {
                        type: "function_call",
                        call_id: toolCall.id,
                        name,
                        ...(namespace ? { namespace } : {}),
                        arguments: toolCall.payload,
                    };
            }) ?? [];
            return [
                ...(contentParts.length > 0 || toolCallItems.length > 0 ? [{ type: "message", role: "assistant", content: contentParts }] : []),
                ...toolCallItems,
            ];
        }
        case "tool":
            return [{ type: "function_call_output", call_id: message.toolCallId ?? "", output: denormalizeOpenAIResponsesToolOutput(message.parts, "Responses tool result") }];
        case "function":
            return [{ type: "function_call_output", call_id: message.name ?? "function", output: denormalizeOpenAIResponsesToolOutput(message.parts, "Responses function result") }];
    }
}
function denormalizeAnthropicMessage(message, preserveThinking, ignoreInvalidHistory) {
    switch (message.role) {
        case "user":
            return [{ role: "user", content: denormalizeAnthropicUserParts(message.parts) }];
        case "assistant": {
            const content = denormalizeAnthropicAssistantParts(message, preserveThinking, ignoreInvalidHistory);
            return content.length > 0 ? [{ role: "assistant", content }] : [];
        }
        case "tool":
            return [{ role: "user", content: [{ type: "tool_result", tool_use_id: message.toolCallId ?? "", is_error: message.isError ?? false, content: denormalizeAnthropicToolResultParts(message.parts) }] }];
        case "function":
            return [{ role: "user", content: [{ type: "tool_result", tool_use_id: message.name ?? "function", is_error: message.isError ?? false, content: collapseText(requireTextOnly(message.parts, "Anthropic function result")) }] }];
        default:
            fail(`Anthropic Messages does not support role "${message.role}" in message array`);
    }
}
function denormalizeAnthropicUserParts(parts) {
    if (parts.length === 1 && parts[0].type === "text")
        return parts[0].text;
    return parts.map((part) => {
        if (part.type === "text")
            return { type: "text", text: part.text, cache_control: part.cacheControl };
        if (part.type === "image_url") {
            const dataUrl = parseDataUrl(part.url);
            return dataUrl ? { type: "image", source: { type: "base64", media_type: dataUrl.mediaType, data: dataUrl.data }, cache_control: part.cacheControl } : { type: "image", source: { type: "url", url: part.url }, cache_control: part.cacheControl };
        }
        if (part.type === "document_url")
            return { type: "document", title: part.title ?? undefined, source: { type: "url", url: part.url }, cache_control: part.cacheControl };
        if (part.type === "document_base64")
            return { type: "document", title: part.title ?? undefined, source: { type: "base64", media_type: part.mediaType ?? "application/pdf", data: part.data }, cache_control: part.cacheControl };
        fail(`Anthropic does not support user part "${part.type}"`);
    });
}
function denormalizeAnthropicAssistantParts(message, preserveThinking, ignoreInvalidHistory) {
    const blocks = message.parts.flatMap((part) => {
        if (part.type === "text" || part.type === "refusal")
            return { type: "text", text: part.text, citations: null };
        if (part.type === "thinking") {
            if (ignoreInvalidHistory && (part.signature === undefined || part.signature === null || part.signature === ""))
                return [];
            return [{ type: "thinking", thinking: part.thinking, signature: part.signature ?? "" }];
        }
        if (part.type === "redacted_thinking")
            return preserveThinking ? [{ type: "redacted_thinking", data: part.data }] : [];
        return { type: "text", text: collapseText([part]), citations: null };
    });
    for (const toolCall of message.toolCalls ?? []) {
        if (toolCall.kind !== "function")
            fail("Anthropic assistant output only supports function-style tool calls");
        blocks.push({ type: "tool_use", id: toolCall.id, caller: { type: "direct" }, name: toolCall.name, input: parseJson(toolCall.payload, `Anthropic tool call "${toolCall.name}"`) });
    }
    return blocks;
}
function denormalizeAnthropicToolResultParts(parts) {
    if (parts.every((part) => part.type === "text"))
        return collapseText(parts);
    return parts.map((part) => {
        if (part.type === "text")
            return { type: "text", text: part.text };
        if (part.type === "image_url") {
            const dataUrl = parseDataUrl(part.url);
            return dataUrl ? { type: "image", source: { type: "base64", media_type: dataUrl.mediaType, data: dataUrl.data } } : { type: "image", source: { type: "url", url: part.url } };
        }
        if (part.type === "document_url")
            return { type: "document", title: part.title ?? undefined, source: { type: "url", url: part.url } };
        if (part.type === "document_base64")
            return { type: "document", title: part.title ?? undefined, source: { type: "base64", media_type: part.mediaType ?? "application/pdf", data: part.data } };
        fail(`Anthropic tool_result does not support part "${part.type}"`);
    });
}
function denormalizeAnthropicTool(tool) {
    if (tool.kind !== "function")
        fail("Anthropic request conversion only supports function-style tools");
    return { name: tool.name, description: tool.description ?? undefined, input_schema: tool.inputSchema };
}
function denormalizeAnthropicToolChoice(choice, parallelToolCalls, hasTools) {
    const disableParallel = parallelToolCalls === undefined ? choice?.disableParallel : !parallelToolCalls;
    if (!choice) {
        if (disableParallel === undefined || !hasTools)
            return undefined;
        return { type: "auto", disable_parallel_tool_use: disableParallel };
    }
    if (choice.type === "auto")
        return { type: "auto", disable_parallel_tool_use: disableParallel };
    if (choice.type === "required")
        return { type: "any", disable_parallel_tool_use: disableParallel };
    if (choice.type === "none")
        return { type: "none" };
    if (choice.kind !== "function")
        fail("Anthropic tool_choice only supports function-style tools");
    return { type: "tool", name: choice.name, disable_parallel_tool_use: disableParallel };
}
function mergeAnthropicMessages(messages) {
    const merged = [];
    for (const message of messages) {
        const last = merged.at(-1);
        if (last && last.role === message.role) {
            const previous = typeof last.content === "string" ? [{ type: "text", text: last.content }] : last.content;
            const next = typeof message.content === "string" ? [{ type: "text", text: message.content }] : message.content;
            last.content = [...previous, ...next];
        }
        else {
            merged.push(message);
        }
    }
    return merged;
}
function reorderMessagesForAnthropicToolResults(messages) {
    const used = new Array(messages.length).fill(false);
    const reordered = [];
    for (let index = 0; index < messages.length; index += 1) {
        if (used[index])
            continue;
        const message = messages[index];
        used[index] = true;
        reordered.push(message);
        const pendingToolResultIds = getAnthropicPendingToolResultIds(message);
        if (pendingToolResultIds.size === 0)
            continue;
        // Collect consecutive assistants that also have tool calls so their
        // results land after the entire assistant group instead of splitting it.
        let groupEnd = index;
        for (let nextIdx = index + 1; nextIdx < messages.length; nextIdx += 1) {
            if (used[nextIdx])
                continue;
            const nextMsg = messages[nextIdx];
            if (nextMsg.role !== "assistant")
                break;
            if (nextMsg.toolCalls) {
                for (const tc of nextMsg.toolCalls) {
                    if (tc.kind === "function") {
                        pendingToolResultIds.add(tc.id);
                        if (tc.id.endsWith(":legacy"))
                            pendingToolResultIds.add(tc.name);
                    }
                }
            }
            used[nextIdx] = true;
            reordered.push(nextMsg);
            groupEnd = nextIdx;
        }
        for (let nextIndex = groupEnd + 1; nextIndex < messages.length; nextIndex += 1) {
            if (used[nextIndex])
                continue;
            const candidate = messages[nextIndex];
            const candidateToolResultId = getAnthropicToolResultId(candidate);
            if (!candidateToolResultId || !pendingToolResultIds.has(candidateToolResultId))
                continue;
            used[nextIndex] = true;
            reordered.push(candidate);
            pendingToolResultIds.delete(candidateToolResultId);
            if (pendingToolResultIds.size === 0)
                break;
        }
    }
    return reordered;
}
function ensureAnthropicMessagesEndWithUser(messages) {
    const last = messages.at(-1);
    if (!last || last.role === "user" || last.role === "tool" || last.role === "function")
        return messages;
    return [...messages, { role: "user", parts: [text("go on")] }];
}
function reorderMessagesForOpenAIChatToolResults(messages) {
    const used = new Array(messages.length).fill(false);
    const reordered = [];
    for (let index = 0; index < messages.length; index += 1) {
        if (used[index])
            continue;
        const message = messages[index];
        used[index] = true;
        reordered.push(message);
        const pendingToolResultIds = getOpenAIChatPendingToolResultIds(message);
        if (pendingToolResultIds.size === 0)
            continue;
        // Collect consecutive assistants that also have tool calls so their
        // results land after the entire assistant group instead of splitting it.
        let groupEnd = index;
        for (let nextIdx = index + 1; nextIdx < messages.length; nextIdx += 1) {
            if (used[nextIdx])
                continue;
            const nextMsg = messages[nextIdx];
            if (nextMsg.role !== "assistant")
                break;
            if (nextMsg.toolCalls) {
                for (const tc of nextMsg.toolCalls)
                    pendingToolResultIds.add(tc.id);
            }
            used[nextIdx] = true;
            reordered.push(nextMsg);
            groupEnd = nextIdx;
        }
        for (let nextIndex = groupEnd + 1; nextIndex < messages.length; nextIndex += 1) {
            if (used[nextIndex])
                continue;
            const candidate = messages[nextIndex];
            const candidateToolResultId = getOpenAIChatToolResultId(candidate);
            if (!candidateToolResultId || !pendingToolResultIds.has(candidateToolResultId))
                continue;
            used[nextIndex] = true;
            reordered.push(candidate);
            pendingToolResultIds.delete(candidateToolResultId);
            if (pendingToolResultIds.size === 0)
                break;
        }
    }
    return reordered;
}
function getOpenAIChatPendingToolResultIds(message) {
    if (message.role !== "assistant" || !message.toolCalls?.length)
        return new Set();
    return new Set(message.toolCalls.map((tc) => tc.id));
}
function getOpenAIChatToolResultId(message) {
    if (message.role === "tool")
        return message.toolCallId ?? undefined;
    return undefined;
}
function getAnthropicPendingToolResultIds(message) {
    if (message.role !== "assistant" || !message.toolCalls?.length)
        return new Set();
    const ids = message.toolCalls
        .filter((toolCall) => toolCall.kind === "function")
        .flatMap((toolCall) => (toolCall.id.endsWith(":legacy") ? [toolCall.id, toolCall.name] : [toolCall.id]));
    return new Set(ids);
}
function getAnthropicToolResultId(message) {
    if (message.role === "tool")
        return message.toolCallId ?? undefined;
    if (message.role === "function")
        return message.name ?? undefined;
    return undefined;
}
function denormalizeAnthropicMetadata(metadata) {
    if (!metadata)
        return undefined;
    const keys = Object.keys(metadata).filter((key) => metadata[key] !== undefined && metadata[key] !== null);
    if (keys.length === 0)
        return undefined;
    if (keys.length === 1 && keys[0] === "user_id" && typeof metadata.user_id === "string")
        return { user_id: metadata.user_id };
    fail("Anthropic metadata only supports user_id");
}
function denormalizeAnthropicOutputConfig(responseFormat, reasoningEffort, thinkingBudgetTokens) {
    const effort = reasoningEffort ?? normalizeReasoningEffortFromBudget(thinkingBudgetTokens);
    const format = responseFormat?.type === "json_schema" ? { type: "json_schema", schema: responseFormat.schema ?? {} } : undefined;
    if (!format && !effort)
        return undefined;
    return { ...(format ? { format } : {}), ...(effort ? { effort } : {}) };
}
function denormalizeAnthropicThinking(reasoningEffort, thinkingBudgetTokens) {
    if (!reasoningEffort && thinkingBudgetTokens == null)
        return undefined;
    return { type: "adaptive" };
}
function normalizeOpenAITargetReasoningEffort(reasoningEffort, thinkingBudgetTokens, target) {
    const effort = reasoningEffort ?? normalizeReasoningEffortFromBudget(thinkingBudgetTokens);
    if (effort === "max") {
        console.warn(`[CONVERTER] Mapping reasoning effort "max" to "xhigh" for ${target}; OpenAI does not support "max".`);
        return "xhigh";
    }
    return effort;
}
function normalizeOpenAIServiceTier(tier) {
    if (!tier)
        return undefined;
    if (["auto", "default", "flex", "scale", "priority"].includes(tier))
        return tier;
    fail(`OpenAI Chat does not support service tier "${tier}"`);
}
function normalizeOpenAIResponsesServiceTier(tier) {
    if (!tier)
        return undefined;
    if (["auto", "default", "flex", "scale", "priority"].includes(tier))
        return tier;
    fail(`OpenAI Responses does not support service tier "${tier}"`);
}
function normalizeAnthropicServiceTier(tier) {
    if (!tier)
        return undefined;
    if (tier === "auto")
        return "auto";
    if (tier === "default" || tier === "standard_only")
        return "standard_only";
    fail(`Anthropic does not support service tier "${tier}"`);
}
function denormalizeOpenAIChatResponseFormat(format) {
    if (!format)
        return undefined;
    if (format.type === "text" || format.type === "json_object")
        return { type: format.type };
    return { type: "json_schema", json_schema: { name: format.name, description: format.description, schema: format.schema, strict: format.strict ?? undefined } };
}
function denormalizeOpenAIResponsesFormat(format) {
    if (format.type === "text" || format.type === "json_object")
        return { type: format.type };
    return { type: "json_schema", name: format.name, description: format.description, schema: format.schema, strict: format.strict ?? undefined };
}
function denormalizeOpenAIResponsesTools(tools) {
    if (!tools?.length)
        return undefined;
    const denormalizedTools = [];
    const namespaceTools = new Map();
    for (const tool of tools) {
        const { name, namespace } = splitQualifiedOpenAIResponsesToolName(tool.name);
        const denormalizedTool = tool.kind === "function"
            ? { type: "function", name, description: tool.description ?? undefined, parameters: tool.inputSchema, strict: tool.strict ?? undefined }
            : { type: "custom", name, description: tool.description ?? undefined, format: tool.format };
        if (!namespace) {
            denormalizedTools.push(denormalizedTool);
            continue;
        }
        let namespaceTool = namespaceTools.get(namespace);
        if (!namespaceTool) {
            namespaceTool = {
                type: "namespace",
                name: namespace,
                description: "",
                tools: [],
            };
            namespaceTools.set(namespace, namespaceTool);
            denormalizedTools.push(namespaceTool);
        }
        namespaceTool.tools.push(denormalizedTool);
    }
    return denormalizedTools;
}
function denormalizeOpenAIChatToolChoice(choice) {
    if (!choice)
        return undefined;
    if (choice.type === "auto" || choice.type === "none" || choice.type === "required")
        return choice.type;
    return choice.kind === "function" ? { type: "function", function: { name: choice.name } } : { type: "custom", custom: { name: choice.name } };
}
function denormalizeOpenAIResponsesToolChoice(choice) {
    if (!choice)
        return undefined;
    if (choice.type === "auto" || choice.type === "none" || choice.type === "required")
        return choice.type;
    return choice.kind === "function" ? { type: "function", name: choice.name } : { type: "custom", name: choice.name };
}

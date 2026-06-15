import { denormalizeToAnthropicRequest, denormalizeToOpenAIChatRequest, denormalizeToOpenAIResponsesRequest, normalizeAnthropicRequest, normalizeOpenAIChatRequest, normalizeOpenAIResponsesRequest, } from "./requests.js";
import { denormalizeToAnthropicResponse, denormalizeToOpenAIChatResponse, denormalizeToOpenAIResponsesResponse, normalizeAnthropicResponse, normalizeOpenAIChatResponse, normalizeOpenAIResponsesResponse, } from "./responses.js";
export function chatParamsToResponsesRequest(request) {
    return denormalizeToOpenAIResponsesRequest(normalizeOpenAIChatRequest(request));
}
export function responsesRequestToChatParams(request) {
    const normalized = normalizeOpenAIResponsesRequest(request);
    normalized.image = request.image ?? true;
    return denormalizeToOpenAIChatRequest(normalized);
}
export function chatParamsToAnthropicMessageRequest(request, options) {
    return denormalizeToAnthropicRequest(normalizeOpenAIChatRequest(request), options);
}
export function anthropicMessageRequestToChatParams(request) {
    const normalized = normalizeAnthropicRequest(request);
    normalized.image = request.image ?? true;
    return denormalizeToOpenAIChatRequest(normalized);
}
export function responsesRequestToAnthropicMessageRequest(request, options) {
    return denormalizeToAnthropicRequest(normalizeOpenAIResponsesRequest(request), options);
}
export function anthropicMessageRequestToResponsesRequest(request) {
    return denormalizeToOpenAIResponsesRequest(normalizeAnthropicRequest(request));
}
export function chatCompletionToResponsesResponse(response) {
    return denormalizeToOpenAIResponsesResponse(normalizeOpenAIChatResponse(response));
}
export function responsesResponseToChatCompletion(response) {
    return denormalizeToOpenAIChatResponse(normalizeOpenAIResponsesResponse(response));
}
export function chatCompletionToAnthropicMessage(response) {
    return denormalizeToAnthropicResponse(normalizeOpenAIChatResponse(response));
}
export function anthropicMessageToChatCompletion(response) {
    return denormalizeToOpenAIChatResponse(normalizeAnthropicResponse(response));
}
export function responsesResponseToAnthropicMessage(response) {
    return denormalizeToAnthropicResponse(normalizeOpenAIResponsesResponse(response));
}
export function anthropicMessageToResponsesResponse(response) {
    return denormalizeToOpenAIResponsesResponse(normalizeAnthropicResponse(response));
}
// ─── Streaming ──────────────────────────────────────────────────────────────
export { createStreamConverter, createSSEConverter, createSSETransformStream, StreamConverter, SSEStreamConverter, SSEParser, formatSSE, formatDone, OpenAIChatStreamParser, OpenAIChatStreamEmitter, ResponsesStreamParser, ResponsesStreamEmitter, AnthropicStreamParser, AnthropicStreamEmitter, } from "./streams.js";

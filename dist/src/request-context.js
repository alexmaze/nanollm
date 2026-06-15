import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
const requestContext = new AsyncLocalStorage();
function formatTimestamp(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const milliseconds = String(date.getMilliseconds()).padStart(3, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
}
export function createRequestId() {
    return randomUUID();
}
export function runWithRequestId(requestId, callback) {
    return requestContext.run({ requestId, responsesCustomToolNames: new Set() }, callback);
}
export function getRequestId() {
    return requestContext.getStore()?.requestId;
}
export function markResponsesCustomToolName(name) {
    requestContext.getStore()?.responsesCustomToolNames.add(name);
}
export function isResponsesCustomToolName(name) {
    return requestContext.getStore()?.responsesCustomToolNames.has(name) ?? false;
}
export function withRequestId(message, fallbackRequestId) {
    const requestId = getRequestId() ?? fallbackRequestId;
    const timestamp = `[${formatTimestamp()}]`;
    return requestId ? `${timestamp} [requestId=${requestId.slice(0, 6)}] ${message}` : `${timestamp} ${message}`;
}

// @ts-nocheck
import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { randomUUID } from "node:crypto";
import { extractBasicCredentials, extractBearerToken, isAuthorizedBasic, isAuthorizedToken } from "./src/auth.js";
import { getAdminCredentials, getAuthToken, getPublicModelNames, isAuthEnabled, parseConfigText, parseSourceConfigDocument, resolveFallbackModels, resolveModel, resolveModelForRequest } from "./src/config.js";
import { ConfigManager } from "./src/config-manager.js";
import { getUpstreamURL, testUpstream } from "./src/proxy.js";
import { forwardRequest, forwardStreamRequest, passthroughRawRequest, passthroughRequest, passthroughStreamRequest } from "./src/proxy.js";
import { FallbackFailureTracker, sortFallbackGroupMembers } from "./src/fallback.js";
import { SqliteStatusStore, StatusStore } from "./src/status.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FRONTEND_DIST = (() => {
    const direct = join(__dirname, "frontend", "dist");
    if (existsSync(direct))
        return direct;
    return join(__dirname, "..", "frontend", "dist");
})();
import { getHTTPLogLevel, shouldEmitLog } from "./src/http-log.js";
import { normalizeOpenAIChatRequest, normalizeOpenAIResponsesRequest, normalizeAnthropicRequest, } from "./src/converters/requests.js";
import { denormalizeToOpenAIChatResponse, denormalizeToOpenAIResponsesResponse, denormalizeToAnthropicResponse, } from "./src/converters/responses.js";
import { createSSEConverter, createUsageCollector, SSEParser } from "./src/converters/streams.js";
import { createRequestId, getRequestId, runWithRequestId, withRequestId } from "./src/request-context.js";
import { cacheResponseItems, resolveItemReferences } from "./src/response-cache.js";
import { appendRecordedAttemptResponseBody, appendRecordedClientResponseBody, beginRecordedRequest, configureRecording, finalizeRecordedRequest, flushRecording, getRecordedRequest, getRecordSummary, startRecording, setRecordedClientResponseBody, setRecordedClientResponseMeta, setRecordedRequestError, useSqliteRecordStore, } from "./src/record.js";
import { shouldIgnoreStreamReadError } from "./src/stream-errors.js";
import { handleServerStartupError } from "./src/startup-error.js";
import { stringify as stringifyYAML } from "yaml";
// ─── Config ─────────────────────────────────────────────────────────────────
function resolveConfigPath(argv) {
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === "--config") {
            const value = argv[index + 1];
            if (!value)
                throw new Error("Missing value for --config");
            return { path: resolve(process.cwd(), value), source: "cli" };
        }
        if (arg.startsWith("--config=")) {
            const value = arg.slice("--config=".length);
            if (!value)
                throw new Error("Missing value for --config");
            return { path: resolve(process.cwd(), value), source: "cli" };
        }
    }
    if (process.env.CONFIG_PATH) {
        return { path: resolve(process.cwd(), process.env.CONFIG_PATH), source: "env" };
    }
    const cwdConfigPath = resolve(process.cwd(), "config.yaml");
    if (existsSync(cwdConfigPath)) {
        return { path: cwdConfigPath, source: "cwd" };
    }
    const xdgConfigHome = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
    const defaultConfigPath = join(xdgConfigHome, "nanollm", "config.yaml");
    if (existsSync(defaultConfigPath)) {
        return { path: defaultConfigPath, source: "default" };
    }
    throw new Error("Missing config file. Pass --config /path/to/config.yaml, set CONFIG_PATH, place config.yaml in the current directory, or place it at $XDG_CONFIG_HOME/nanollm/config.yaml (defaults to ~/.config/nanollm/config.yaml).");
}
function resolveStorageMode(argv) {
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        let value;
        if (arg === "--storage") {
            value = argv[index + 1];
            if (!value)
                throw new Error("Missing value for --storage");
        }
        else if (arg.startsWith("--storage=")) {
            value = arg.slice("--storage=".length);
            if (!value)
                throw new Error("Missing value for --storage");
        }
        if (value !== undefined) {
            if (value === "memory" || value === "sqlite")
                return value;
            throw new Error(`Invalid --storage value '${value}'. Expected 'memory' or 'sqlite'.`);
        }
    }
    return "memory";
}
async function openSqliteDatabase(dbPath) {
    mkdirSync(dirname(dbPath), { recursive: true });
    try {
        const sqlite = await import("node:sqlite");
        const db = new sqlite.DatabaseSync(dbPath);
        db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;
    `);
        return db;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to initialize SQLite storage. Use --storage memory or run nanollm with a Node.js version that supports node:sqlite. Cause: ${message}`);
    }
}
const startupArgs = process.argv.slice(2);
const configResolved = resolveConfigPath(startupArgs);
const configPath = configResolved.path;
const configSource = configResolved.source;
const storageMode = resolveStorageMode(startupArgs);
const sqlitePath = join(homedir(), ".nanollm", "nanollm.sqlite3");
const sqliteDb = storageMode === "sqlite" ? await openSqliteDatabase(sqlitePath) : undefined;
const configManager = new ConfigManager(configPath);
const startupSnapshot = configManager.getActiveSnapshot();
if (sqliteDb) {
    useSqliteRecordStore(sqliteDb);
}
startRecording({ maxSize: startupSnapshot.effectiveConfig.record.max_size });
configManager.onUpdate(({ snapshot }, source) => {
    configureRecording({ maxSize: snapshot.effectiveConfig.record.max_size });
    if (source !== "startup") {
        console.log(`[CONFIG APPLY] source=${source} models=${snapshot.effectiveConfig.models.length} fallback_groups=${Object.keys(snapshot.effectiveConfig.fallback).length} record_max_size=${snapshot.effectiveConfig.record.max_size}`);
    }
});
const app = new Hono();
const apiCors = cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
});
app.use("*", async (c, next) => {
    const requestId = getRequestId() ?? createRequestId();
    const started = Date.now();
    const logLevel = getHTTPLogLevel(c.req.path);
    const emitLog = (message) => {
        if (!shouldEmitLog(logLevel))
            return;
        console.log(message);
    };
    await runWithRequestId(requestId, async () => {
        emitLog(withRequestId(`[HTTP START] method=${c.req.method} path=${c.req.path}`));
        try {
            await next();
            const responseType = c.res.headers.get("content-type") ?? "";
            if (responseType.includes("text/event-stream")) {
                emitLog(withRequestId(`[HTTP STREAM START] method=${c.req.method} path=${c.req.path} status=${c.res.status} duration=${Date.now() - started}ms`));
            }
            else {
                emitLog(withRequestId(`[HTTP END] method=${c.req.method} path=${c.req.path} status=${c.res.status} duration=${Date.now() - started}ms`));
            }
        }
        catch (error) {
            console.error(orange(withRequestId(`[HTTP ERROR] method=${c.req.method} path=${c.req.path} duration=${Date.now() - started}ms`)), error);
            throw error;
        }
    });
});
app.use("*", async (c, next) => {
    if (c.req.path.startsWith("/admin/")) {
        return next();
    }
    return apiCors(c, next);
});
function getRouteAuthDimension(path) {
    if (path === "/health" || path === "/")
        return "none";
    if (path.startsWith("/admin") || path.startsWith("/status") || path.startsWith("/record"))
        return "admin";
    if (path.startsWith("/v1/"))
        return "api";
    return "none";
}
app.use("*", async (c, next) => {
    if (c.req.method === "OPTIONS") {
        return next();
    }
    const dimension = getRouteAuthDimension(c.req.path);
    if (dimension === "none") {
        return next();
    }
    const config = configManager.getActiveSnapshot().effectiveConfig;
    if (dimension === "admin") {
        const credentials = getAdminCredentials(config);
        if (!credentials) {
            return next();
        }
        const candidate = extractBasicCredentials(c.req.header("authorization"));
        if (isAuthorizedBasic(credentials, candidate)) {
            return next();
        }
        c.header("WWW-Authenticate", 'Basic realm="nanollm admin"');
        return c.json({ error: "Unauthorized" }, 401);
    }
    // api dimension
    const apiToken = getAuthToken(config);
    if (!apiToken) {
        return next();
    }
    const headerToken = extractBearerToken(c.req.header("authorization"));
    if (isAuthorizedToken(apiToken, headerToken)) {
        return next();
    }
    c.header("WWW-Authenticate", "Bearer");
    return c.json({ error: "Unauthorized" }, 401);
});
const fallbackFailureTracker = new FallbackFailureTracker();
const statusStore = sqliteDb ? new SqliteStatusStore(sqliteDb) : new StatusStore();
const ORANGE = "\x1b[38;5;214m";
const RESET = "\x1b[0m";
function writeConfigAtomic(path, text) {
    const tempPath = `${path}.${randomUUID()}.tmp`;
    writeFileSync(tempPath, text, "utf-8");
    renameSync(tempPath, path);
}
function toInputString(value) {
    return value === undefined || value === null ? "" : String(value);
}
function toPositiveIntegerOrUndefined(value, fieldName) {
    if (value === undefined || value === null || value === "")
        return undefined;
    const normalized = Number(value);
    if (!Number.isInteger(normalized) || normalized <= 0) {
        throw new Error(`'${fieldName}' must be a positive integer`);
    }
    return normalized;
}
function toPlainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
}
function buildAdminConfigForm(rawText) {
    const sourceConfig = parseSourceConfigDocument(rawText);
    const { server, record, models, fallback, ...rootExtras } = sourceConfig;
    const serverObject = toPlainObject(server);
    const recordObject = toPlainObject(record);
    const { port, ttfb_timeout, ...serverExtras } = serverObject;
    const { max_size, ...recordExtras } = recordObject;
    return {
        rootExtras,
        serverExtras,
        recordExtras,
        server: {
            port: toInputString(port),
            ttfb_timeout: toInputString(ttfb_timeout),
        },
        record: {
            max_size: toInputString(max_size),
        },
        models: Array.isArray(models)
            ? models.map((entry) => {
                const modelObject = toPlainObject(entry);
                const { name, provider, base_url, api_key, model, ...extras } = modelObject;
                return {
                    name: toInputString(name),
                    provider: toInputString(provider),
                    base_url: toInputString(base_url),
                    api_key: toInputString(api_key),
                    model: toInputString(model),
                    extras,
                };
            })
            : [],
        fallbackGroups: fallback && typeof fallback === "object" && !Array.isArray(fallback)
            ? Object.entries(fallback).map(([name, members]) => ({
                name,
                members: Array.isArray(members) ? members.map((member) => toInputString(member)).filter(Boolean) : [],
            }))
            : [],
    };
}
function buildAdminConfigFormFromEffectiveConfig(config) {
    return {
        rootExtras: {},
        serverExtras: {},
        recordExtras: {},
        server: {
            port: toInputString(config.port),
            ttfb_timeout: toInputString(config.ttfb_timeout),
        },
        record: {
            max_size: toInputString(config.record.max_size),
        },
        models: config.models.map((model) => {
            const { name, provider, base_url, api_key, model: modelName, ...extras } = model;
            return {
                name,
                provider,
                base_url,
                api_key,
                model: modelName,
                extras,
            };
        }),
        fallbackGroups: Object.entries(config.fallback).map(([name, members]) => ({
            name,
            members,
        })),
    };
}
function buildYamlTextFromAdminForm(form, options) {
    const root = toPlainObject(form.rootExtras);
    const serverExtras = toPlainObject(form.serverExtras);
    const recordExtras = toPlainObject(form.recordExtras);
    const preservedPort = toPositiveIntegerOrUndefined(options?.preservedPort, "server.port");
    const serverTTFBTimeout = toPositiveIntegerOrUndefined(form.server?.ttfb_timeout, "server.ttfb_timeout");
    const recordMaxSize = toPositiveIntegerOrUndefined(form.record?.max_size, "record.max_size");
    const models = Array.isArray(form.models)
        ? form.models.map((entry) => ({
            ...toPlainObject(entry.extras),
            name: entry.name ?? "",
            provider: entry.provider ?? "",
            base_url: entry.base_url ?? "",
            api_key: entry.api_key ?? "",
            model: entry.model ?? "",
        }))
        : [];
    const fallbackGroups = Object.fromEntries((Array.isArray(form.fallbackGroups) ? form.fallbackGroups : [])
        .filter((group) => group && typeof group.name === "string" && group.name.trim())
        .map((group) => [
        group.name.trim(),
        (Array.isArray(group.members) ? group.members : []).map((member) => String(member).trim()).filter(Boolean),
    ]));
    const document = { ...root };
    if (Object.keys(serverExtras).length > 0 || preservedPort !== undefined || serverTTFBTimeout !== undefined) {
        document.server = {
            ...serverExtras,
            ...(preservedPort !== undefined ? { port: preservedPort } : {}),
            ...(serverTTFBTimeout !== undefined ? { ttfb_timeout: serverTTFBTimeout } : {}),
        };
    }
    if (Object.keys(recordExtras).length > 0 || recordMaxSize !== undefined) {
        document.record = {
            ...recordExtras,
            ...(recordMaxSize !== undefined ? { max_size: recordMaxSize } : {}),
        };
    }
    document.models = models;
    if (Object.keys(fallbackGroups).length > 0) {
        document.fallback = fallbackGroups;
    }
    else if ("fallback" in document) {
        delete document.fallback;
    }
    return stringifyYAML(document, {
        lineWidth: 0,
        defaultStringType: "PLAIN",
    });
}
function getNormalizer(format) {
    switch (format) {
        case "openai-chat":
            return normalizeOpenAIChatRequest;
        case "openai-responses":
            return normalizeOpenAIResponsesRequest;
        case "anthropic":
            return normalizeAnthropicRequest;
        case "openai-image":
            throw new Error("openai-image does not support protocol conversion");
    }
}
function getDenormalizer(format) {
    switch (format) {
        case "openai-chat":
            return denormalizeToOpenAIChatResponse;
        case "openai-responses":
            return denormalizeToOpenAIResponsesResponse;
        case "anthropic":
            return denormalizeToAnthropicResponse;
        case "openai-image":
            throw new Error("openai-image does not support protocol conversion");
    }
}
function extractModel(body) {
    const b = body;
    return b.model ?? undefined;
}
function isStreamRequest(body) {
    const b = body;
    return b.stream === true;
}
async function readImageRequestBody(c) {
    const contentType = c.req.header("content-type") ?? "";
    const request = c.req.raw.clone();
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (contentType.toLowerCase().includes("multipart/form-data")) {
        const formData = await c.req.raw.clone().formData();
        const recorded = {};
        for (const [key, value] of formData.entries()) {
            const item = typeof File !== "undefined" && value instanceof File
                ? { type: "file", name: value.name, mediaType: value.type, size: value.size }
                : value;
            const current = recorded[key];
            if (current === undefined) {
                recorded[key] = item;
            }
            else if (Array.isArray(current)) {
                current.push(item);
            }
            else {
                recorded[key] = [current, item];
            }
        }
        return { bytes, recordedBody: recorded };
    }
    const text = new TextDecoder().decode(bytes);
    if (contentType.toLowerCase().includes("application/json")) {
        try {
            return { bytes, recordedBody: JSON.parse(text) };
        }
        catch { }
    }
    return { bytes, recordedBody: text };
}
function orange(message) {
    return `${ORANGE}${message}${RESET}`;
}
function getCandidateModels(config, primaryModel) {
    const now = Date.now();
    const isFallbackGroup = primaryModel in config.fallback;
    if (isFallbackGroup) {
        return sortFallbackGroupMembers(resolveFallbackModels(config, primaryModel), (name) => fallbackFailureTracker.getFailureCount(name, now))
            .map((name) => resolveModel(config, name))
            .filter((model) => Boolean(model));
    }
    const match = resolveModelForRequest(config, primaryModel);
    return match ? [match.model] : [];
}
async function executeModelRequest(modelConfig, incomingFormat, rawBody, stream, upstreamOptions) {
    const sameFormat = incomingFormat === modelConfig.provider;
    if (sameFormat) {
        if (stream) {
            const { body, headers, timing } = await passthroughStreamRequest(modelConfig, rawBody, upstreamOptions);
            return { kind: "stream", body, headers, upstreamFormat: modelConfig.provider, timing };
        }
        const { json, timing, usage } = await passthroughRequest(modelConfig, rawBody, upstreamOptions);
        return { kind: "json", json, timing, usage };
    }
    const normalize = getNormalizer(incomingFormat);
    const denormalize = getDenormalizer(incomingFormat);
    const normalized = normalize(rawBody);
    if (stream) {
        const result = await forwardStreamRequest(modelConfig, normalized, upstreamOptions);
        return { kind: "stream", ...result };
    }
    const { normalizedResponse, timing, usage } = await forwardRequest(modelConfig, normalized, upstreamOptions);
    return { kind: "json", json: denormalize(normalizedResponse), timing, usage };
}
const HOP_BY_HOP_HEADERS = new Set([
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "content-length",
    "content-encoding",
]);
function tryParseJSON(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return text;
    }
}
const REPLAY_ALLOWED_PATHS = new Set(["/v1/chat/completions", "/v1/responses", "/v1/messages"]);
const REPLAY_PASSTHROUGH_HEADERS = new Set(["content-type", "user-agent"]);
const REPLAY_HEADER_OVERRIDES = new Set([
    "authorization",
    "cookie",
    "host",
    "content-length",
    "connection",
    "accept-encoding",
    "x-api-key",
    "x-nanollm-replay-of",
]);
function buildReplayHeaders(record, authToken) {
    const headers = new Headers();
    for (const [key, value] of Object.entries(record.clientRequest.headers ?? {})) {
        const normalized = key.toLowerCase();
        if (REPLAY_HEADER_OVERRIDES.has(normalized) || !REPLAY_PASSTHROUGH_HEADERS.has(normalized))
            continue;
        if (value === "[REDACTED]")
            continue;
        headers.set(key, value);
    }
    if (!headers.has("content-type")) {
        headers.set("content-type", "application/json");
    }
    headers.set("x-nanollm-replay-of", record.requestId);
    if (authToken) {
        headers.set("authorization", `Bearer ${authToken}`);
    }
    return headers;
}
async function replayRecordedRequest(record, config) {
    const path = record.clientRequest.path;
    if (!REPLAY_ALLOWED_PATHS.has(path)) {
        return {
            ok: false,
            status: 400,
            body: { error: `Replay is not supported for path '${path}'` },
        };
    }
    if (record.clientRequest.status === "in_progress") {
        return {
            ok: false,
            status: 409,
            body: { error: "Cannot replay an in-progress request" },
        };
    }
    const replayRequestId = createRequestId();
    const headers = buildReplayHeaders(record, getAuthToken(config));
    const response = await runWithRequestId(replayRequestId, async () => app.fetch(new Request(`http://127.0.0.1:${config.port}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(record.clientRequest.body ?? {}),
    })));
    const text = await response.text();
    const body = text ? tryParseJSON(text) : null;
    return {
        ok: response.ok,
        status: response.status,
        body,
        requestId: replayRequestId,
    };
}
function buildStatusPayload(config) {
    const availableWindows = [1, 3, 6];
    const now = Date.now();
    return {
        availableWindows,
        defaultWindowHours: 1,
        refreshedAt: now,
        bucketStarts: statusStore.listBuckets(),
        models: config.models.map((model) => ({
            name: model.name,
            series: statusStore.getModelSeries(model.name),
        })),
        fallbackGroups: Object.entries(config.fallback).map(([name, members]) => ({
            name,
            members: sortFallbackGroupMembers(members, (memberName) => fallbackFailureTracker.getFailureCount(memberName, now)),
        })),
    };
}
function buildRecordQueryPayload(requestIdOrPrefix) {
    const record = getRecordedRequest(requestIdOrPrefix);
    return {
        summary: getRecordSummary(),
        ...(record ? { record } : {}),
    };
}
function buildConfigAdminPayload() {
    const snapshot = configManager.getActiveSnapshot();
    let form;
    try {
        form = buildAdminConfigForm(snapshot.rawText);
    }
    catch {
        form = buildAdminConfigFormFromEffectiveConfig(snapshot.effectiveConfig);
    }
    const port = snapshot.effectiveConfig.port;
    return {
        ...snapshot,
        configPath,
        form,
        endpoints: [
            { method: "POST", path: "/v1/chat/completions", protocol: "OpenAI Chat", description: "OpenAI Chat Completions 兼容协议" },
            { method: "POST", path: "/v1/responses", protocol: "OpenAI Responses", description: "OpenAI Responses API 兼容协议" },
            { method: "POST", path: "/v1/messages", protocol: "Anthropic", description: "Anthropic Messages 兼容协议" },
            { method: "POST", path: "/v1/images/generations", protocol: "OpenAI Image", description: "OpenAI 图像生成" },
            { method: "POST", path: "/v1/images/edits", protocol: "OpenAI Image", description: "OpenAI 图像编辑" },
            { method: "GET", path: "/v1/models", protocol: "OpenAI", description: "列出所有可用模型" },
        ],
        port,
    };
}
// ─── Route Factory ──────────────────────────────────────────────────────────
function createRoute(incomingFormat) {
    return async (c) => {
        const snapshot = configManager.getActiveSnapshot();
        const config = snapshot.effectiveConfig;
        const userAgent = c.req.header("user-agent");
        const upstreamOptions = { userAgent };
        const rawBody = await c.req.json();
        const modelName = extractModel(rawBody);
        const stream = isStreamRequest(rawBody);
        const requestId = getRequestId();
        if (requestId) {
            beginRecordedRequest({
                requestId,
                path: c.req.path,
                headers: c.req.raw.headers,
                body: rawBody,
                stream,
            });
        }
        if (!modelName) {
            const response = c.json({ error: "Missing 'model' in request body" }, 400);
            setRecordedRequestError({ message: "Missing 'model' in request body" });
            setRecordedClientResponseMeta({ status: response.status, headers: response.headers });
            setRecordedClientResponseBody({ body: { error: "Missing 'model' in request body" } });
            finalizeRecordedRequest({});
            return response;
        }
        const candidateModels = getCandidateModels(config, modelName);
        if (candidateModels.length === 0) {
            const errorBody = { error: `Model '${modelName}' not found in config`, available: getPublicModelNames(config) };
            const response = c.json(errorBody, 404);
            setRecordedRequestError({ message: errorBody.error });
            setRecordedClientResponseMeta({ status: response.status, headers: response.headers });
            setRecordedClientResponseBody({ body: errorBody });
            finalizeRecordedRequest({});
            return response;
        }
        // Resolve item_reference for Responses API requests
        if (incomingFormat === "openai-responses" && Array.isArray(rawBody.input)) {
            rawBody.input = resolveItemReferences(rawBody.input);
        }
        let lastError;
        try {
            for (const [candidateIndex, modelConfig] of candidateModels.entries()) {
                const requestStartedAt = Date.now();
                statusStore.recordAttempt(modelConfig.name, requestStartedAt);
                console.log(withRequestId(`[REQUEST] model=${modelName} path=${c.req.path} target=${getUpstreamURL(modelConfig)} candidate=${modelConfig.name}`));
                try {
                    const result = await executeModelRequest(modelConfig, incomingFormat, rawBody, stream, {
                        ...upstreamOptions,
                        attemptIndex: candidateIndex + 1,
                        modelName: modelConfig.name,
                    });
                    if (result.kind === "stream") {
                        const { body, upstreamFormat, timing } = result;
                        const responseHeaders = {
                            "Content-Type": "text/event-stream",
                            "Cache-Control": "no-cache",
                            "Connection": "keep-alive",
                            "X-Accel-Buffering": "no",
                        };
                        if (upstreamFormat === incomingFormat && "headers" in result) {
                            for (const [key, value] of result.headers.entries()) {
                                if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
                                    responseHeaders[key] = value;
                                }
                            }
                        }
                        const readable = buildStreamReadable(body, incomingFormat, upstreamFormat, c.req.path, modelConfig.name, timing, candidateIndex + 1);
                        const response = new Response(readable, { headers: responseHeaders });
                        setRecordedClientResponseMeta({ status: response.status, headers: response.headers });
                        return response;
                    }
                    statusStore.recordSuccess(modelConfig.name, Date.now() - requestStartedAt, result.timing.ttfbMs, result.usage, requestStartedAt);
                    cacheResponseItems(result.json?.output);
                    const response = c.json(result.json);
                    setRecordedClientResponseMeta({ status: response.status, headers: response.headers });
                    setRecordedClientResponseBody({ body: result.json });
                    finalizeRecordedRequest({});
                    return response;
                }
                catch (error) {
                    const err = error;
                    fallbackFailureTracker.recordFailure(modelConfig.name, requestStartedAt);
                    statusStore.recordFailure(modelConfig.name, Date.now() - requestStartedAt, requestStartedAt);
                    lastError = err;
                    console.warn(orange(withRequestId(`[MODEL FAILED] requested=${modelName} candidate=${modelConfig.name} path=${c.req.path} target=${getUpstreamURL(modelConfig)} message=${err.message}`)));
                    if (modelConfig.name !== candidateModels.at(-1)?.name) {
                        console.warn(orange(withRequestId(`[FALLBACK] ${modelConfig.name} failed, trying next candidate`)));
                    }
                }
            }
        }
        catch (error) {
            lastError = error;
        }
        if (lastError) {
            console.error(orange(withRequestId(`[proxy error] ${lastError.message}`)), lastError.cause ?? "");
            const status = lastError.status || 500;
            setRecordedRequestError({ message: lastError.message || "Request failed" });
            const errorBody = {
                error: lastError.message || "Request failed",
                ...(lastError.upstream ? { upstream: tryParseJSON(lastError.upstream) } : {}),
            };
            const response = c.json(errorBody, status);
            setRecordedClientResponseMeta({ status: response.status, headers: response.headers });
            setRecordedClientResponseBody({ body: errorBody });
            finalizeRecordedRequest({});
            return response;
        }
        setRecordedRequestError({ message: "Request failed" });
        const response = c.json({ error: "Request failed" }, 500);
        setRecordedClientResponseMeta({ status: response.status, headers: response.headers });
        setRecordedClientResponseBody({ body: { error: "Request failed" } });
        finalizeRecordedRequest({});
        return response;
    };
}
function createImageRoute(imageOperation) {
    return async (c) => {
        const snapshot = configManager.getActiveSnapshot();
        const config = snapshot.effectiveConfig;
        const userAgent = c.req.header("user-agent");
        const upstreamOptions = { userAgent };
        const { bytes, recordedBody } = await readImageRequestBody(c);
        const modelName = extractModel(recordedBody);
        const requestId = getRequestId();
        if (requestId) {
            beginRecordedRequest({
                requestId,
                path: c.req.path,
                headers: c.req.raw.headers,
                body: recordedBody,
                stream: false,
            });
        }
        if (!modelName) {
            const response = c.json({ error: "Missing 'model' in request body" }, 400);
            setRecordedRequestError({ message: "Missing 'model' in request body" });
            setRecordedClientResponseMeta({ status: response.status, headers: response.headers });
            setRecordedClientResponseBody({ body: { error: "Missing 'model' in request body" } });
            finalizeRecordedRequest({});
            return response;
        }
        const candidateModels = getCandidateModels(config, modelName);
        if (candidateModels.length === 0) {
            const errorBody = { error: `Model '${modelName}' not found in config`, available: getPublicModelNames(config) };
            const response = c.json(errorBody, 404);
            setRecordedRequestError({ message: errorBody.error });
            setRecordedClientResponseMeta({ status: response.status, headers: response.headers });
            setRecordedClientResponseBody({ body: errorBody });
            finalizeRecordedRequest({});
            return response;
        }
        let lastError;
        try {
            for (const [candidateIndex, modelConfig] of candidateModels.entries()) {
                const requestStartedAt = Date.now();
                statusStore.recordAttempt(modelConfig.name, requestStartedAt);
                console.log(withRequestId(`[REQUEST] model=${modelName} path=${c.req.path} target=${getUpstreamURL(modelConfig)} candidate=${modelConfig.name}`));
                try {
                    if (modelConfig.provider !== "openai-image") {
                        throw Object.assign(new Error(`Model '${modelConfig.name}' provider '${modelConfig.provider}' cannot handle image requests`), {
                            status: 400,
                        });
                    }
                    const result = await passthroughRawRequest(modelConfig, bytes, c.req.raw.headers, {
                        ...upstreamOptions,
                        attemptIndex: candidateIndex + 1,
                        modelName: modelConfig.name,
                        imageOperation,
                        recordedRequestBody: recordedBody,
                    });
                    statusStore.recordSuccess(modelConfig.name, Date.now() - requestStartedAt, result.timing.ttfbMs, undefined, requestStartedAt);
                    const responseHeaders = {};
                    for (const [key, value] of result.headers.entries()) {
                        if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
                            responseHeaders[key] = value;
                        }
                    }
                    const response = new Response(result.responseText, { status: result.status, headers: responseHeaders });
                    setRecordedClientResponseMeta({ status: response.status, headers: response.headers });
                    setRecordedClientResponseBody({ body: result.body });
                    finalizeRecordedRequest({});
                    return response;
                }
                catch (error) {
                    const err = error;
                    fallbackFailureTracker.recordFailure(modelConfig.name, requestStartedAt);
                    statusStore.recordFailure(modelConfig.name, Date.now() - requestStartedAt, requestStartedAt);
                    lastError = err;
                    console.warn(orange(withRequestId(`[MODEL FAILED] requested=${modelName} candidate=${modelConfig.name} path=${c.req.path} target=${getUpstreamURL(modelConfig)} message=${err.message}`)));
                }
            }
            if (lastError) {
                setRecordedRequestError({ message: lastError.message });
                const status = lastError.status && lastError.status >= 400 && lastError.status < 600 ? lastError.status : 502;
                const errorBody = {
                    error: lastError.message,
                    ...(lastError.upstream ? { upstream: lastError.upstream } : {}),
                };
                const response = c.json(errorBody, status);
                setRecordedClientResponseMeta({ status: response.status, headers: response.headers });
                setRecordedClientResponseBody({ body: errorBody });
                finalizeRecordedRequest({});
                return response;
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setRecordedRequestError({ message });
            const response = c.json({ error: message }, 500);
            setRecordedClientResponseMeta({ status: response.status, headers: response.headers });
            setRecordedClientResponseBody({ body: { error: message } });
            finalizeRecordedRequest({});
            return response;
        }
        setRecordedRequestError({ message: "Request failed" });
        const response = c.json({ error: "Request failed" }, 500);
        setRecordedClientResponseMeta({ status: response.status, headers: response.headers });
        setRecordedClientResponseBody({ body: { error: "Request failed" } });
        finalizeRecordedRequest({});
        return response;
    };
}
function buildStreamReadable(body, incomingFormat, upstreamFormat, path, modelName, timing, attemptIndex) {
    if (incomingFormat === "openai-responses") {
        return buildPipeStreamAndCache(body, path, modelName, timing, upstreamFormat, attemptIndex, upstreamFormat !== incomingFormat ? createSSEConverter(upstreamFormat, incomingFormat) : undefined);
    }
    if (upstreamFormat === incomingFormat) {
        return buildPipeStreamAndCache(body, path, modelName, timing, upstreamFormat, attemptIndex);
    }
    // Convert stream format
    const converter = createSSEConverter(upstreamFormat, incomingFormat);
    const usageCollector = createUsageCollector(upstreamFormat);
    const reader = body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const started = Date.now();
    let cancelled = false;
    let finished = false;
    let successRecorded = false;
    let recordFinalized = false;
    const cachedRequestId = getRequestId();
    let cancelPromise;
    function settleSuccess(usage) {
        if (successRecorded)
            return;
        successRecorded = true;
        const totalDuration = Date.now() - timing.startedAt;
        const streamDuration = totalDuration - timing.ttfbMs;
        statusStore.recordSuccess(modelName, totalDuration, timing.ttfbMs, usage, timing.startedAt, streamDuration);
    }
    function finalizeRecord() {
        if (recordFinalized)
            return;
        recordFinalized = true;
        finalizeRecordedRequest({});
    }
    return new ReadableStream({
        async pull(controller) {
            if (finished)
                return;
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        finished = true;
                        if (cancelled)
                            return;
                        for (const chunk of converter.flush()) {
                            const outboundText = typeof chunk === "string" ? chunk : decoder.decode(chunk);
                            appendRecordedClientResponseBody({ chunk: outboundText });
                            controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
                        }
                        const usage = usageCollector.finish();
                        settleSuccess(usage);
                        finalizeRecord();
                        console.log(withRequestId(`[HTTP STREAM END] path=${path} duration=${Date.now() - started}ms`));
                        controller.close();
                        return;
                    }
                    const text = decoder.decode(value, { stream: true });
                    appendRecordedAttemptResponseBody({ index: attemptIndex, chunk: text });
                    usageCollector.push(text);
                    for (const chunk of converter.push(text)) {
                        if (cancelled)
                            return;
                        const outboundText = typeof chunk === "string" ? chunk : decoder.decode(chunk);
                        appendRecordedClientResponseBody({ chunk: outboundText });
                        controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
                    }
                }
            }
            catch (error) {
                finished = true;
                const completed = usageCollector.hasCompleted();
                if (shouldIgnoreStreamReadError(error, { cancelled, completed })) {
                    if (completed) {
                        settleSuccess(usageCollector.getLatestUsage());
                        finalizeRecord();
                        console.log(withRequestId(`[HTTP STREAM END] path=${path} duration=${Date.now() - started}ms (reader released after completion)`));
                        try {
                            controller.close();
                        }
                        catch { }
                    }
                    return;
                }
                statusStore.recordFailure(modelName, Date.now() - timing.startedAt, timing.startedAt);
                finalizeRecord();
                console.error(orange(withRequestId(`[HTTP STREAM ERROR] path=${path} duration=${Date.now() - started}ms`)), error);
                controller.error(error);
            }
        },
        cancel(reason) {
            if (cancelled || finished)
                return cancelPromise;
            cancelled = true;
            if (usageCollector.hasCompleted()) {
                settleSuccess(usageCollector.getLatestUsage());
                finalizeRecord();
                console.log(withRequestId(`[HTTP STREAM END] path=${path} duration=${Date.now() - started}ms (client closed after completion)`, cachedRequestId));
            }
            else {
                finalizeRecord();
                console.warn(withRequestId(`[HTTP STREAM CANCEL] path=${path} duration=${Date.now() - started}ms`, cachedRequestId));
            }
            cancelPromise = reader.cancel(reason).catch((error) => {
                console.warn(withRequestId(`[HTTP STREAM CANCEL ERROR] path=${path} duration=${Date.now() - started}ms`, cachedRequestId), error);
            });
            return cancelPromise;
        },
    });
}
/**
 * Pipe upstream SSE stream, optionally converting format.
 * Caches output items from response.output_item.done events.
 */
function buildPipeStreamAndCache(body, path, modelName, timing, streamFormat, attemptIndex, converter) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    const collector = new SSEParser();
    const usageCollector = createUsageCollector(streamFormat);
    const outputItems = [];
    const encoder = new TextEncoder();
    const started = Date.now();
    let cancelled = false;
    let finished = false;
    let successRecorded = false;
    let recordFinalized = false;
    const cachedRequestId = getRequestId();
    let cancelPromise;
    function collectItems(sseText) {
        for (const { data } of collector.push(sseText)) {
            try {
                const event = JSON.parse(data);
                if (event.type === "response.output_item.done" && event.item) {
                    outputItems.push(event.item);
                }
            }
            catch { }
        }
    }
    function settleSuccess(usage) {
        if (successRecorded)
            return;
        successRecorded = true;
        const totalDuration = Date.now() - timing.startedAt;
        const streamDuration = totalDuration - timing.ttfbMs;
        statusStore.recordSuccess(modelName, totalDuration, timing.ttfbMs, usage, timing.startedAt, streamDuration);
    }
    function finalizeRecord() {
        if (recordFinalized)
            return;
        recordFinalized = true;
        finalizeRecordedRequest({});
    }
    return new ReadableStream({
        async pull(controller) {
            if (finished)
                return;
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        finished = true;
                        if (cancelled)
                            return;
                        if (converter) {
                            for (const chunk of converter.flush()) {
                                const outboundText = typeof chunk === "string" ? chunk : decoder.decode(chunk);
                                collectItems(outboundText);
                                appendRecordedClientResponseBody({ chunk: outboundText });
                                controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
                            }
                        }
                        for (const { data } of collector.flush()) {
                            try {
                                const event = JSON.parse(data);
                                if (event.type === "response.output_item.done" && event.item) {
                                    outputItems.push(event.item);
                                }
                            }
                            catch { }
                        }
                        cacheResponseItems(outputItems);
                        const usage = usageCollector.finish();
                        settleSuccess(usage);
                        finalizeRecord();
                        console.log(withRequestId(`[HTTP STREAM END] path=${path} duration=${Date.now() - started}ms`));
                        controller.close();
                        return;
                    }
                    const text = decoder.decode(value, { stream: true });
                    appendRecordedAttemptResponseBody({ index: attemptIndex, chunk: text });
                    usageCollector.push(text);
                    if (converter) {
                        for (const chunk of converter.push(text)) {
                            if (cancelled)
                                return;
                            const outboundText = typeof chunk === "string" ? chunk : decoder.decode(chunk);
                            collectItems(outboundText);
                            appendRecordedClientResponseBody({ chunk: outboundText });
                            controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
                        }
                    }
                    else {
                        if (cancelled)
                            return;
                        collectItems(text);
                        appendRecordedClientResponseBody({ chunk: text });
                        controller.enqueue(value);
                    }
                }
            }
            catch (error) {
                finished = true;
                const completed = usageCollector.hasCompleted();
                if (shouldIgnoreStreamReadError(error, { cancelled, completed })) {
                    if (completed) {
                        settleSuccess(usageCollector.getLatestUsage());
                        finalizeRecord();
                        console.log(withRequestId(`[HTTP STREAM END] path=${path} duration=${Date.now() - started}ms (reader released after completion)`));
                        try {
                            controller.close();
                        }
                        catch { }
                    }
                    return;
                }
                statusStore.recordFailure(modelName, Date.now() - timing.startedAt, timing.startedAt);
                finalizeRecord();
                console.error(orange(withRequestId(`[HTTP STREAM ERROR] path=${path} duration=${Date.now() - started}ms`)), error);
                controller.error(error);
            }
        },
        cancel(reason) {
            if (cancelled || finished)
                return cancelPromise;
            cancelled = true;
            if (usageCollector.hasCompleted()) {
                settleSuccess(usageCollector.getLatestUsage());
                finalizeRecord();
                console.log(withRequestId(`[HTTP STREAM END] path=${path} duration=${Date.now() - started}ms (client closed after completion)`, cachedRequestId));
            }
            else {
                finalizeRecord();
                console.warn(withRequestId(`[HTTP STREAM CANCEL] path=${path} duration=${Date.now() - started}ms`, cachedRequestId));
            }
            cancelPromise = reader.cancel(reason).catch((error) => {
                console.warn(withRequestId(`[HTTP STREAM CANCEL ERROR] path=${path} duration=${Date.now() - started}ms`, cachedRequestId), error);
            });
            return cancelPromise;
        },
    });
}
// ─── Routes ─────────────────────────────────────────────────────────────────
app.get("/", (c) => {
    const config = configManager.getActiveSnapshot().effectiveConfig;
    return c.json({
        ok: true,
        message: "nanollm gateway",
        models: getPublicModelNames(config).map((name) => ({
            name,
            provider: config.fallback[name] ? "fallback-group" : resolveModel(config, name)?.provider,
            model: config.fallback[name] ? config.fallback[name] : resolveModel(config, name)?.model,
        })),
        endpoints: {
            health: "GET /health",
            record: "GET /record",
            recordSummary: "GET /record/summary",
            recordQuery: "GET /record/{requestId}",
            admin: "GET /admin",
            chat: "POST /v1/chat/completions",
            responses: "POST /v1/responses",
            messages: "POST /v1/messages",
            imageGenerations: "POST /v1/images/generations",
            imageEdits: "POST /v1/images/edits",
        },
    });
});
app.get("/health", (c) => c.json({ ok: true }));
app.get("/status", (c) => c.redirect("/admin#/models", 302));
app.get("/status/data", (c) => c.json(buildStatusPayload(configManager.getActiveSnapshot().effectiveConfig)));
app.get("/record", (c) => c.redirect("/admin#/records", 302));
app.get("/record/summary", (c) => c.json(getRecordSummary()));
app.get("/record/:requestId", (c) => {
    const requestId = c.req.param("requestId");
    const payload = buildRecordQueryPayload(requestId);
    if (!payload.record) {
        return c.json({ error: `Record '${requestId.slice(0, 6)}' not found`, summary: payload.summary }, 404);
    }
    return c.json(payload);
});
app.post("/record/:requestId/replay", async (c) => {
    const requestId = c.req.param("requestId");
    const record = getRecordedRequest(requestId);
    if (!record) {
        return c.json({ error: `Record '${requestId.slice(0, 6)}' not found`, summary: getRecordSummary() }, 404);
    }
    const result = await replayRecordedRequest(record, configManager.getActiveSnapshot().effectiveConfig);
    return c.json({
        ...result,
        replayOf: record.requestId,
        summary: getRecordSummary(),
        note: "Sensitive client headers are not replayed; provider auth uses current config.",
    }, result.status);
});
// Serve frontend SPA for /admin
const serveFrontendFile = (c, relPath) => {
    const filePath = join(FRONTEND_DIST, relPath);
    try {
        const buf = readFileSync(filePath);
        const ext = filePath.split(".").pop() || "";
        const mimeMap = {
            html: "text/html",
            css: "text/css",
            js: "application/javascript",
            json: "application/json",
            png: "image/png",
            svg: "image/svg+xml",
            ico: "image/x-icon",
            woff2: "font/woff2",
        };
        return c.body(buf, 200, { "Content-Type": mimeMap[ext] || "application/octet-stream" });
    }
    catch {
        return null;
    }
};
app.get("/admin", (c) => {
    const r = serveFrontendFile(c, "index.html");
    if (r)
        return r;
    return c.text("Frontend not built. Run: npm run build --prefix frontend", 503);
});
app.get("/admin/assets/:filename{.+}", (c) => {
    const filename = c.req.param("filename");
    const r = serveFrontendFile(c, join("assets", filename));
    if (r)
        return r;
    return c.notFound();
});
app.get("/admin/config", (c) => c.redirect("/admin", 302));
app.get("/admin/config/data", (c) => c.json(buildConfigAdminPayload()));
app.post("/admin/config/apply", async (c) => {
    let body;
    try {
        body = await c.req.json();
    }
    catch {
        return c.json({ error: "Invalid JSON body", currentSnapshot: buildConfigAdminPayload() }, 400);
    }
    if (!body.config || typeof body.config !== "object" || Array.isArray(body.config)) {
        return c.json({ error: "Field 'config' must be an object", currentSnapshot: buildConfigAdminPayload() }, 400);
    }
    if (!Number.isInteger(body.baseVersion)) {
        return c.json({ error: "Field 'baseVersion' must be an integer", currentSnapshot: buildConfigAdminPayload() }, 400);
    }
    const currentSnapshot = configManager.getActiveSnapshot();
    if (body.baseVersion !== currentSnapshot.version) {
        return c.json({ error: "Config version conflict", currentSnapshot: buildConfigAdminPayload() }, 409);
    }
    let yamlText;
    try {
        const submittedPort = body.config?.server?.port;
        yamlText = buildYamlTextFromAdminForm(body.config, {
            preservedPort: submittedPort,
        });
        parseConfigText(yamlText);
    }
    catch (error) {
        return c.json({
            error: error instanceof Error ? error.message : String(error),
            currentSnapshot: buildConfigAdminPayload(),
        }, 400);
    }
    try {
        writeConfigAtomic(configPath, yamlText);
        const result = configManager.applyText(yamlText, "ui");
        return c.json({
            ok: true,
            snapshot: buildConfigAdminPayload(),
            appliedFields: result.appliedFields,
            requiresRestartFields: result.requiresRestartFields,
        });
    }
    catch (error) {
        return c.json({
            error: error instanceof Error ? error.message : String(error),
            currentSnapshot: buildConfigAdminPayload(),
        }, 500);
    }
});
app.post("/admin/models/test", async (c) => {
    let body;
    try {
        body = await c.req.json();
    }
    catch {
        return c.json({ error: "Invalid JSON body" }, 400);
    }
    if (!body.name || typeof body.name !== "string") {
        return c.json({ error: "Field 'name' must be a non-empty string" }, 400);
    }
    const config = configManager.getActiveSnapshot().effectiveConfig;
    const modelConfig = resolveModel(config, body.name);
    if (!modelConfig) {
        return c.json({ error: `Model '${body.name}' not found` }, 404);
    }
    const result = await testUpstream(modelConfig);
    return c.json(result);
});
app.get("/v1/models", (c) => {
    const config = configManager.getActiveSnapshot().effectiveConfig;
    return c.json({
        object: "list",
        data: getPublicModelNames(config).map((name) => ({
            id: name,
            object: "model",
            owned_by: config.fallback[name] ? "fallback-group" : resolveModel(config, name)?.provider,
        })),
    });
});
app.post("/v1/chat/completions", createRoute("openai-chat"));
app.post("/v1/responses", createRoute("openai-responses"));
app.post("/v1/messages", createRoute("anthropic"));
app.post("/v1/images/generations", createImageRoute("generations"));
app.post("/v1/images/edits", createImageRoute("edits"));
// ─── Start ──────────────────────────────────────────────────────────────────
const startupConfig = startupSnapshot.effectiveConfig;
const server = serve({ fetch: app.fetch, port: startupConfig.port }, (info) => {
    const base = `http://localhost:${info.port}`;
    const modelCount = startupConfig.models.length;
    const fallbackCount = Object.keys(startupConfig.fallback).length;
    const adminAuthEnabled = isAuthEnabled(startupConfig, "admin");
    const apiAuthEnabled = isAuthEnabled(startupConfig, "api");
    const lines = [
        "",
        `  nanollm gateway`,
        "",
        `  Listening:   ${base}`,
        `  Config:      ${configPath} (${configSource})`,
        `  Storage:     ${storageMode}${sqliteDb ? ` (${sqlitePath})` : ""}`,
        `  Models:      ${modelCount > 0 ? `${modelCount} (${startupConfig.models.map((m) => m.name).join(", ")})` : "(none)"}`,
        `  Fallbacks:   ${fallbackCount > 0 ? `${fallbackCount} group${fallbackCount > 1 ? "s" : ""} (${Object.entries(startupConfig.fallback).map(([g, m]) => `${g}=[${m.join(", ")}]`).join("; ")})` : "(none)"}`,
        `  Auth Admin:  ${adminAuthEnabled ? "enabled" : "disabled"}`,
        `  Auth API:    ${apiAuthEnabled ? "enabled" : "disabled"}`,
        "",
        `  Admin:       ${base}/admin`,
        `  Models:      ${base}/admin#/models`,
        `  Records:     ${base}/admin#/records`,
        "",
    ];
    console.log(lines.join("\n"));
});
server.once("error", (error) => {
    handleServerStartupError(error, {
        port: startupConfig.port,
        dispose: () => configManager.dispose(),
    });
});
server.once("close", () => {
    configManager.dispose();
    flushRecording();
    sqliteDb?.close();
});
export { server };

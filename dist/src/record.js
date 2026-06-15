import { getRequestId } from "./request-context.js";
import { DEFAULT_RECORD_MAX_SIZE } from "./config.js";
const REDACTED = "[REDACTED]";
const SENSITIVE_HEADERS = new Set(["authorization", "x-api-key", "cookie", "set-cookie"]);
function extractRequestModel(body) {
    if (!body || typeof body !== "object")
        return undefined;
    const model = body.model;
    return typeof model === "string" && model ? model : undefined;
}
function classifyRequestSource(headers) {
    if (!headers)
        return "other";
    const userAgent = typeof headers.get === "function"
        ? headers.get("user-agent")
        : Object.entries(headers).find(([key]) => key.toLowerCase() === "user-agent")?.[1];
    const normalized = userAgent?.toLowerCase() ?? "";
    if (normalized.includes("claude-cli"))
        return "claudecode";
    if (normalized.includes("codex"))
        return "codex";
    if (normalized.includes("opencode"))
        return "opencode";
    return "other";
}
function buildRequestMeta(headers, body) {
    return {
        model: extractRequestModel(body),
        source: classifyRequestSource(headers),
    };
}
function cloneJson(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}
function maskHeaderValue(name, value) {
    return SENSITIVE_HEADERS.has(name.toLowerCase()) ? REDACTED : value;
}
function normalizeHeaders(headers) {
    if (!headers)
        return undefined;
    const entries = typeof headers.entries === "function"
        ? Array.from(headers.entries())
        : Object.entries(headers);
    return Object.fromEntries(entries.map(([key, value]) => [key, maskHeaderValue(key, value)]));
}
function normalizeBody(body) {
    if (typeof body === "string") {
        try {
            return { value: cloneJson(JSON.parse(body)), truncated: false };
        }
        catch {
            return { value: body, truncated: false };
        }
    }
    return { value: cloneJson(body), truncated: false };
}
function appendTextBody(current, chunk) {
    const base = typeof current === "string" ? current : "";
    return { value: base + chunk, truncated: false };
}
function getRecordKey(requestId) {
    return requestId;
}
function normalizeLookupValue(value) {
    return value.trim();
}
function resolveRequestId(requestId) {
    return requestId ?? getRequestId();
}
class RecordStore {
    enabled = true;
    capturedCount = 0;
    limit = DEFAULT_RECORD_MAX_SIZE;
    sessionStartedAt;
    records = new Map();
    evictOldestIfNeeded() {
        if (this.records.size < this.limit || this.records.size === 0)
            return;
        const oldestKey = this.records.keys().next().value;
        if (oldestKey) {
            this.records.delete(oldestKey);
            this.capturedCount = Math.max(0, this.capturedCount - 1);
        }
    }
    trimToLimit() {
        while (this.records.size > this.limit && this.records.size > 0) {
            const oldestKey = this.records.keys().next().value;
            if (!oldestKey)
                break;
            this.records.delete(oldestKey);
            this.capturedCount = Math.max(0, this.capturedCount - 1);
        }
    }
    start(options) {
        this.limit = options?.maxSize ?? DEFAULT_RECORD_MAX_SIZE;
        this.enabled = true;
        this.capturedCount = 0;
        if (!this.sessionStartedAt)
            this.sessionStartedAt = Date.now();
        this.records.clear();
        return this.summary();
    }
    configure(options) {
        if (options?.maxSize !== undefined) {
            this.limit = options.maxSize;
            this.trimToLimit();
        }
        return this.summary();
    }
    stop() {
        this.enabled = false;
        this.sessionStartedAt = undefined;
        return this.summary();
    }
    summary() {
        return {
            enabled: this.enabled,
            capturedCount: this.capturedCount,
            limit: this.limit,
            sessionStartedAt: this.sessionStartedAt,
            size: this.records.size,
            recentKeys: Array.from(this.records.values())
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((record) => ({
                key: record.key,
                requestId: record.requestId,
                path: record.clientRequest.path,
                model: record.clientRequest.model,
                actualModel: record.clientRequest.actualModel,
                source: record.clientRequest.source,
                status: record.clientRequest.status,
                responseStatus: record.clientResponse.status,
                createdAt: record.createdAt,
            })),
        };
    }
    beginRequest(input) {
        if (!this.enabled)
            return false;
        const key = getRecordKey(input.requestId);
        if (this.records.has(key))
            return true;
        this.evictOldestIfNeeded();
        const requestMeta = buildRequestMeta(input.headers, input.body);
        this.records.set(key, {
            requestId: input.requestId,
            key,
            createdAt: Date.now(),
            stream: input.stream,
            clientRequest: {
                path: input.path,
                headers: normalizeHeaders(input.headers) ?? {},
                body: cloneJson(input.body),
                model: requestMeta.model,
                actualModel: undefined,
                source: requestMeta.source,
                status: "in_progress",
            },
            attempts: [],
            clientResponse: {},
        });
        this.capturedCount += 1;
        return true;
    }
    get(requestId) {
        const normalized = normalizeLookupValue(requestId);
        return this.records.get(normalized);
    }
    getMutable(requestId) {
        const id = resolveRequestId(requestId);
        if (!id)
            return undefined;
        return this.records.get(getRecordKey(id));
    }
    ensureAttempt(input) {
        const record = this.getMutable(input.requestId);
        if (!record)
            return;
        const existing = record.attempts.find((attempt) => attempt.index === input.index);
        if (existing)
            return existing;
        const body = normalizeBody(input.requestBody);
        const attempt = {
            index: input.index,
            provider: input.provider,
            modelName: input.modelName,
            url: input.url,
            request: {
                headers: normalizeHeaders(input.requestHeaders),
                body: body.value,
                ...(body.truncated ? { truncated: true } : {}),
            },
            response: {},
        };
        record.clientRequest.actualModel = input.modelName;
        record.attempts.push(attempt);
        return attempt;
    }
    setAttemptResponseMeta(input) {
        const attempt = this.getMutable(input.requestId)?.attempts.find((item) => item.index === input.index);
        if (!attempt)
            return;
        attempt.response.status = input.status;
        attempt.response.headers = normalizeHeaders(input.headers);
    }
    setAttemptResponseBody(input) {
        const attempt = this.getMutable(input.requestId)?.attempts.find((item) => item.index === input.index);
        if (!attempt)
            return;
        const body = normalizeBody(input.body);
        attempt.response.body = body.value;
        attempt.response.truncated = body.truncated;
    }
    appendAttemptResponseBody(input) {
        const attempt = this.getMutable(input.requestId)?.attempts.find((item) => item.index === input.index);
        if (!attempt)
            return;
        const text = appendTextBody(attempt.response.body, input.chunk);
        attempt.response.body = text.value;
        attempt.response.truncated = text.truncated;
    }
    setAttemptError(input) {
        const attempt = this.getMutable(input.requestId)?.attempts.find((item) => item.index === input.index);
        if (!attempt)
            return;
        attempt.error = {
            message: input.message,
            ...(input.status != null ? { status: input.status } : {}),
            ...(input.upstream !== undefined ? { upstream: normalizeBody(input.upstream).value } : {}),
        };
    }
    setClientResponseMeta(input) {
        const record = this.getMutable(input.requestId);
        if (!record)
            return;
        record.clientResponse.status = input.status;
        if (input.headers) {
            record.clientResponse.headers = normalizeHeaders(input.headers);
        }
    }
    setClientResponseBody(input) {
        const record = this.getMutable(input.requestId);
        if (!record)
            return;
        const body = normalizeBody(input.body);
        record.clientResponse.body = body.value;
        record.clientResponse.truncated = body.truncated;
        if (record.clientRequest.status === "in_progress")
            record.clientRequest.status = "success";
    }
    appendClientResponseBody(input) {
        const record = this.getMutable(input.requestId);
        if (!record)
            return;
        const text = appendTextBody(record.clientResponse.body, input.chunk);
        record.clientResponse.body = text.value;
        record.clientResponse.truncated = text.truncated;
        if (record.clientRequest.status === "in_progress")
            record.clientRequest.status = "success";
    }
    setRequestError(input) {
        const record = this.getMutable(input.requestId);
        if (!record)
            return;
        record.error = { message: input.message };
        record.clientRequest.status = "failure";
    }
    finalizeRequest(_input) { }
}
function parseRecordEntry(json) {
    try {
        return JSON.parse(json);
    }
    catch {
        return undefined;
    }
}
function updateSummaryFields(record) {
    return {
        path: record.clientRequest.path,
        model: record.clientRequest.model ?? null,
        actualModel: record.clientRequest.actualModel ?? null,
        source: record.clientRequest.source,
        status: record.clientRequest.status,
        responseStatus: record.clientResponse.status ?? null,
    };
}
class SqliteRecordStore {
    db;
    enabled = true;
    capturedCount = 0;
    limit = DEFAULT_RECORD_MAX_SIZE;
    sessionStartedAt;
    activeRecords = new Map();
    persistQueue = new Map();
    persistScheduled = false;
    constructor(db) {
        this.db = db;
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS records (
        key TEXT PRIMARY KEY,
        request_id TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        path TEXT NOT NULL,
        model TEXT,
        actual_model TEXT,
        source TEXT NOT NULL,
        status TEXT NOT NULL,
        response_status INTEGER,
        entry_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_records_created_at ON records(created_at);
      CREATE INDEX IF NOT EXISTS idx_records_request_id ON records(request_id);
    `);
        this.capturedCount = this.countRecords();
    }
    countRecords() {
        const row = this.db.prepare("SELECT COUNT(*) AS count FROM records").get();
        return Number(row?.count ?? 0);
    }
    countVisibleRecords() {
        return this.countRecords() + this.activeRecords.size + this.persistQueue.size;
    }
    getOldestVolatileKey() {
        let oldest;
        for (const record of [...this.activeRecords.values(), ...this.persistQueue.values()]) {
            if (!oldest || record.createdAt < oldest.createdAt || (record.createdAt === oldest.createdAt && record.key < oldest.key)) {
                oldest = { key: record.key, createdAt: record.createdAt };
            }
        }
        return oldest?.key;
    }
    getOldestPersistedKey() {
        const row = this.db.prepare("SELECT key FROM records ORDER BY created_at ASC, key ASC LIMIT 1").get();
        return row?.key;
    }
    evictOldestIfNeeded() {
        while (this.countVisibleRecords() >= this.limit && this.limit > 0) {
            const volatileKey = this.getOldestVolatileKey();
            const persistedKey = this.getOldestPersistedKey();
            const volatileRecord = volatileKey ? (this.activeRecords.get(volatileKey) ?? this.persistQueue.get(volatileKey)) : undefined;
            const persistedRecord = persistedKey ? this.readByKey(persistedKey) : undefined;
            const evictVolatile = volatileRecord &&
                (!persistedRecord ||
                    volatileRecord.createdAt < persistedRecord.createdAt ||
                    (volatileRecord.createdAt === persistedRecord.createdAt && volatileRecord.key < persistedRecord.key));
            if (evictVolatile && volatileKey) {
                this.activeRecords.delete(volatileKey);
                this.persistQueue.delete(volatileKey);
            }
            else if (persistedKey) {
                this.db.prepare("DELETE FROM records WHERE key = ?").run(persistedKey);
            }
            else {
                break;
            }
        }
    }
    trimToLimit() {
        this.db.prepare(`
      DELETE FROM records
      WHERE key IN (
        SELECT key FROM records ORDER BY created_at ASC, key ASC LIMIT max((SELECT COUNT(*) FROM records) - ?, 0)
      )
    `).run(this.limit);
        this.capturedCount = this.countRecords();
    }
    readByKey(key) {
        const active = this.activeRecords.get(key) ?? this.persistQueue.get(key);
        if (active)
            return active;
        const row = this.db.prepare("SELECT entry_json FROM records WHERE key = ?").get(key);
        return row ? parseRecordEntry(row.entry_json) : undefined;
    }
    hasPersistedKey(key) {
        return !!this.db.prepare("SELECT 1 FROM records WHERE key = ?").get(key);
    }
    readMutable(requestId) {
        const id = resolveRequestId(requestId);
        if (!id)
            return undefined;
        return this.readByKey(getRecordKey(id));
    }
    writeRecordNow(record) {
        const summary = updateSummaryFields(record);
        this.db.prepare(`
      INSERT INTO records (
        key,
        request_id,
        created_at,
        path,
        model,
        actual_model,
        source,
        status,
        response_status,
        entry_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        request_id = excluded.request_id,
        created_at = excluded.created_at,
        path = excluded.path,
        model = excluded.model,
        actual_model = excluded.actual_model,
        source = excluded.source,
        status = excluded.status,
        response_status = excluded.response_status,
        entry_json = excluded.entry_json
    `).run(record.key, record.requestId, record.createdAt, summary.path, summary.model, summary.actualModel, summary.source, summary.status, summary.responseStatus, JSON.stringify(record));
    }
    scheduleFlush() {
        if (this.persistScheduled)
            return;
        this.persistScheduled = true;
        queueMicrotask(() => {
            this.persistScheduled = false;
            this.flush();
        });
    }
    flush() {
        if (this.persistQueue.size === 0)
            return;
        const records = Array.from(this.persistQueue.values());
        this.persistQueue.clear();
        this.db.exec("BEGIN IMMEDIATE");
        try {
            for (const record of records) {
                this.writeRecordNow(record);
            }
            this.db.exec("COMMIT");
        }
        catch (error) {
            this.db.exec("ROLLBACK");
            throw error;
        }
    }
    start(options) {
        this.limit = options?.maxSize ?? DEFAULT_RECORD_MAX_SIZE;
        this.enabled = true;
        if (!this.sessionStartedAt)
            this.sessionStartedAt = Date.now();
        this.trimToLimit();
        return this.summary();
    }
    configure(options) {
        if (options?.maxSize !== undefined) {
            this.limit = options.maxSize;
            this.trimToLimit();
        }
        return this.summary();
    }
    stop() {
        this.flush();
        this.enabled = false;
        this.sessionStartedAt = undefined;
        return this.summary();
    }
    summary() {
        const rows = this.db.prepare(`
      SELECT key, request_id, created_at, path, model, actual_model, source, status, response_status
      FROM records
      ORDER BY created_at DESC, key DESC
      LIMIT ?
    `).all(this.limit);
        const activeSummaries = Array.from(this.activeRecords.values()).map((record) => {
            const summary = updateSummaryFields(record);
            return {
                key: record.key,
                request_id: record.requestId,
                created_at: record.createdAt,
                path: summary.path,
                model: summary.model,
                actual_model: summary.actualModel,
                source: summary.source,
                status: summary.status,
                response_status: summary.responseStatus,
            };
        });
        const combinedRows = [...activeSummaries, ...rows.filter((row) => !this.activeRecords.has(row.key))]
            .sort((a, b) => b.created_at - a.created_at || b.key.localeCompare(a.key))
            .slice(0, this.limit);
        const size = Math.min(this.limit, this.countRecords() + activeSummaries.filter((row) => !this.hasPersistedKey(row.key)).length);
        this.capturedCount = size;
        return {
            enabled: this.enabled,
            capturedCount: this.capturedCount,
            limit: this.limit,
            sessionStartedAt: this.sessionStartedAt,
            size,
            recentKeys: combinedRows.map((row) => ({
                key: row.key,
                requestId: row.request_id,
                path: row.path,
                model: row.model ?? undefined,
                actualModel: row.actual_model ?? undefined,
                source: row.source,
                status: row.status,
                responseStatus: row.response_status ?? undefined,
                createdAt: row.created_at,
            })),
        };
    }
    beginRequest(input) {
        if (!this.enabled)
            return false;
        const key = getRecordKey(input.requestId);
        if (this.activeRecords.has(key) || this.persistQueue.has(key) || this.hasPersistedKey(key))
            return true;
        this.trimToLimit();
        this.evictOldestIfNeeded();
        const requestMeta = buildRequestMeta(input.headers, input.body);
        this.activeRecords.set(key, {
            requestId: input.requestId,
            key,
            createdAt: Date.now(),
            stream: input.stream,
            clientRequest: {
                path: input.path,
                headers: normalizeHeaders(input.headers) ?? {},
                body: cloneJson(input.body),
                model: requestMeta.model,
                actualModel: undefined,
                source: requestMeta.source,
                status: "in_progress",
            },
            attempts: [],
            clientResponse: {},
        });
        this.capturedCount = this.countRecords() + this.activeRecords.size;
        return true;
    }
    get(requestId) {
        const normalized = normalizeLookupValue(requestId);
        return this.readByKey(normalized);
    }
    ensureAttempt(input) {
        const record = this.readMutable(input.requestId);
        if (!record)
            return undefined;
        const existing = record.attempts.find((attempt) => attempt.index === input.index);
        if (existing)
            return existing;
        const body = normalizeBody(input.requestBody);
        const attempt = {
            index: input.index,
            provider: input.provider,
            modelName: input.modelName,
            url: input.url,
            request: {
                headers: normalizeHeaders(input.requestHeaders),
                body: body.value,
                ...(body.truncated ? { truncated: true } : {}),
            },
            response: {},
        };
        record.clientRequest.actualModel = input.modelName;
        record.attempts.push(attempt);
        return attempt;
    }
    mutate(requestId, mutator) {
        const record = this.readMutable(requestId);
        if (!record)
            return;
        mutator(record);
        if (this.activeRecords.has(record.key)) {
            this.activeRecords.set(record.key, record);
            return;
        }
        if (this.persistQueue.has(record.key)) {
            this.persistQueue.set(record.key, record);
            return;
        }
        this.writeRecordNow(record);
    }
    setAttemptResponseMeta(input) {
        this.mutate(input.requestId, (record) => {
            const attempt = record.attempts.find((item) => item.index === input.index);
            if (!attempt)
                return;
            attempt.response.status = input.status;
            attempt.response.headers = normalizeHeaders(input.headers);
        });
    }
    setAttemptResponseBody(input) {
        this.mutate(input.requestId, (record) => {
            const attempt = record.attempts.find((item) => item.index === input.index);
            if (!attempt)
                return;
            const body = normalizeBody(input.body);
            attempt.response.body = body.value;
            attempt.response.truncated = body.truncated;
        });
    }
    appendAttemptResponseBody(input) {
        this.mutate(input.requestId, (record) => {
            const attempt = record.attempts.find((item) => item.index === input.index);
            if (!attempt)
                return;
            const text = appendTextBody(attempt.response.body, input.chunk);
            attempt.response.body = text.value;
            attempt.response.truncated = text.truncated;
        });
    }
    setAttemptError(input) {
        this.mutate(input.requestId, (record) => {
            const attempt = record.attempts.find((item) => item.index === input.index);
            if (!attempt)
                return;
            attempt.error = {
                message: input.message,
                ...(input.status != null ? { status: input.status } : {}),
                ...(input.upstream !== undefined ? { upstream: normalizeBody(input.upstream).value } : {}),
            };
        });
    }
    setClientResponseMeta(input) {
        this.mutate(input.requestId, (record) => {
            record.clientResponse.status = input.status;
            if (input.headers) {
                record.clientResponse.headers = normalizeHeaders(input.headers);
            }
        });
    }
    setClientResponseBody(input) {
        this.mutate(input.requestId, (record) => {
            const body = normalizeBody(input.body);
            record.clientResponse.body = body.value;
            record.clientResponse.truncated = body.truncated;
            if (record.clientRequest.status === "in_progress")
                record.clientRequest.status = "success";
        });
    }
    appendClientResponseBody(input) {
        this.mutate(input.requestId, (record) => {
            const text = appendTextBody(record.clientResponse.body, input.chunk);
            record.clientResponse.body = text.value;
            record.clientResponse.truncated = text.truncated;
            if (record.clientRequest.status === "in_progress")
                record.clientRequest.status = "success";
        });
    }
    setRequestError(input) {
        this.mutate(input.requestId, (record) => {
            record.error = { message: input.message };
            record.clientRequest.status = "failure";
        });
    }
    finalizeRequest(input) {
        const id = resolveRequestId(input.requestId);
        if (!id)
            return;
        const key = getRecordKey(id);
        const record = this.activeRecords.get(key);
        if (!record)
            return;
        this.activeRecords.delete(key);
        this.persistQueue.set(key, record);
        this.scheduleFlush();
    }
}
let recordStore = new RecordStore();
export function useMemoryRecordStore() {
    recordStore.flush?.();
    recordStore = new RecordStore();
}
export function useSqliteRecordStore(db) {
    recordStore.flush?.();
    recordStore = new SqliteRecordStore(db);
}
export function startRecording(options) {
    return recordStore.start(options);
}
export function stopRecording() {
    return recordStore.stop();
}
export function configureRecording(options) {
    return recordStore.configure(options);
}
export function getRecordSummary() {
    return recordStore.summary();
}
export function flushRecording() {
    recordStore.flush?.();
}
export function beginRecordedRequest(input) {
    return recordStore.beginRequest(input);
}
export function getRecordedRequest(requestIdOrPrefix) {
    return recordStore.get(requestIdOrPrefix);
}
export function ensureRecordedAttempt(input) {
    return recordStore.ensureAttempt(input);
}
export function setRecordedAttemptResponseMeta(input) {
    recordStore.setAttemptResponseMeta(input);
}
export function setRecordedAttemptResponseBody(input) {
    recordStore.setAttemptResponseBody(input);
}
export function appendRecordedAttemptResponseBody(input) {
    recordStore.appendAttemptResponseBody(input);
}
export function setRecordedAttemptError(input) {
    recordStore.setAttemptError(input);
}
export function setRecordedClientResponseMeta(input) {
    recordStore.setClientResponseMeta(input);
}
export function setRecordedClientResponseBody(input) {
    recordStore.setClientResponseBody(input);
}
export function appendRecordedClientResponseBody(input) {
    recordStore.appendClientResponseBody(input);
}
export function setRecordedRequestError(input) {
    recordStore.setRequestError(input);
}
export function finalizeRecordedRequest(input) {
    recordStore.finalizeRequest(input);
}

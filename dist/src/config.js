import { readFileSync } from "node:fs";
import { parse as parseYAML } from "yaml";
export const DEFAULT_RECORD_MAX_SIZE = 10;
export const DEFAULT_TTFB_TIMEOUT = 5000;
export const DEFAULT_OPENAI_IMAGE_TTFB_TIMEOUT = 600000;
export function getPublicModelNames(config) {
    return [...Object.keys(config.fallback), ...config.models.map((model) => model.name)];
}
export function isAuthEnabled(config, dimension) {
    const auth = config.auth;
    if (!auth)
        return false;
    if (dimension === "admin") {
        return !!(auth.admin.enabled && auth.admin.username && auth.admin.password);
    }
    return !!(auth.api.enabled && auth.api.token);
}
export function getAuthToken(config) {
    const api = config.auth?.api;
    return api?.enabled ? api?.token : undefined;
}
export function getAdminCredentials(config) {
    const admin = config.auth?.admin;
    if (!admin?.enabled || !admin.username || !admin.password)
        return undefined;
    return { username: admin.username, password: admin.password };
}
function resolveEnvVars(value) {
    return value.replace(/\$\{(\w+)\}/g, (_, key) => process.env[key] ?? "");
}
function resolveDeep(obj) {
    if (typeof obj === "string")
        return resolveEnvVars(obj);
    if (Array.isArray(obj))
        return obj.map(resolveDeep);
    if (obj && typeof obj === "object") {
        const result = {};
        for (const [k, v] of Object.entries(obj)) {
            result[k] = resolveDeep(v);
        }
        return result;
    }
    return obj;
}
function parseJSONLikeValue(value) {
    if (typeof value !== "string")
        return value;
    const trimmed = value.trim();
    if (!trimmed)
        return value;
    try {
        return JSON.parse(trimmed);
    }
    catch {
        return value;
    }
}
function normalizeTimeout(value, fieldName) {
    if (value === undefined || value === null || value === "")
        return undefined;
    const timeout = Number(value);
    if (!Number.isFinite(timeout) || timeout <= 0) {
        throw new Error(`'${fieldName}' must be a positive number`);
    }
    return timeout;
}
function normalizePositiveInteger(value, fieldName) {
    if (value === undefined || value === null || value === "")
        return undefined;
    const normalized = Number(value);
    if (!Number.isInteger(normalized) || normalized <= 0) {
        throw new Error(`'${fieldName}' must be a positive integer`);
    }
    return normalized;
}
function normalizeOptionalString(value) {
    if (value === undefined || value === null)
        return undefined;
    const normalized = String(value).trim();
    return normalized ? normalized : undefined;
}
function normalizeBoolean(value, fieldName, defaultValue) {
    if (value === undefined || value === null || value === "")
        return defaultValue;
    if (typeof value === "boolean")
        return value;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true")
            return true;
        if (normalized === "false")
            return false;
    }
    throw new Error(`'${fieldName}' must be a boolean`);
}
function normalizeProxyUrl(value, fieldName) {
    if (value === undefined || value === null || value === "")
        return undefined;
    const proxy = String(value).trim();
    if (!proxy)
        return undefined;
    let url;
    try {
        url = new URL(proxy);
    }
    catch {
        throw new Error(`'${fieldName}' must be a valid URL`);
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error(`'${fieldName}' must use http:// or https://`);
    }
    return proxy;
}
function normalizeModelConfig(model, defaultTTFBTimeout) {
    const headers = model.headers && typeof model.headers === "object"
        ? Object.fromEntries(Object.entries(model.headers).map(([key, value]) => [key, String(value)]))
        : undefined;
    const body = model.body && typeof model.body === "object"
        ? Object.fromEntries(Object.entries(model.body).map(([key, value]) => [key, parseJSONLikeValue(value)]))
        : undefined;
    const bodyExpression = model.bodyExpression === undefined || model.bodyExpression === null || model.bodyExpression === ""
        ? undefined
        : String(model.bodyExpression);
    const modelTTFBTimeout = normalizeTimeout(model.ttfb_timeout, `models.${model.name || "<unknown>"}.ttfb_timeout`);
    const ttfb_timeout = modelTTFBTimeout ?? (model.provider === "openai-image" ? DEFAULT_OPENAI_IMAGE_TTFB_TIMEOUT : defaultTTFBTimeout);
    const image = model.image === undefined ? true : !!model.image;
    const ignore_invalid_history = normalizeBoolean(model.ignore_invalid_history, `models.${model.name || "<unknown>"}.ignore_invalid_history`, true);
    const proxy = normalizeProxyUrl(model.proxy, `models.${model.name || "<unknown>"}.proxy`);
    return {
        ...model,
        image,
        ignore_invalid_history,
        proxy,
        ...(ttfb_timeout !== undefined ? { ttfb_timeout } : {}),
        ...(headers ? { headers } : {}),
        ...(body ? { body } : {}),
        ...(bodyExpression ? { bodyExpression } : {}),
    };
}
function getWildcardPrefix(name) {
    if (!name.endsWith("*"))
        return undefined;
    return name.slice(0, -1);
}
function assertValidModelNamePattern(name) {
    const firstWildcard = name.indexOf("*");
    if (firstWildcard !== -1 && firstWildcard !== name.length - 1) {
        throw new Error(`Model '${name}' has invalid wildcard name. '*' must appear only once and at the end`);
    }
}
function parseDocument(rawText, options) {
    const parsed = parseYAML(rawText);
    return (options?.resolveEnv ?? true ? resolveDeep(parsed) : parsed);
}
export function parseConfigDocument(rawText) {
    return parseDocument(rawText, { resolveEnv: true });
}
export function parseSourceConfigDocument(rawText) {
    return parseDocument(rawText, { resolveEnv: false });
}
export function materializeConfig(document, options) {
    const defaultTTFBTimeout = options?.ttfb_timeout ?? normalizeTimeout(document.server?.ttfb_timeout, "server.ttfb_timeout") ?? DEFAULT_TTFB_TIMEOUT;
    const recordMaxSize = options?.recordMaxSize ?? (normalizePositiveInteger(document.record?.max_size, "record.max_size") ?? DEFAULT_RECORD_MAX_SIZE);
    const adminEnabled = normalizeBoolean(document.server?.auth?.admin?.enabled, "server.auth.admin.enabled", false);
    const adminUsername = normalizeOptionalString(options?.adminUsername ?? document.server?.auth?.admin?.username);
    const adminPassword = normalizeOptionalString(options?.adminPassword ?? document.server?.auth?.admin?.password);
    const apiEnabled = normalizeBoolean(document.server?.auth?.api?.enabled, "server.auth.api.enabled", false);
    const apiToken = normalizeOptionalString(options?.apiAuthToken ?? document.server?.auth?.api?.token);
    const auth = (adminEnabled && adminUsername && adminPassword) || (apiEnabled && apiToken)
        ? {
            admin: {
                enabled: !!(adminEnabled && adminUsername && adminPassword),
                ...(adminUsername ? { username: adminUsername } : {}),
                ...(adminPassword ? { password: adminPassword } : {}),
            },
            api: {
                enabled: !!(apiEnabled && apiToken),
                ...(apiToken ? { token: apiToken } : {}),
            },
        }
        : undefined;
    const models = (document.models ?? []).map((model) => normalizeModelConfig(model, defaultTTFBTimeout));
    const fallback = document.fallback ?? {};
    for (const m of models) {
        if (!m.name)
            throw new Error("Model config missing 'name'");
        if (!m.provider)
            throw new Error(`Model '${m.name}' missing 'provider'`);
        if (!m.base_url)
            throw new Error(`Model '${m.name}' missing 'base_url'`);
        if (!m.model)
            throw new Error(`Model '${m.name}' missing 'model'`);
        if (!["openai-chat", "openai-responses", "anthropic", "openai-image"].includes(m.provider)) {
            throw new Error(`Model '${m.name}' has invalid provider '${m.provider}'. Must be openai-chat, openai-responses, anthropic, or openai-image`);
        }
    }
    validateFallback(models, fallback);
    return {
        port: Number(process.env.PORT) || options?.port || (document.server?.port ?? 3000),
        ...(defaultTTFBTimeout !== undefined ? { ttfb_timeout: defaultTTFBTimeout } : {}),
        ...(auth ? { auth } : {}),
        models,
        fallback,
        record: {
            max_size: recordMaxSize,
        },
    };
}
export function parseConfigText(rawText) {
    return materializeConfig(parseConfigDocument(rawText));
}
export function loadConfig(path) {
    return parseConfigText(readFileSync(path, "utf-8"));
}
export function resolveModel(config, name) {
    return config.models.find((m) => m.name === name);
}
export function resolveModelForRequest(config, name) {
    const exact = resolveModel(config, name);
    if (exact)
        return { model: exact, captured: "", wildcard: false };
    let best;
    for (const model of config.models) {
        const prefix = getWildcardPrefix(model.name);
        if (prefix === undefined || !name.startsWith(prefix))
            continue;
        if (!best || prefix.length > best.prefix.length) {
            best = { model, prefix };
        }
    }
    if (!best)
        return undefined;
    const captured = name.slice(best.prefix.length);
    return {
        model: {
            ...best.model,
            model: best.model.model.replaceAll("*", captured),
        },
        captured,
        wildcard: true,
    };
}
export function resolveFallbackModels(config, name) {
    if (name in config.fallback)
        return config.fallback[name];
    return [name];
}
function validateFallback(models, fallback) {
    const knownModels = new Set(models.map((model) => model.name));
    const duplicateNames = new Set();
    for (const model of models) {
        assertValidModelNamePattern(model.name);
        if (duplicateNames.has(model.name)) {
            throw new Error(`Duplicate model name '${model.name}'`);
        }
        duplicateNames.add(model.name);
    }
    for (const [groupName, members] of Object.entries(fallback)) {
        if (!Array.isArray(members) || members.length === 0) {
            throw new Error(`Fallback group '${groupName}' must be a non-empty model array`);
        }
        if (duplicateNames.has(groupName)) {
            throw new Error(`Duplicate public model name '${groupName}'`);
        }
        duplicateNames.add(groupName);
        const seenMembers = new Set();
        for (const member of members) {
            if (!knownModels.has(member)) {
                throw new Error(`Fallback group '${groupName}' references unknown model '${member}'`);
            }
            if (seenMembers.has(member)) {
                throw new Error(`Fallback group '${groupName}' contains duplicate model '${member}'`);
            }
            seenMembers.add(member);
        }
    }
}

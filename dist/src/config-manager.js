import { createHash } from "node:crypto";
import { readFileSync, watchFile, unwatchFile } from "node:fs";
import { materializeConfig, parseConfigDocument, parseConfigText, } from "./config.js";
const RELOAD_DEBOUNCE_MS = 150;
const WATCH_INTERVAL_MS = 500;
function hashText(text) {
    return createHash("sha256").update(text).digest("hex");
}
function sameValue(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}
function getRestartFields(intended, effective) {
    const fields = [];
    if (!sameValue(intended.port, effective.port))
        fields.push("server.port");
    if (!sameValue(intended.auth?.admin?.enabled, effective.auth?.admin?.enabled))
        fields.push("server.auth.admin.enabled");
    if (!sameValue(intended.auth?.admin?.username, effective.auth?.admin?.username))
        fields.push("server.auth.admin.username");
    if (!sameValue(intended.auth?.admin?.password, effective.auth?.admin?.password))
        fields.push("server.auth.admin.password");
    if (!sameValue(intended.auth?.api?.enabled, effective.auth?.api?.enabled))
        fields.push("server.auth.api.enabled");
    if (!sameValue(intended.auth?.api?.token, effective.auth?.api?.token))
        fields.push("server.auth.api.token");
    return fields;
}
function materializeHotConfig(document, current) {
    return materializeConfig(document, {
        port: current.port,
        adminUsername: current.auth?.admin?.username ?? "",
        adminPassword: current.auth?.admin?.password ?? "",
        apiAuthToken: current.auth?.api?.token ?? "",
    });
}
export class ConfigManager {
    configPath;
    snapshot;
    lastObservedHash = "";
    reloadTimer;
    listeners = new Set();
    constructor(configPath) {
        this.configPath = configPath;
        const rawText = readFileSync(this.configPath, "utf-8");
        const effectiveConfig = parseConfigText(rawText);
        this.snapshot = {
            version: 1,
            rawText,
            effectiveConfig,
            requiresRestartFields: [],
        };
        this.lastObservedHash = hashText(rawText);
        this.startWatching();
    }
    getActiveSnapshot() {
        return this.snapshot;
    }
    applyText(rawText, source) {
        const nextHash = hashText(rawText);
        if (source !== "startup" && nextHash === this.lastObservedHash) {
            return {
                snapshot: this.snapshot,
                appliedFields: [],
                requiresRestartFields: this.snapshot.requiresRestartFields,
            };
        }
        try {
            const document = parseConfigDocument(rawText);
            const intendedConfig = parseConfigText(rawText);
            const effectiveConfig = source === "startup"
                ? intendedConfig
                : materializeHotConfig(document, this.snapshot.effectiveConfig);
            const requiresRestartFields = getRestartFields(intendedConfig, effectiveConfig);
            this.snapshot = {
                version: this.snapshot.version + 1,
                rawText,
                effectiveConfig,
                requiresRestartFields,
            };
            this.lastObservedHash = nextHash;
            const result = {
                snapshot: this.snapshot,
                appliedFields: ["models", "fallback", "server.ttfb_timeout", "record.max_size"],
                requiresRestartFields,
            };
            for (const listener of this.listeners) {
                listener(result, source);
            }
            return result;
        }
        catch (error) {
            this.snapshot = {
                version: this.snapshot.version + 1,
                rawText,
                effectiveConfig: this.snapshot.effectiveConfig,
                requiresRestartFields: this.snapshot.requiresRestartFields,
                lastError: {
                    message: error instanceof Error ? error.message : String(error),
                    source,
                    occurredAt: Date.now(),
                },
            };
            this.lastObservedHash = nextHash;
            throw error;
        }
    }
    dispose() {
        if (this.reloadTimer)
            clearTimeout(this.reloadTimer);
        unwatchFile(this.configPath);
        this.listeners.clear();
    }
    onUpdate(listener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    startWatching() {
        watchFile(this.configPath, { interval: WATCH_INTERVAL_MS }, (current, previous) => {
            if (current.mtimeMs === previous.mtimeMs && current.size === previous.size)
                return;
            if (this.reloadTimer)
                clearTimeout(this.reloadTimer);
            this.reloadTimer = setTimeout(() => {
                this.reloadTimer = undefined;
                this.reloadFromDisk();
            }, RELOAD_DEBOUNCE_MS);
        });
    }
    reloadFromDisk() {
        try {
            const rawText = readFileSync(this.configPath, "utf-8");
            const nextHash = hashText(rawText);
            if (nextHash === this.lastObservedHash)
                return;
            this.applyText(rawText, "file-watch");
            console.log(`[CONFIG RELOAD] reloaded from ${this.configPath}`);
        }
        catch (error) {
            console.error(`[CONFIG RELOAD FAILED] ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

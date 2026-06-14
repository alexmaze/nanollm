import { useState, useCallback, useRef, useEffect } from "react";
import type { ConfigSnapshot, AdminConfigForm } from "../api";
import { api, ApiError } from "../api";

interface HydratedModel {
  _id: string;
  _expanded: boolean;
  name: string;
  provider: string;
  base_url: string;
  api_key: string;
  model: string;
  extras: Record<string, unknown>;
}

interface HydratedMember {
  _id: string;
  value: string;
}

interface HydratedGroup {
  _id: string;
  name: string;
  members: HydratedMember[];
}

export interface HydratedForm {
  rootExtras: Record<string, unknown>;
  serverExtras: Record<string, unknown>;
  recordExtras: Record<string, unknown>;
  server: { ttfb_timeout: string };
  record: { max_size: string };
  models: HydratedModel[];
  fallbackGroups: HydratedGroup[];
}

let idCounter = 0;
function nextId(prefix: string) {
  idCounter++;
  return `${prefix}-${idCounter}`;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function hydrateForm(form: AdminConfigForm): HydratedForm {
  return {
    rootExtras: (form.rootExtras || {}) as Record<string, unknown>,
    serverExtras: (form.serverExtras || {}) as Record<string, unknown>,
    recordExtras: (form.recordExtras || {}) as Record<string, unknown>,
    server: { ttfb_timeout: String(form.server?.ttfb_timeout ?? "") },
    record: { max_size: String(form.record?.max_size ?? "") },
    models: (form.models || []).map((m) => ({
      ...m,
      _id: nextId("m"),
      _expanded: false,
      extras: (m.extras || {}) as Record<string, unknown>,
    })),
    fallbackGroups: (form.fallbackGroups || []).map((g) => ({
      _id: nextId("fg"),
      name: g.name,
      members: (g.members || []).map((v) => ({ _id: nextId("fm"), value: v })),
    })),
  };
}

function dehydrateForm(form: HydratedForm): AdminConfigForm {
  return {
    rootExtras: form.rootExtras || {},
    serverExtras: form.serverExtras || {},
    recordExtras: form.recordExtras || {},
    server: { ttfb_timeout: form.server.ttfb_timeout },
    record: { max_size: form.record.max_size },
    models: form.models.map(({ _id, _expanded, ...m }) => ({ ...m, extras: m.extras || {} })),
    fallbackGroups: form.fallbackGroups.map(({ _id, name, members }) => ({
      name,
      members: members.map((m) => m.value),
    })),
  };
}

export function useConfig() {
  const [snapshot, setSnapshot] = useState<ConfigSnapshot | null>(null);
  const [form, setForm] = useState<HydratedForm | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: "" | "success" | "warn" | "error"; text: string; params?: Record<string, string | number> }>({ kind: "", text: "" });
  const initialFormRef = useRef<HydratedForm | null>(null);
  const loadedRef = useRef(false);
  // Keep a ref of dirty so the beforeunload listener always sees the latest value.
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  // Warn before closing / reloading the tab while there are unsaved edits.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const loadConfig = useCallback(async () => {
    const snap = await api.fetchConfig();
    setSnapshot(snap);
    const hf = hydrateForm(snap.form);
    setForm(hf);
    initialFormRef.current = clone(hf);
    setDirty(false);
    return snap;
  }, []);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadConfig().catch(() => setStatus({ kind: "error", text: "common.loadFailed" }));
    }
  }, [loadConfig]);

  const updateForm = useCallback((fn: (prev: HydratedForm) => HydratedForm) => {
    setForm((prev) => {
      if (!prev) return prev;
      return fn(prev);
    });
    setDirty(true);
  }, []);

  const saveConfig = useCallback(async () => {
    if (!snapshot || !form) return;
    setSaving(true);
    setStatus({ kind: "warn", text: "common.saving" });
    try {
      const result = await api.applyConfig(dehydrateForm(form), snapshot.version);
      // Success: server returns `snapshot`.
      const next = result.snapshot;
      if (!next) {
        setStatus({ kind: "error", text: "common.saveFailed" });
        return;
      }
      const hf = hydrateForm(next.form);
      setSnapshot(next);
      setForm(hf);
      initialFormRef.current = clone(hf);
      setDirty(false);
      const needsRestart = (result.requiresRestartFields?.length ?? 0) > 0;
      setStatus({
        kind: needsRestart ? "warn" : "success",
        text: needsRestart ? "common.saveSuccessRestart" : "common.saveSuccess",
      });
    } catch (e) {
      // Error responses (400/409/500) now throw an ApiError whose body carries
      // the latest server snapshot under `currentSnapshot` (NOT `snapshot`).
      const latest = e instanceof ApiError
        ? (e.body.currentSnapshot as ConfigSnapshot | undefined)
        : undefined;
      if (latest) {
        setSnapshot(latest);
        const hf = hydrateForm(latest.form);
        setForm(hf);
        initialFormRef.current = clone(hf);
        setDirty(false);
      }
      const isConflict = e instanceof ApiError && e.status === 409;
      setStatus({
        kind: "error",
        text: isConflict ? "records.configVersionConflict" : "common.errorWithMessage",
        params: isConflict ? undefined : { message: e instanceof Error ? e.message : String(e) },
      });
    } finally {
      setSaving(false);
    }
  }, [snapshot, form]);

  const refreshConfig = useCallback(async () => {
    try {
      await loadConfig();
      setStatus({ kind: "success", text: "common.refreshed" });
    } catch (e) {
      setStatus({ kind: "error", text: "common.errorWithMessage", params: { message: e instanceof Error ? e.message : String(e) } });
    }
  }, [loadConfig]);

  const resetConfig = useCallback(() => {
    if (!initialFormRef.current) return;
    setForm(clone(initialFormRef.current));
    setDirty(false);
    setStatus({ kind: "", text: "common.resetDone" });
  }, []);

  return { snapshot, form, dirty, saving, status, updateForm, saveConfig, refreshConfig, resetConfig };
}

/**
 * API client for nanollm backend.
 * In dev mode Vite proxies requests to the Hono server (8080).
 */

async function fetcher(url: string): Promise<unknown> {
  const r = await fetch(url);
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `HTTP ${r.status}`);
  }
  return r.json();
}

export interface ConfigSnapshot {
  version: number;
  configPath: string;
  rawText: string;
  effectiveConfig: { port: number };
  form: AdminConfigForm;
  endpoints: EndpointInfo[];
  port: string;
  lastError?: { message: string; source: string } | null;
}

export interface AdminConfigForm {
  rootExtras?: Record<string, unknown>;
  serverExtras?: Record<string, unknown>;
  recordExtras?: Record<string, unknown>;
  server: { port?: string; ttfb_timeout?: string };
  record: { max_size?: string };
  models: FormModel[];
  fallbackGroups: FormFallbackGroup[];
}

export interface FormModel {
  name: string;
  provider: string;
  base_url: string;
  api_key: string;
  model: string;
  extras?: Record<string, unknown>;
}

export interface FormFallbackGroup {
  name: string;
  members: string[];
}

export interface EndpointInfo {
  method: string;
  path: string;
  protocol: string;
  description: string;
}

export interface ConfigApplyResult {
  snapshot: ConfigSnapshot;
  requiresRestartFields?: string[];
  error?: string;
}

export interface StatusData {
  models: ModelStatus[];
  fallbackGroups: { name: string; members: string[] }[];
}

export interface ModelStatus {
  name: string;
  series: HealthCell[];
}

export interface HealthCell {
  totalRequests: number;
  successCount: number;
  successRate: number;
  avgTtfbMs: number;
  avgDurationMs: number;
  inputTokens: number;
  cacheReadInputTokens: number;
  nonCacheInputTokens: number;
  outputTokens: number;
  totalStreamMs: number;
}

export interface RecordSummary {
  capturedCount: number;
  limit: number;
  recentKeys: RecentRecordItem[];
  sessionStartedAt: number;
}

export interface RecentRecordItem {
  requestId: string;
  key: string;
  source: string;
  status: string;
  responseStatus?: number;
  model?: string;
  path: string;
  createdAt: number;
}

export interface RecordDetail {
  requestId: string;
  key: string;
  stream: boolean;
  createdAt: number;
  error?: { message?: string; upstream?: unknown };
  clientRequest?: { status?: string; path?: string; headers?: unknown; body?: unknown };
  clientResponse?: { status?: number; truncated?: boolean; headers?: unknown; body?: unknown };
  attempts?: RecordAttempt[];
}

export interface RecordAttempt {
  index: number;
  modelName: string;
  provider: string;
  url: string;
  request?: { headers?: unknown; body?: unknown };
  response?: { status?: number; headers?: unknown; body?: unknown };
  error?: { message?: string; upstream?: unknown };
}

export const api = {
  fetchConfig(): Promise<ConfigSnapshot> {
    return fetcher("/admin/config/data") as Promise<ConfigSnapshot>;
  },

  applyConfig(config: unknown, baseVersion: number): Promise<ConfigApplyResult> {
    return fetch("/admin/config/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config, baseVersion }),
    }).then((r) => r.json()) as Promise<ConfigApplyResult>;
  },

  fetchStatus(): Promise<StatusData> {
    return fetcher("/status/data") as Promise<StatusData>;
  },

  fetchRecordSummary(): Promise<RecordSummary> {
    return fetcher("/record/summary") as Promise<RecordSummary>;
  },

  fetchRecord(requestId: string): Promise<{ record: RecordDetail; summary?: RecordSummary }> {
    return fetcher(`/record/${encodeURIComponent(requestId)}`) as Promise<{ record: RecordDetail; summary?: RecordSummary }>;
  },

  replayRecord(requestId: string): Promise<{ requestId: string; summary: RecordSummary; status: number; error?: string }> {
    return fetch(`/record/${encodeURIComponent(requestId)}/replay`, { method: "POST" }).then((r) => r.json());
  },
};

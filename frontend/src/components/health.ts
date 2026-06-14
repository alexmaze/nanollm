import type { HealthCell, StatusData } from "../api";

export type HealthTone = "empty" | "green" | "lightgreen" | "orange" | "red";

export const BUCKETS_PER_HOUR = 12;

/** Success-rate → tone bucket. */
export function getHealthTone(cell: HealthCell | null): HealthTone {
  if (!cell || cell.totalRequests === 0) return "empty";
  if (cell.successRate >= 100) return "green";
  if (cell.successRate >= 80) return "lightgreen";
  if (cell.successRate >= 50) return "orange";
  return "red";
}

/** Solid background color for a tone (maps to Radix scale tokens). */
export const TONE_COLORS: Record<HealthTone, string> = {
  empty: "var(--gray-4)",
  green: "var(--green-9)",
  lightgreen: "var(--green-6)",
  orange: "var(--orange-9)",
  red: "var(--red-9)",
};

/** Last N health cells for a model (defaults to one hour). */
export function getModelHealthCells(
  modelName: string,
  statusData: StatusData | null | undefined,
  buckets = BUCKETS_PER_HOUR,
): HealthCell[] {
  if (!statusData) return [];
  const model = statusData.models.find((m) => m.name === modelName);
  if (!model || !model.series) return [];
  return model.series.slice(-buckets);
}

export function getModelLatestCell(
  modelName: string,
  statusData: StatusData | null | undefined,
): HealthCell | null {
  const cells = getModelHealthCells(modelName, statusData);
  return cells.length > 0 ? cells[cells.length - 1] : null;
}

export interface HealthAgg {
  ni: number;
  cr: number;
  ot: number;
  ts: number;
}

export function aggregateHealth(cells: HealthCell[]): HealthAgg {
  return cells.reduce(
    (a, c) => ({
      ni: a.ni + c.nonCacheInputTokens,
      cr: a.cr + c.cacheReadInputTokens,
      ot: a.ot + c.outputTokens,
      ts: a.ts + (c.totalStreamMs || 0),
    }),
    { ni: 0, cr: 0, ot: 0, ts: 0 },
  );
}

/** Output speed in tok/s derived from an aggregate, or null when unknown. */
export function aggSpeed(agg: HealthAgg): number | null {
  return agg.ts > 0 ? agg.ot / (agg.ts / 1000) : null;
}

export function formatTokenM(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return "0M";
  const m = v / 1000000;
  if (m >= 100) return Math.round(m) + "M";
  if (m >= 10) return m.toFixed(1) + "M";
  return m.toFixed(2) + "M";
}

export function formatSpeed(v: number | null): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return "-";
  if (v >= 100) return Math.round(v) + " tok/s";
  if (v >= 10) return v.toFixed(1) + " tok/s";
  return v.toFixed(2) + " tok/s";
}

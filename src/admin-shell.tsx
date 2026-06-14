import { renderToString } from "hono/jsx/dom/server";

function serializeForScript(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

const STYLE = /* css */ String.raw`
:root {
  color-scheme: light;
  --bg: #f1ede4;
  --panel: rgba(255, 252, 247, 0.95);
  --border: #d7cdbc;
  --text: #2f271d;
  --muted: #726451;
  --accent: #8f5b33;
  --accent-soft: rgba(143, 91, 51, 0.12);
  --accent-strong: #6f4728;
  --success: #2b9360;
  --success-soft: rgba(43, 147, 96, 0.12);
  --warning: #c67a24;
  --warning-soft: rgba(198, 122, 36, 0.12);
  --danger: #bf4c3b;
  --danger-soft: rgba(191, 76, 59, 0.12);
  --empty: #ebe2d2;
  --lightgreen: #8bcf7d;
  --shadow: 0 18px 44px rgba(67, 48, 23, 0.12);
}
* { box-sizing: border-box; margin: 0; }
body {
  font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  color: var(--text);
  background: radial-gradient(circle at top left, rgba(143, 91, 51, 0.12), transparent 24%), linear-gradient(180deg, #f8f4ec 0%, var(--bg) 100%);
  min-height: 100vh;
}
.shell { display: grid; grid-template-columns: 248px 1fr; min-height: 100vh; }
.sidebar {
  background: var(--panel); border-right: 1px solid var(--border); display: flex; flex-direction: column;
  padding: 20px 0; position: sticky; top: 0; height: 100vh; overflow-y: auto;
}
.sidebar-brand { padding: 0 20px 20px; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: var(--accent-strong); }
.sidebar-nav { flex: 1; display: flex; flex-direction: column; gap: 2px; padding: 0 8px; }
.nav-item {
  display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 12px;
  font-size: 14px; font-weight: 600; color: var(--muted); cursor: pointer; text-decoration: none;
  transition: background 120ms ease, color 120ms ease; border: none; background: none; width: 100%; text-align: left; font: inherit;
}
.nav-item:hover { background: var(--accent-soft); color: var(--text); }
.nav-item.active { background: var(--accent-soft); color: var(--accent-strong); font-weight: 700; }
.nav-separator { height: 1px; background: var(--border); margin: 8px 14px; opacity: 0.5; }
.sidebar-footer { padding: 16px 16px 0; border-top: 1px solid var(--border); margin-top: 8px; display: grid; gap: 10px; }
.sidebar-footer .toolbar { flex-direction: column; }
.sidebar-meta { font-size: 11px; color: var(--muted); line-height: 1.5; word-break: break-all; }
.content-area { padding: 24px 28px; overflow-y: auto; min-height: 100vh; }
.panel { background: var(--panel); border: 1px solid var(--border); border-radius: 22px; padding: 20px; box-shadow: var(--shadow); }
.stack { display: grid; gap: 16px; }
h1 { font-size: 28px; } h2 { font-size: 20px; margin-bottom: 14px; } h3 { font-size: 16px; }
.meta { margin: 6px 0 0; color: var(--muted); font-size: 14px; line-height: 1.55; }
.toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.section-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
button {
  appearance: none; border: 0; border-radius: 12px; padding: 11px 16px; font: inherit; font-weight: 700; cursor: pointer;
  background: var(--accent); color: #fff9f1; transition: background 120ms ease;
}
button:hover { background: var(--accent-strong); }
button.secondary { background: transparent; color: var(--accent); border: 1px solid rgba(143, 91, 51, 0.24); }
button.secondary:hover { color: var(--accent-strong); border-color: rgba(143, 91, 51, 0.42); }
button.ghost { background: rgba(84, 67, 47, 0.05); color: var(--muted); }
button.ghost:hover { background: rgba(84, 67, 47, 0.1); color: var(--text); }
button.danger { background: transparent; color: var(--danger); border: 1px solid rgba(191, 76, 59, 0.24); }
button:disabled { opacity: 0.6; cursor: wait; }
.status { min-height: 22px; font-size: 13px; color: var(--muted); }
.status.success { color: var(--success); } .status.warn { color: var(--warning); } .status.error { color: var(--danger); }
.pills { display: flex; gap: 8px; flex-wrap: wrap; }
.pill { padding: 8px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
.pill.neutral { background: var(--accent-soft); color: var(--accent); }
.pill.success { background: var(--success-soft); color: var(--success); }
.pill.warning { background: var(--warning-soft); color: var(--warning); }
.pill.error { background: var(--danger-soft); color: var(--danger); }
.note-box, .error-box { border-radius: 16px; padding: 14px 16px; font-size: 13px; line-height: 1.6; }
.note-box { background: rgba(84, 67, 47, 0.05); color: var(--muted); }
.error-box { background: var(--danger-soft); color: var(--danger); }
.field-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.field-grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.field { display: grid; gap: 6px; }
.field.span-2 { grid-column: span 2; } .field.span-3 { grid-column: span 3; }
label { font-size: 13px; font-weight: 600; color: var(--muted); }
input, select, textarea {
  width: 100%; border: 1px solid var(--border); border-radius: 12px; padding: 11px 12px; font: inherit; background: #fffdf9; color: var(--text);
}
input[type="number"] { appearance: textfield; }
.helper { font-size: 12px; color: var(--muted); line-height: 1.5; }
.card-list { display: grid; gap: 14px; }
.card { border: 1px solid rgba(143, 91, 51, 0.18); background: rgba(255, 251, 244, 0.88); border-radius: 18px; padding: 16px; display: grid; gap: 14px; }
.card.compact { gap: 10px; }
.card-head { display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; }
.card-title { display: flex; align-items: center; gap: 8px; }
.card-toggle {
  display: grid; gap: 6px; min-width: 280px; flex: 1; padding: 0; border: 0; background: transparent;
  color: inherit; text-align: left; cursor: pointer;
}
.card-toggle:hover { background: transparent; }
.card-toggle-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.card-chevron {
  width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center;
  border-radius: 999px; background: rgba(143, 91, 51, 0.1); color: var(--accent); font-size: 14px; flex: 0 0 auto;
}
.card-summary { color: var(--muted); font-size: 13px; line-height: 1.5; }
.card-body[hidden] { display: none; }
.member-list { display: grid; gap: 10px; }
.member-row {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 10px; align-items: center;
  padding: 8px 10px; border-radius: 14px; border: 1px solid rgba(143, 91, 51, 0.12); background: rgba(255, 253, 249, 0.8);
}
.member-row.drag-over { border-color: rgba(143, 91, 51, 0.4); background: rgba(143, 91, 51, 0.08); }
.drag-handle { width: 38px; min-width: 38px; padding: 8px 0; border-radius: 10px; background: rgba(143, 91, 51, 0.08); color: var(--accent); cursor: grab; }
.member-actions { display: inline-flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
code { font-family: "Consolas", "SFMono-Regular", "Menlo", monospace; font-size: 12px; }
.endpoint-list { display: grid; gap: 10px; }
.endpoint-row {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center;
  padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(143, 91, 51, 0.12); background: rgba(255, 253, 249, 0.8);
}
.endpoint-method { font-weight: 700; font-size: 12px; padding: 4px 10px; border-radius: 8px; text-align: center; min-width: 52px; }
.endpoint-method.post { background: rgba(43, 147, 96, 0.12); color: var(--success); }
.endpoint-method.get { background: rgba(143, 91, 51, 0.12); color: var(--accent); }
.endpoint-path { font-family: "Consolas", "SFMono-Regular", "Menlo", monospace; font-size: 13px; font-weight: 600; word-break: break-all; }
.endpoint-desc { font-size: 13px; color: var(--muted); line-height: 1.5; }
.endpoint-copy {
  appearance: none; border: 0; border-radius: 8px; padding: 6px 10px; font-size: 12px; cursor: pointer;
  background: rgba(84, 67, 47, 0.05); color: var(--muted); white-space: nowrap;
}
.endpoint-copy:hover { background: rgba(84, 67, 47, 0.1); color: var(--text); }
.endpoint-copy.copied { background: var(--success-soft); color: var(--success); }
.health-dot { width: 12px; height: 12px; border-radius: 3px; border: 1px solid rgba(0,0,0,0.08); flex: 0 0 auto; }
.health-dot.empty { background: var(--empty); } .health-dot.green { background: var(--success); }
.health-dot.lightgreen { background: var(--lightgreen); } .health-dot.orange { background: var(--warning); }
.health-dot.red { background: var(--danger); }
.mini-heatmap { display: flex; gap: 3px; flex-wrap: wrap; align-items: center; }
.mini-cell { width: 10px; height: 10px; border-radius: 2px; border: 1px solid rgba(0,0,0,0.06); }
.health-summary { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
.health-stat { font-size: 12px; color: var(--muted); }
.health-stat strong { color: var(--text); font-weight: 700; }
.health-section { border-top: 1px solid rgba(143,91,51,0.1); padding-top: 12px; margin-top: 12px; }
.tooltip {
  position: fixed; z-index: 1000; min-width: 220px; max-width: 280px; padding: 12px 14px; border-radius: 14px;
  background: rgba(45, 36, 24, 0.96); color: #fff8f0; box-shadow: 0 18px 48px rgba(19, 13, 8, 0.28);
  border: 1px solid rgba(255,255,255,0.08); pointer-events: none; opacity: 0; transform: translateY(6px);
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.tooltip.visible { opacity: 1; transform: translateY(0); }
.tooltip-title { margin: 0 0 10px; font-size: 13px; font-weight: 700; color: #fff; }
.tooltip-grid { display: grid; grid-template-columns: auto 1fr; gap: 6px 10px; font-size: 12px; }
.tooltip-grid dt { color: rgba(255, 245, 232, 0.68); }
.tooltip-grid dd { margin: 0; text-align: right; color: #fff8f0; }
.record-panel { position: relative; isolation: isolate; }
.recent { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px; }
.recent-key, .recent-toggle {
  appearance: none; border: 1px solid rgba(140, 90, 47, 0.18); background: #fffaf2; color: var(--accent);
  padding: 8px 10px; border-radius: 10px; font: inherit; cursor: pointer; text-align: left;
}
.recent-key { width: 260px; }
.recent-key small { display: block; color: var(--muted); font-size: 11px; margin-top: 3px; }
.recent-title-row { display: flex; align-items: center; gap: 6px; flex-wrap: nowrap; }
.recent-title { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.source-badge {
  display: inline-flex; align-items: center; justify-content: center; min-width: 28px; padding: 2px 7px;
  border-radius: 999px; font-size: 10px; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase;
}
.source-badge.claudecode { background: rgba(140, 90, 47, 0.14); color: var(--accent); }
.source-badge.codex { background: rgba(47, 92, 184, 0.14); color: #2f5cb8; }
.source-badge.opencode { background: rgba(31, 31, 31, 0.14); color: #1f1f1f; }
.source-badge.other { background: rgba(115, 101, 83, 0.14); color: var(--muted); }
.status-badge {
  display: inline-flex; align-items: center; justify-content: center; padding: 2px 7px;
  border-radius: 999px; font-size: 10px; font-weight: 800; letter-spacing: 0.02em;
}
.status-badge.in_progress { background: rgba(47, 92, 184, 0.12); color: #2f5cb8; }
.status-badge.success { background: rgba(44, 171, 99, 0.14); color: #1c8d4d; }
.status-badge.failure { background: rgba(190, 74, 56, 0.14); color: var(--danger); }
.status-badge.status-code { min-width: 32px; }
.record-section {
  border: 1px solid rgba(216, 207, 193, 0.82); border-radius: 16px; padding: 16px; background: rgba(255, 255, 255, 0.58);
}
details.record-section { padding: 0; overflow: hidden; }
details.record-section > summary { cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px; list-style: none; }
details.record-section > summary::-webkit-details-marker { display: none; }
details.record-section > summary::after { content: "展开"; color: var(--accent); font-size: 12px; font-weight: 700; }
details.record-section[open] > summary::after { content: "收起"; }
.section-body { padding: 0 16px 16px; }
.section-title { font-size: 18px; font-weight: 700; }
.kv { display: grid; grid-template-columns: 180px 1fr; gap: 8px 12px; font-size: 14px; }
.kv dt { color: var(--muted); } .kv dd { margin: 0; word-break: break-word; }
.attempt { border: 1px solid rgba(140, 90, 47, 0.16); border-radius: 14px; padding: 14px; background: rgba(255, 251, 245, 0.78); }
.attempt-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; margin-bottom: 8px; }
.subgrid { display: grid; gap: 12px; grid-template-columns: 1fr; }
.box { position: relative; border: 1px solid rgba(216, 207, 193, 0.82); border-radius: 12px; padding: 12px; background: #fffdfa; min-width: 0; }
.box-actions { position: absolute; top: 10px; right: 10px; display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; max-width: calc(100% - 24px); }
.copy-btn { padding: 6px 10px; border-radius: 10px; font-size: 12px; line-height: 1; }
.fold { border: 1px solid rgba(216, 207, 193, 0.82); border-radius: 12px; background: #fffdfa; }
.fold + .fold { margin-top: 12px; }
.fold > summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; list-style: none; color: var(--accent); font-weight: 700; cursor: pointer; }
.fold > summary::-webkit-details-marker { display: none; }
.fold > summary::after { content: "展开"; font-size: 12px; }
.fold[open] > summary::after { content: "收起"; }
.fold-body { padding: 0 12px 12px; }
.json-tree details { margin-left: 14px; }
.json-tree summary { color: var(--accent); }
.json-tree .entry { margin: 4px 0; line-height: 1.5; word-break: break-word; }
.json-tree .key { color: #8a4f1d; }
.json-tree .string { color: #0b6f51; white-space: pre-wrap; }
.json-tree .number { color: #2f5cb8; }
.json-tree .boolean, .json-tree .null { color: #8c3d8c; }
.inline-fold { display: inline-block; vertical-align: top; max-width: 100%; }
.inline-fold > summary { display: inline-flex; align-items: center; gap: 8px; list-style: none; cursor: pointer; }
.inline-fold > summary::-webkit-details-marker { display: none; }
.inline-fold > summary::after { content: "展开"; color: var(--accent); font-size: 12px; }
.inline-fold[open] > summary::after { content: "收起"; }
.inline-meta { color: var(--muted); font-size: 12px; }
.stream-list { display: grid; gap: 10px; }
.stream-meta { margin-bottom: 8px; color: var(--muted); font-size: 12px; }
pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: "Cascadia Code", "SFMono-Regular", Consolas, monospace; font-size: 12px; line-height: 1.45; }
.empty-text { color: var(--muted); font-style: italic; }
.record-actions { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.replay-status { color: var(--muted); font-size: 13px; }
.replay-status.success { color: #0b6f51; } .replay-status.failure { color: var(--danger); }
@media (max-width: 900px) {
  .shell { grid-template-columns: 1fr; }
  .sidebar {
    position: fixed; bottom: 0; left: 0; right: 0; top: auto; height: auto; flex-direction: row;
    border-right: none; border-top: 1px solid var(--border); padding: 0; z-index: 100;
    overflow-x: auto; overflow-y: hidden;
  }
  .sidebar-brand, .sidebar-footer, .nav-separator { display: none; }
  .sidebar-nav { flex-direction: row; padding: 0; gap: 0; }
  .nav-item { padding: 12px 14px; border-radius: 0; font-size: 13px; white-space: nowrap; justify-content: center; }
  .content-area { padding: 16px 14px 80px; }
  .field-grid, .field-grid.two { grid-template-columns: 1fr; }
  .field.span-2, .field.span-3 { grid-column: span 1; }
  .kv { grid-template-columns: 1fr; }
}
`;

const SCRIPT = /* js */ String.raw`
const INITIAL_PAYLOAD = __INITIAL_PAYLOAD__;
const PROVIDERS = ["openai-chat", "openai-responses", "anthropic", "openai-image"];
const STRING_PREVIEW_LENGTH = 100;
const SUMMARY_POLL_INTERVAL_MS = 3000;
const RECENT_REQUEST_LIMIT = 10;
const BUCKETS_PER_HOUR = 12;
let saving = false, dirty = false, localIdCounter = 0, pendingFocusTarget = null, draggedMember = null;
let statusData = null, statusPollTimer = null;
let recordSummary = null, recordPollTimer = null, recentExpanded = false;

function nextId(p) { localIdCounter++; return p + "-" + localIdCounter; }
function clone(v) { return JSON.parse(JSON.stringify(v)); }

/* ── Hydrate / Dehydrate ── */
function hydrateForm(form) {
  return {
    rootExtras: form.rootExtras || {}, serverExtras: form.serverExtras || {}, recordExtras: form.recordExtras || {},
    server: { port: form.server?.port ?? "", ttfb_timeout: form.server?.ttfb_timeout ?? "" },
    record: { max_size: form.record?.max_size ?? "" },
    models: (form.models || []).map((m) => ({ ...m, _id: nextId("m"), _expanded: false, extras: m.extras || {} })),
    fallbackGroups: (form.fallbackGroups || []).map((g) => ({
      ...g, _id: nextId("fg"), members: (g.members || []).map((m) => ({ _id: nextId("fm"), value: m })),
    })),
  };
}
function dehydrateForm() {
  return {
    rootExtras: formState.rootExtras || {}, serverExtras: formState.serverExtras || {}, recordExtras: formState.recordExtras || {},
    server: { ...formState.server }, record: { ...formState.record },
    models: formState.models.map(({ _id, _expanded, ...m }) => ({ ...m, extras: m.extras || {} })),
    fallbackGroups: formState.fallbackGroups.map(({ _id, members, ...g }) => ({
      ...g, members: members.map((m) => m.value),
    })),
  };
}

let currentSnapshot = INITIAL_PAYLOAD;
let formState = hydrateForm(INITIAL_PAYLOAD.form);

/* ── DOM References ── */
const viewContainer = document.getElementById("view-container");
const statusEl = document.getElementById("save-status");
const saveBtn = document.getElementById("save-button");
const refreshBtn = document.getElementById("refresh-button");
const resetBtn = document.getElementById("reset-button");
const snapshotMetaEl = document.getElementById("snapshot-meta");

/* ── Router ── */
const VIEWS = ["models", "fallback", "endpoints", "settings", "records"];
function getRoute() {
  const hash = window.location.hash.replace("#/", "").replace("#", "");
  const [view, ...rest] = hash.split("/");
  return { view: VIEWS.includes(view) ? view : "models", params: rest.join("/") };
}
function navigate(view) { window.location.hash = "#/" + view; }
function updateNav() {
  const { view } = getRoute();
  document.querySelectorAll(".nav-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.view === view);
  });
}
window.addEventListener("hashchange", () => { updateNav(); renderCurrentView(); });
document.querySelectorAll(".nav-item").forEach((el) => {
  el.addEventListener("click", () => navigate(el.dataset.view));
});

/* ── Global Actions ── */
function setStatus(kind, text) { statusEl.className = "status" + (kind ? " " + kind : ""); statusEl.textContent = text || ""; }
function setSaving(s) { saving = s; saveBtn.disabled = s; refreshBtn.disabled = s; resetBtn.disabled = s; }
function markDirty(d) { dirty = d; }
function moveArrayItem(arr, from, to) {
  if (from < 0 || to < 0 || from >= arr.length || to >= arr.length || from === to) return;
  const [item] = arr.splice(from, 1); arr.splice(to, 0, item);
}

function renderSnapshotMeta() {
  snapshotMetaEl.textContent = "v" + currentSnapshot.version + " · " + currentSnapshot.configPath + " · port " + currentSnapshot.effectiveConfig.port;
}

/* ── Field Builder ── */
function bindField(container, labelText, opts) {
  const field = document.createElement("div");
  field.className = "field" + (opts.spanClass ? " " + opts.spanClass : "");
  const label = document.createElement("label"); label.textContent = labelText;
  let control;
  if (opts.type === "select") {
    control = document.createElement("select");
    for (const v of opts.options) { const o = document.createElement("option"); o.value = v; o.textContent = v; control.appendChild(o); }
    control.value = opts.value ?? "";
  } else {
    control = document.createElement("input"); control.type = opts.type || "text"; control.value = opts.value ?? "";
    if (opts.placeholder) control.placeholder = opts.placeholder;
    if (opts.min) control.min = opts.min; if (opts.step) control.step = opts.step;
  }
  if (opts.attributes) { for (const [k, v] of Object.entries(opts.attributes)) { if (v != null) control.setAttribute(k, String(v)); } }
  control.addEventListener("input", (e) => opts.onInput(e.target.value));
  if (opts.type === "select") control.addEventListener("change", (e) => opts.onInput(e.target.value));
  field.appendChild(label); field.appendChild(control);
  if (opts.helper) { const h = document.createElement("div"); h.className = "helper"; h.textContent = opts.helper; field.appendChild(h); }
  container.appendChild(field);
}

function createBtn(label, cls, onClick) {
  const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.className = cls;
  b.addEventListener("click", onClick); return b;
}

/* ── Health Helpers ── */
function getHealthTone(cell) {
  if (!cell || cell.totalRequests === 0) return "empty";
  if (cell.successRate >= 100) return "green"; if (cell.successRate >= 80) return "lightgreen";
  if (cell.successRate >= 50) return "orange"; return "red";
}
function getModelHealthCells(modelName) {
  if (!statusData) return [];
  const model = statusData.models.find((m) => m.name === modelName);
  if (!model || !model.series) return [];
  const count = Math.min(model.series.length, BUCKETS_PER_HOUR);
  return model.series.slice(-count);
}
function getModelLatestCell(modelName) {
  const cells = getModelHealthCells(modelName);
  return cells.length > 0 ? cells[cells.length - 1] : null;
}
function formatMetric(v) { return typeof v === "number" && Number.isFinite(v) ? Math.round(v) + "ms" : "-"; }
function formatToken(v) {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return "0K";
  const k = v / 1000; return k >= 100 ? Math.round(k) + "K" : k.toFixed(1) + "K";
}
function formatTokenM(v) {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return "0M";
  const m = v / 1000000; if (m >= 100) return Math.round(m) + "M"; if (m >= 10) return m.toFixed(1) + "M"; return m.toFixed(2) + "M";
}
function formatSpeed(v) {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return "-";
  if (v >= 100) return Math.round(v) + " tok/s"; if (v >= 10) return v.toFixed(1) + " tok/s"; return v.toFixed(2) + " tok/s";
}

/* ── Status Data Fetching ── */
async function fetchStatusData() {
  try {
    const r = await fetch("/status/data", { cache: "no-store" });
    if (r.ok) { statusData = await r.json(); if (getRoute().view === "models") renderModelsView(); return true; }
  } catch {}
  return false;
}
function startStatusPoll() {
  stopStatusPoll();
  statusPollTimer = setInterval(fetchStatusData, 5000);
}
function stopStatusPoll() { if (statusPollTimer) { clearInterval(statusPollTimer); statusPollTimer = null; } }

/* ── Router Dispatch ── */
function renderCurrentView() {
  stopStatusPoll(); stopRecordPoll();
  const { view, params } = getRoute();
  viewContainer.textContent = "";
  renderSnapshotMeta();
  if (view === "models") { renderModelsView(); fetchStatusData().then(() => startStatusPoll()); }
  else if (view === "fallback") renderFallbackView();
  else if (view === "endpoints") renderEndpointsView();
  else if (view === "settings") renderSettingsView();
  else if (view === "records") { renderRecordsView(params); startRecordPoll(); }
}

/* ── Models View ── */
function formatExtrasDetail(extras) {
  const e = Object.entries(extras || {});
  if (e.length === 0) return "";
  return e.map(([k, v]) => k + ": " + (typeof v === "string" ? v : JSON.stringify(v))).join("\n");
}
function buildModelSummary(m) {
  return (m.provider || "未选") + " · " + (m.model || "未填") + " · " + (m.base_url || "未填");
}
function renderModelsView() {
  viewContainer.textContent = "";
  const wrap = document.createElement("div"); wrap.className = "stack";
  // Header panel
  const header = document.createElement("section"); header.className = "panel";
  const hdr = document.createElement("div"); hdr.className = "section-header";
  const hdrLeft = document.createElement("div");
  const h1 = document.createElement("h1"); h1.textContent = "Models";
  const meta = document.createElement("p"); meta.className = "meta";
  meta.textContent = "管理模型配置并查看实时健康状态。";
  hdrLeft.appendChild(h1); hdrLeft.appendChild(meta);
  hdr.appendChild(hdrLeft);
  hdr.appendChild(createBtn("添加模型", "secondary", () => {
    const id = nextId("m");
    formState.models.push({ _id: id, _expanded: true, name: "", provider: "openai-chat", base_url: "", api_key: "", model: "", extras: {} });
    pendingFocusTarget = "model-name-" + id; markDirty(true); renderModelsView();
  }));
  header.appendChild(hdr);
  // Pills
  const pills = document.createElement("div"); pills.className = "pills"; pills.style.marginTop = "12px";
  [{ l: "models " + formState.models.length, k: "success" }].forEach((p) => {
    const el = document.createElement("div"); el.className = "pill " + p.k; el.textContent = p.l; pills.appendChild(el);
  });
  if (currentSnapshot.lastError) {
    const el = document.createElement("div"); el.className = "pill error"; el.textContent = "加载失败"; pills.appendChild(el);
  }
  header.appendChild(pills);
  if (currentSnapshot.lastError) {
    const eb = document.createElement("div"); eb.className = "error-box"; eb.style.marginTop = "10px";
    eb.textContent = currentSnapshot.lastError.message + " (" + currentSnapshot.lastError.source + ")";
    header.appendChild(eb);
  }
  wrap.appendChild(header);
  // Model cards
  const cardsWrap = document.createElement("div"); cardsWrap.className = "card-list";
  if (formState.models.length === 0) {
    const empty = document.createElement("div"); empty.className = "note-box";
    empty.textContent = "还没有模型，点击\u201c添加模型\u201d开始配置。"; cardsWrap.appendChild(empty);
  } else {
    formState.models.forEach((model, index) => cardsWrap.appendChild(buildModelCard(model, index)));
  }
  wrap.appendChild(cardsWrap);
  viewContainer.appendChild(wrap);
  focusPendingTarget();
}

function buildModelCard(model, index) {
  const card = document.createElement("section"); card.className = "card" + (model._expanded ? "" : " compact");
  const head = document.createElement("div"); head.className = "card-head";
  const toggle = document.createElement("button"); toggle.type = "button"; toggle.className = "card-toggle";
  toggle.addEventListener("click", () => { model._expanded = !model._expanded; renderModelsView(); });
  const toggleTop = document.createElement("div"); toggleTop.className = "card-toggle-top";
  const chevron = document.createElement("span"); chevron.className = "card-chevron";
  chevron.textContent = model._expanded ? "▾" : "▸"; toggleTop.appendChild(chevron);
  const title = document.createElement("div"); title.className = "card-title";
  const h3 = document.createElement("h3"); h3.textContent = model.name?.trim() || "未命名模型 " + (index + 1);
  title.appendChild(h3);
  // Health dot
  const latest = getModelLatestCell(model.name);
  const dot = document.createElement("span"); dot.className = "health-dot " + getHealthTone(latest);
  dot.title = latest ? "成功率 " + latest.successRate.toFixed(1) + "%" : "无数据";
  title.appendChild(dot);
  if (model.extras && Object.keys(model.extras).length > 0) {
    const badge = document.createElement("div"); badge.className = "pill neutral"; badge.textContent = "高级字段";
    badge.title = formatExtrasDetail(model.extras); title.appendChild(badge);
  }
  toggleTop.appendChild(title); toggle.appendChild(toggleTop);
  const summary = document.createElement("div"); summary.className = "card-summary";
  summary.textContent = buildModelSummary(model); toggle.appendChild(summary);
  head.appendChild(toggle);
  head.appendChild(createBtn("删除", "danger", () => {
    formState.models = formState.models.filter((m) => m._id !== model._id);
    formState.fallbackGroups.forEach((g) => { g.members = g.members.filter((m) => m.value !== model.name); });
    markDirty(true); renderModelsView();
  }));
  card.appendChild(head);
  if (model._expanded) {
    const body = document.createElement("div"); body.className = "card-body";
    // Config form
    const grid = document.createElement("div"); grid.className = "field-grid two";
    bindField(grid, "name", {
      value: model.name, attributes: { "data-focus-id": "model-name-" + model._id },
      onInput(v) {
        const prev = model.name; model.name = v;
        if (prev !== v) formState.fallbackGroups.forEach((g) => { g.members.forEach((m) => { if (m.value === prev) m.value = v; }); });
        markDirty(true); pendingFocusTarget = "model-name-" + model._id; renderModelsView();
      },
    });
    bindField(grid, "provider", { type: "select", options: PROVIDERS, value: model.provider || PROVIDERS[0], onInput(v) { model.provider = v; markDirty(true); } });
    bindField(grid, "base_url", { value: model.base_url, placeholder: "https://example.com/v1", onInput(v) { model.base_url = v; markDirty(true); } });
    bindField(grid, "model", { value: model.model, placeholder: "上游真实模型名", onInput(v) { model.model = v; markDirty(true); } });
    bindField(grid, "api_key", { spanClass: "span-2", value: model.api_key, placeholder: "支持直接填 key 或 \u0024{ENV_VAR}", onInput(v) { model.api_key = v; markDirty(true); } });
    body.appendChild(grid);
    // Health summary section
    const healthCells = getModelHealthCells(model.name);
    if (healthCells.length > 0 || statusData) {
      const hs = document.createElement("div"); hs.className = "health-section";
      const hsTitle = document.createElement("div"); hsTitle.style.cssText = "font-size:13px;font-weight:700;margin-bottom:8px;color:var(--muted)";
      hsTitle.textContent = "健康状态 (最近 1 小时)"; hs.appendChild(hsTitle);
      const heatmap = document.createElement("div"); heatmap.className = "mini-heatmap";
      healthCells.forEach((cell) => {
        const c = document.createElement("span"); c.className = "mini-cell health-dot " + getHealthTone(cell);
        c.title = formatMetric(cell.avgTtfbMs) + " · " + cell.successRate.toFixed(1) + "%";
        heatmap.appendChild(c);
      });
      if (healthCells.length === 0) {
        const noData = document.createElement("span"); noData.className = "helper"; noData.textContent = "暂无数据"; heatmap.appendChild(noData);
      }
      hs.appendChild(heatmap);
      // Stats
      const stats = document.createElement("div"); stats.className = "health-summary";
      const agg = healthCells.reduce((a, c) => ({ ni: a.ni + c.nonCacheInputTokens, cr: a.cr + c.cacheReadInputTokens, ot: a.ot + c.outputTokens, ts: a.ts + (c.totalStreamMs || 0) }), { ni: 0, cr: 0, ot: 0, ts: 0 });
      const speed = agg.ts > 0 ? agg.ot / (agg.ts / 1000) : null;
      [["Input", formatTokenM(agg.ni)], ["Cache", formatTokenM(agg.cr)], ["Output", formatTokenM(agg.ot)], ["Speed", formatSpeed(speed)]].forEach(([l, v]) => {
        const s = document.createElement("span"); s.className = "health-stat";
        s.innerHTML = l + " <strong>" + v + "</strong>"; stats.appendChild(s);
      });
      hs.appendChild(stats);
      body.appendChild(hs);
    }
    card.appendChild(body);
  }
  return card;
}

/* ── Fallback View ── */
function getModelNameOptions() { return formState.models.map((m) => (m.name || "").trim()).filter(Boolean); }
function getDuplicateMembers(g) {
  const c = new Map();
  for (const m of g.members) { const v = (m.value || "").trim(); if (!v) continue; c.set(v, (c.get(v) || 0) + 1); }
  return Array.from(c.entries()).filter(([, n]) => n > 1).map(([v]) => v);
}
function renderFallbackView() {
  viewContainer.textContent = "";
  const wrap = document.createElement("div"); wrap.className = "stack";
  const header = document.createElement("section"); header.className = "panel";
  const hdr = document.createElement("div"); hdr.className = "section-header";
  const hdrLeft = document.createElement("div");
  const h1 = document.createElement("h1"); h1.textContent = "Fallback Groups";
  const meta = document.createElement("p"); meta.className = "meta";
  meta.textContent = "为分组命名后，从已配置的模型里选择成员，支持拖拽排序。";
  hdrLeft.appendChild(h1); hdrLeft.appendChild(meta); hdr.appendChild(hdrLeft);
  hdr.appendChild(createBtn("添加分组", "secondary", () => {
    const id = nextId("fg");
    formState.fallbackGroups.push({ _id: id, name: "", members: [] });
    pendingFocusTarget = "fg-name-" + id; markDirty(true); renderFallbackView();
  }));
  header.appendChild(hdr);
  const pills = document.createElement("div"); pills.className = "pills"; pills.style.marginTop = "12px";
  const p = document.createElement("div"); p.className = "pill neutral"; p.textContent = "groups " + formState.fallbackGroups.length; pills.appendChild(p);
  header.appendChild(pills); wrap.appendChild(header);
  // Groups
  const cardsWrap = document.createElement("div"); cardsWrap.className = "card-list";
  const options = getModelNameOptions();
  if (formState.fallbackGroups.length === 0) {
    const empty = document.createElement("div"); empty.className = "note-box";
    empty.textContent = "还没有 fallback 分组。"; cardsWrap.appendChild(empty);
  } else {
    formState.fallbackGroups.forEach((group, gi) => {
      const card = document.createElement("section"); card.className = "card";
      const dup = getDuplicateMembers(group);
      const ch = document.createElement("div"); ch.className = "card-head";
      const ct = document.createElement("div"); ct.className = "card-title";
      const ch3 = document.createElement("h3"); ch3.textContent = group.name?.trim() || "未命名 " + (gi + 1);
      ct.appendChild(ch3); ch.appendChild(ct);
      ch.appendChild(createBtn("删除", "danger", () => {
        formState.fallbackGroups = formState.fallbackGroups.filter((g) => g._id !== group._id);
        markDirty(true); renderFallbackView();
      }));
      card.appendChild(ch);
      const grid = document.createElement("div"); grid.className = "field-grid";
      bindField(grid, "group name", {
        spanClass: "span-3", value: group.name, attributes: { "data-focus-id": "fg-name-" + group._id },
        placeholder: "例如 gpt-5.4", onInput(v) {
          group.name = v; markDirty(true); pendingFocusTarget = "fg-name-" + group._id; renderFallbackView();
        },
      });
      card.appendChild(grid);
      const ml = document.createElement("div"); ml.className = "member-list";
      if (dup.length > 0) { const eb = document.createElement("div"); eb.className = "error-box"; eb.textContent = "重复模型: " + dup.join(", "); ml.appendChild(eb); }
      if (group.members.length === 0) { const h = document.createElement("div"); h.className = "helper"; h.textContent = "无成员"; ml.appendChild(h); }
      group.members.forEach((member, mi) => {
        const row = document.createElement("div"); row.className = "member-row"; row.draggable = true;
        row.addEventListener("dragstart", (e) => { draggedMember = { groupId: group._id, memberId: member._id }; if (e.dataTransfer) { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", member._id); } });
        row.addEventListener("dragend", () => { draggedMember = null; ml.querySelectorAll(".member-row.drag-over").forEach((el) => el.classList.remove("drag-over")); });
        row.addEventListener("dragover", (e) => { if (!draggedMember || draggedMember.groupId !== group._id || draggedMember.memberId === member._id) return; e.preventDefault(); row.classList.add("drag-over"); });
        row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
        row.addEventListener("drop", (e) => {
          if (!draggedMember || draggedMember.groupId !== group._id) return; e.preventDefault(); row.classList.remove("drag-over");
          const fi = group.members.findIndex((m) => m._id === draggedMember.memberId);
          const ti = group.members.findIndex((m) => m._id === member._id);
          if (fi === -1 || ti === -1 || fi === ti) return; moveArrayItem(group.members, fi, ti); markDirty(true); renderFallbackView();
        });
        const handle = createBtn("⋮⋮", "ghost drag-handle", () => {}); handle.title = "拖拽排序"; row.appendChild(handle);
        const select = document.createElement("select");
        const blank = document.createElement("option"); blank.value = ""; blank.textContent = options.length === 0 ? "请先添加模型" : "选择模型"; select.appendChild(blank);
        const used = new Set(group.members.filter((m) => m._id !== member._id).map((m) => m.value).filter(Boolean));
        for (const ov of options) { if (used.has(ov) && ov !== member.value) continue; const o = document.createElement("option"); o.value = ov; o.textContent = ov; select.appendChild(o); }
        select.value = member.value || "";
        select.setAttribute("data-focus-id", "fg-member-" + member._id);
        select.addEventListener("change", (e) => { member.value = e.target.value; markDirty(true); pendingFocusTarget = "fg-member-" + member._id; renderFallbackView(); });
        const actions = document.createElement("div"); actions.className = "member-actions";
        actions.appendChild(createBtn("上移", "ghost", () => { if (mi === 0) return; moveArrayItem(group.members, mi, mi - 1); markDirty(true); pendingFocusTarget = "fg-member-" + member._id; renderFallbackView(); }));
        actions.appendChild(createBtn("下移", "ghost", () => { if (mi === group.members.length - 1) return; moveArrayItem(group.members, mi, mi + 1); markDirty(true); pendingFocusTarget = "fg-member-" + member._id; renderFallbackView(); }));
        actions.appendChild(createBtn("删除", "ghost", () => { group.members = group.members.filter((m) => m._id !== member._id); markDirty(true); renderFallbackView(); }));
        row.appendChild(select); row.appendChild(actions); ml.appendChild(row);
      });
      card.appendChild(ml);
      card.appendChild(createBtn("添加模型到分组", "secondary", () => {
        const mid = nextId("fm"); const used = new Set(group.members.map((m) => m.value).filter(Boolean));
        const nv = options.find((o) => !used.has(o)) || "";
        group.members.push({ _id: mid, value: nv }); markDirty(true); pendingFocusTarget = "fg-member-" + mid; renderFallbackView();
      }));
      cardsWrap.appendChild(card);
    });
  }
  wrap.appendChild(cardsWrap); viewContainer.appendChild(wrap); focusPendingTarget();
}

/* ── Endpoints View ── */
function renderEndpointsView() {
  viewContainer.textContent = "";
  const wrap = document.createElement("div"); wrap.className = "stack";
  const panel = document.createElement("section"); panel.className = "panel";
  const h1 = document.createElement("h1"); h1.textContent = "API Endpoints";
  const meta = document.createElement("p"); meta.className = "meta";
  meta.textContent = "网关支持的代理协议地址。将 base_url 设为网关地址即可使用对应协议。";
  panel.appendChild(h1); panel.appendChild(meta);
  const list = document.createElement("div"); list.className = "endpoint-list"; list.style.marginTop = "16px";
  const port = currentSnapshot.port || window.location.port;
  const base = window.location.protocol + "//" + window.location.hostname + (port ? ":" + port : "");
  (currentSnapshot.endpoints || []).forEach((ep) => {
    const row = document.createElement("div"); row.className = "endpoint-row";
    const method = document.createElement("span"); method.className = "endpoint-method " + ep.method.toLowerCase(); method.textContent = ep.method; row.appendChild(method);
    const pw = document.createElement("div");
    const pe = document.createElement("div"); pe.className = "endpoint-path"; pe.textContent = ep.path; pw.appendChild(pe);
    const de = document.createElement("div"); de.className = "endpoint-desc"; de.textContent = ep.protocol + " · " + ep.description; pw.appendChild(de);
    row.appendChild(pw);
    const copy = document.createElement("button"); copy.type = "button"; copy.className = "endpoint-copy"; copy.textContent = "复制 URL";
    copy.addEventListener("click", () => {
      navigator.clipboard.writeText(base + ep.path).then(() => { copy.textContent = "已复制"; copy.classList.add("copied"); setTimeout(() => { copy.textContent = "复制 URL"; copy.classList.remove("copied"); }, 1500); });
    });
    row.appendChild(copy); list.appendChild(row);
  });
  panel.appendChild(list); wrap.appendChild(panel); viewContainer.appendChild(wrap);
}

/* ── Settings View ── */
function renderSettingsView() {
  viewContainer.textContent = "";
  const wrap = document.createElement("div"); wrap.className = "stack";
  const panel = document.createElement("section"); panel.className = "panel";
  const h1 = document.createElement("h1"); h1.textContent = "Global Settings";
  const meta = document.createElement("p"); meta.className = "meta";
  meta.textContent = "version " + currentSnapshot.version + " · config " + currentSnapshot.configPath + " · port " + currentSnapshot.effectiveConfig.port;
  panel.appendChild(h1); panel.appendChild(meta);
  const grid = document.createElement("div"); grid.className = "field-grid"; grid.style.marginTop = "16px";
  bindField(grid, "server.ttfb_timeout", {
    type: "number", min: "1", step: "1", value: formState.server.ttfb_timeout,
    helper: "正整数，单位毫秒。保存后新请求立即生效。", onInput(v) { formState.server.ttfb_timeout = v; markDirty(true); },
  });
  bindField(grid, "record.max_size", {
    type: "number", min: "1", step: "1", value: formState.record.max_size,
    helper: "正整数。保存后调整采样记录上限。", onInput(v) { formState.record.max_size = v; markDirty(true); },
  });
  panel.appendChild(grid);
  const nb = document.createElement("div"); nb.className = "note-box"; nb.style.marginTop = "14px";
  nb.textContent = "port 修改需重启服务。API Key 输入框支持 \u0024{ENV_VAR} 占位写法。";
  panel.appendChild(nb);
  if (currentSnapshot.lastError) {
    const eb = document.createElement("div"); eb.className = "error-box"; eb.style.marginTop = "10px";
    eb.textContent = currentSnapshot.lastError.message + " (" + currentSnapshot.lastError.source + ")";
    panel.appendChild(eb);
  }
  wrap.appendChild(panel); viewContainer.appendChild(wrap);
}

/* ── Records View ── */
const REQUEST_ID_DATALIST_ID = "req-id-opts";
function startRecordPoll() {
  stopRecordPoll();
  recordPollTimer = setInterval(async () => {
    try { const r = await fetch("/record/summary", { cache: "no-store" }); if (r.ok) { recordSummary = await r.json(); updateRecordSummaryUI(); } } catch {}
  }, SUMMARY_POLL_INTERVAL_MS);
}
function stopRecordPoll() { if (recordPollTimer) { clearInterval(recordPollTimer); recordPollTimer = null; } }

function getSourceBadgeLabel(s) { return s === "claudecode" ? "CC" : s === "codex" ? "Codex" : s === "opencode" ? "OpenCode" : "Other"; }
function getStatusBadgeClass(item) {
  if (typeof item.responseStatus === "number") return "status-badge status-code " + (item.responseStatus >= 400 ? "failure" : item.responseStatus >= 200 && item.responseStatus < 300 ? "success" : "in_progress");
  return "status-badge " + item.status;
}
function getStatusBadgeLabel(item) {
  if (typeof item.responseStatus === "number") return String(item.responseStatus);
  return item.status === "success" ? "成功" : item.status === "failure" ? "失败" : "请求中...";
}

function renderRecordsView(params) {
  viewContainer.textContent = "";
  const wrap = document.createElement("div"); wrap.className = "stack";
  const panel = document.createElement("section"); panel.className = "panel record-panel"; panel.id = "record-panel";
  const h1 = document.createElement("h1"); h1.textContent = "Request Records";
  const meta = document.createElement("p"); meta.className = "meta";
  meta.textContent = "输入 requestId 或点击最近请求查看详情。";
  panel.appendChild(h1); panel.appendChild(meta);
  // Search
  const toolbar = document.createElement("div"); toolbar.className = "toolbar"; toolbar.style.marginTop = "16px";
  const inputWrap = document.createElement("div"); inputWrap.style.flex = "1";
  const lbl = document.createElement("label"); lbl.textContent = "requestId"; lbl.setAttribute("for", "req-id"); inputWrap.appendChild(lbl);
  const input = document.createElement("input"); input.id = "req-id"; input.placeholder = "例如 6dfae2ab-1234-...";
  const datalist = document.createElement("datalist"); datalist.id = REQUEST_ID_DATALIST_ID; inputWrap.appendChild(input); inputWrap.appendChild(datalist);
  toolbar.appendChild(inputWrap);
  toolbar.appendChild(createBtn("查询", "", async () => { await queryRecord(input.value.trim()); }));
  panel.appendChild(toolbar);
  // Summary + Recent + Content containers
  const summaryEl = document.createElement("div"); summaryEl.className = "pills"; summaryEl.id = "rec-summary"; summaryEl.style.marginTop = "12px";
  const recentEl = document.createElement("div"); recentEl.className = "recent"; recentEl.id = "rec-recent";
  const contentEl = document.createElement("div"); contentEl.id = "rec-content"; contentEl.style.marginTop = "16px";
  const emptySec = document.createElement("section"); emptySec.className = "record-section";
  const emptyText = document.createElement("div"); emptyText.className = "empty-text"; emptyText.textContent = "还没有加载记录。";
  emptySec.appendChild(emptyText); contentEl.appendChild(emptySec);
  panel.appendChild(summaryEl); panel.appendChild(recentEl); panel.appendChild(contentEl);
  wrap.appendChild(panel); viewContainer.appendChild(wrap);
  // Load summary
  fetch("/record/summary", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((s) => {
    if (s) { recordSummary = s; updateRecordSummaryUI(); }
  }).catch(() => {});
  // Check URL params
  const hash = window.location.hash;
  const qIdx = hash.indexOf("?");
  if (qIdx > 0) {
    const params = new URLSearchParams(hash.slice(qIdx));
    const rid = params.get("requestId");
    if (rid) { input.value = rid; queryRecord(rid); }
  }
}

function updateRecordSummaryUI() {
  if (!recordSummary) return;
  const summaryEl = document.getElementById("rec-summary");
  const recentEl = document.getElementById("rec-recent");
  if (!summaryEl || !recentEl) return;
  summaryEl.textContent = "";
  [["已采样", recordSummary.capturedCount], ["上限", recordSummary.limit], ["启动于", new Date(recordSummary.sessionStartedAt ?? Date.now()).toLocaleString("zh-CN")]].forEach(([l, v]) => {
    const p = document.createElement("div"); p.className = "pill neutral"; p.textContent = l + "：" + v; summaryEl.appendChild(p);
  });
  // Datalist options
  const dl = document.getElementById(REQUEST_ID_DATALIST_ID);
  if (dl) { dl.textContent = ""; if (recordSummary.recentKeys) { const seen = new Set(); recordSummary.recentKeys.forEach((item) => { if (seen.has(item.requestId)) return; seen.add(item.requestId); const o = document.createElement("option"); o.value = item.requestId; o.label = item.key + " · " + item.path; dl.appendChild(o); }); } }
  // Recent buttons
  recentEl.textContent = "";
  const items = recordSummary.recentKeys || [];
  const visible = recentExpanded ? items : items.slice(0, RECENT_REQUEST_LIMIT);
  visible.forEach((item) => {
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "recent-key";
    const tr = document.createElement("div"); tr.className = "recent-title-row";
    const t = document.createElement("div"); t.className = "recent-title"; t.textContent = item.key; tr.appendChild(t);
    const sb = document.createElement("span"); sb.className = "source-badge " + item.source; sb.textContent = getSourceBadgeLabel(item.source); tr.appendChild(sb);
    const stb = document.createElement("span"); stb.className = getStatusBadgeClass(item); stb.textContent = getStatusBadgeLabel(item); tr.appendChild(stb);
    btn.appendChild(tr);
    const mr = document.createElement("div"); mr.className = "recent-model-row";
    const m = document.createElement("span"); m.className = "recent-model" || ""; m.textContent = item.model || "-"; mr.appendChild(m);
    btn.appendChild(mr);
    const sm = document.createElement("small"); sm.textContent = item.path + " · " + new Date(item.createdAt).toLocaleTimeString("zh-CN"); btn.appendChild(sm);
    btn.addEventListener("click", () => { const inp = document.getElementById("req-id"); if (inp) inp.value = item.requestId; queryRecord(item.requestId); });
    recentEl.appendChild(btn);
  });
  if (!recentExpanded && items.length > RECENT_REQUEST_LIMIT) {
    const more = document.createElement("button"); more.type = "button"; more.className = "recent-toggle"; more.textContent = "...";
    more.addEventListener("click", () => { recentExpanded = true; updateRecordSummaryUI(); }); recentEl.appendChild(more);
  }
  if (recentExpanded && items.length > RECENT_REQUEST_LIMIT) {
    const col = document.createElement("button"); col.type = "button"; col.className = "recent-toggle"; col.textContent = "<";
    col.addEventListener("click", () => { recentExpanded = false; updateRecordSummaryUI(); }); recentEl.appendChild(col);
  }
}

async function queryRecord(requestId) {
  const contentEl = document.getElementById("rec-content");
  if (!contentEl) return;
  if (!requestId) { contentEl.textContent = ""; const s = document.createElement("section"); s.className = "record-section"; const d = document.createElement("div"); d.className = "error-box"; d.textContent = "请先输入 requestId。"; s.appendChild(d); contentEl.appendChild(s); return; }
  try {
    const r = await fetch("/record/" + encodeURIComponent(requestId), { cache: "no-store" });
    const payload = await r.json();
    if (payload.summary) { recordSummary = payload.summary; updateRecordSummaryUI(); }
    if (!r.ok) { contentEl.textContent = ""; const s = document.createElement("section"); s.className = "record-section"; const d = document.createElement("div"); d.className = "error-box"; d.textContent = payload.error || "查询失败"; s.appendChild(d); contentEl.appendChild(s); return; }
    renderRecordDetail(contentEl, payload.record);
  } catch (e) { contentEl.textContent = ""; const s = document.createElement("section"); s.className = "record-section"; const d = document.createElement("div"); d.className = "error-box"; d.textContent = e instanceof Error ? e.message : "查询失败"; s.appendChild(d); contentEl.appendChild(s); }
}

/* ── Record Detail ── */
function renderRecordDetail(container, record) {
  container.textContent = "";
  const stack = document.createElement("div"); stack.className = "stack";
  // Basic info
  const base = document.createElement("section"); base.className = "record-section";
  const bh = document.createElement("h2"); bh.textContent = "基本信息"; base.appendChild(bh);
  const kv = document.createElement("dl"); kv.className = "kv";
  [["requestId", record.requestId], ["key", record.key], ["path", record.clientRequest?.path], ["stream", record.stream], ["createdAt", record.createdAt ? new Date(record.createdAt).toLocaleString("zh-CN") : "-"], ["error", record.error?.message ?? ""]].forEach(([k, v]) => {
    const dt = document.createElement("dt"); dt.textContent = k; const dd = document.createElement("dd"); dd.textContent = v == null || v === "" ? "-" : String(v);
    kv.appendChild(dt); kv.appendChild(dd);
  });
  base.appendChild(kv);
  // Replay
  const rw = document.createElement("div"); rw.className = "record-actions";
  const rb = document.createElement("button"); rb.type = "button";
  rb.textContent = record.clientRequest?.status === "in_progress" ? "Replaying..." : "Replay";
  rb.disabled = record.clientRequest?.status === "in_progress";
  const rs = document.createElement("span"); rs.className = "replay-status"; rs.textContent = "Sensitive headers not replayed; uses current config.";
  rb.addEventListener("click", async () => {
    if (!record.requestId) return; rb.disabled = true; rb.textContent = "Replaying...";
    rs.className = "replay-status"; rs.textContent = "Replaying...";
    try {
      const r = await fetch("/record/" + encodeURIComponent(record.requestId) + "/replay", { method: "POST", cache: "no-store" });
      const p = await r.json(); if (p.summary) { recordSummary = p.summary; updateRecordSummaryUI(); }
      if (!r.ok || !p.requestId) { rs.className = "replay-status failure"; rs.textContent = p.error || "Replay failed"; rb.disabled = false; rb.textContent = "Replay"; return; }
      rs.className = "replay-status success"; rs.textContent = "New record: " + p.requestId;
      const inp = document.getElementById("req-id"); if (inp) inp.value = p.requestId;
      await queryRecord(p.requestId);
    } catch (e) { rs.className = "replay-status failure"; rs.textContent = e instanceof Error ? e.message : "Replay failed"; }
    finally { rb.disabled = record.clientRequest?.status === "in_progress"; rb.textContent = "Replay"; }
  });
  rw.appendChild(rb); rw.appendChild(rs); base.appendChild(rw); stack.appendChild(base);
  // Client Request
  const crSec = createCollapsibleSec("Client Request");
  const crGrid = document.createElement("div"); crGrid.className = "subgrid";
  appendBodyBox(crGrid, "Headers", record.clientRequest?.headers);
  appendBodyBox(crGrid, "Body", record.clientRequest?.body);
  crSec.body.appendChild(crGrid); stack.appendChild(crSec.section);
  // Attempts
  const atSec = document.createElement("section"); atSec.className = "record-section";
  const atH = document.createElement("h2"); atH.textContent = "Attempts"; atSec.appendChild(atH);
  const atStack = document.createElement("div"); atStack.className = "stack";
  if (!record.attempts?.length) { const e = document.createElement("div"); e.className = "empty-text"; e.textContent = "没有上游请求记录。"; atStack.appendChild(e); }
  else {
    record.attempts.forEach((att) => {
      const card = document.createElement("div"); card.className = "attempt";
      const ah = document.createElement("div"); ah.className = "attempt-head";
      const at = document.createElement("h3"); at.textContent = "#" + att.index + " " + att.modelName + " (" + att.provider + ")"; ah.appendChild(at); card.appendChild(ah);
      const akv = document.createElement("dl"); akv.className = "kv";
      [["url", att.url], ["status", att.response?.status], ["error", att.error?.message ?? ""]].forEach(([k, v]) => {
        const dt = document.createElement("dt"); dt.textContent = k; const dd = document.createElement("dd"); dd.textContent = v == null || v === "" ? "-" : String(v);
        akv.appendChild(dt); akv.appendChild(dd);
      });
      card.appendChild(akv);
      const urFold = createFold("Upstream Request");
      const urGrid = document.createElement("div"); urGrid.className = "subgrid";
      appendBodyBox(urGrid, "Headers", att.request?.headers);
      appendBodyBox(urGrid, "Body", att.request?.body);
      urFold.body.appendChild(urGrid); card.appendChild(urFold.fold);
      const uresFold = createFold("Upstream Response");
      const uresGrid = document.createElement("div"); uresGrid.className = "subgrid";
      appendBodyBox(uresGrid, "Headers", att.response?.headers);
      appendBodyBox(uresGrid, "Body", att.response?.body, { streamText: record.stream });
      if (att.error?.upstream !== undefined) appendBodyBox(uresGrid, "Upstream Error Body", att.error.upstream);
      uresFold.body.appendChild(uresGrid); card.appendChild(uresFold.fold);
      atStack.appendChild(card);
    });
  }
  atSec.appendChild(atStack); stack.appendChild(atSec);
  // Client Response
  const cresSec = createCollapsibleSec("Client Response");
  const cresKV = document.createElement("dl"); cresKV.className = "kv";
  [["status", record.clientResponse?.status], ["truncated", record.clientResponse?.truncated ? "yes" : "no"]].forEach(([k, v]) => {
    const dt = document.createElement("dt"); dt.textContent = k; const dd = document.createElement("dd"); dd.textContent = v == null || v === "" ? "-" : String(v);
    cresKV.appendChild(dt); cresKV.appendChild(dd);
  });
  cresSec.body.appendChild(cresKV);
  const cresGrid = document.createElement("div"); cresGrid.className = "subgrid";
  appendBodyBox(cresGrid, "Headers", record.clientResponse?.headers);
  appendBodyBox(cresGrid, "Body", record.clientResponse?.body, { streamText: record.stream });
  cresSec.body.appendChild(cresGrid); stack.appendChild(cresSec.section);
  container.appendChild(stack);
}

function createCollapsibleSec(title) {
  const s = document.createElement("details"); s.className = "record-section";
  const sum = document.createElement("summary"); const sp = document.createElement("span"); sp.className = "section-title"; sp.textContent = title; sum.appendChild(sp); s.appendChild(sum);
  const body = document.createElement("div"); body.className = "section-body"; s.appendChild(body);
  return { section: s, body };
}
function createFold(title) {
  const f = document.createElement("details"); f.className = "fold";
  const sum = document.createElement("summary"); sum.textContent = title; f.appendChild(sum);
  const body = document.createElement("div"); body.className = "fold-body"; f.appendChild(body);
  return { fold: f, body };
}

/* ── Body Box + JSON Tree ── */
function appendBodyBox(parent, title, value, options) {
  const box = document.createElement("div"); box.className = "box";
  const h = document.createElement("h3"); h.textContent = title; box.appendChild(h);
  const isStream = options?.streamText === true && typeof value === "string";
  if (value != null && value !== "") {
    const actions = document.createElement("div"); actions.className = "box-actions";
    const copyBtn = createBtn("复制", "copy-btn secondary", () => {
      const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
      navigator.clipboard.writeText(text).then(() => { copyBtn.textContent = "已复制"; setTimeout(() => { copyBtn.textContent = "复制"; }, 1500); });
    });
    actions.appendChild(copyBtn); box.appendChild(actions);
  }
  if (value == null || value === "") { const e = document.createElement("div"); e.className = "empty-text"; e.textContent = "无内容"; box.appendChild(e); }
  else if (isStream) {
    const events = parseStreamEvents(value);
    if (events && events.length > 0) {
      const reconstructed = reconstructStreamResponse(events);
      if (reconstructed) { const fold = createFold("完整响应"); fold.body.appendChild(createValueNode(reconstructed, { expandedDepth: 1 })); box.appendChild(fold.fold); }
      const listFold = createFold("流事件 (" + events.length + ")");
      const list = document.createElement("div"); list.className = "stream-list";
      const limit = 50;
      for (let i = 0; i < Math.min(events.length, limit); i++) {
        const ef = createFold("#" + (i + 1) + " " + (events[i].event || "data"));
        if (events[i].event) { const m = document.createElement("div"); m.className = "stream-meta"; m.textContent = "event: " + events[i].event; ef.body.appendChild(m); }
        ef.body.appendChild(createValueNode(events[i].parsed ?? events[i].data));
        list.appendChild(ef.fold);
      }
      if (events.length > limit) {
        const showAll = document.createElement("button"); showAll.className = "secondary"; showAll.textContent = "显示全部 " + events.length + " 个"; showAll.style.marginTop = "8px";
        showAll.addEventListener("click", () => { showAll.remove(); for (let i = limit; i < events.length; i++) {
          const ef = createFold("#" + (i + 1) + " " + (events[i].event || "data"));
          ef.body.appendChild(createValueNode(events[i].parsed ?? events[i].data)); list.appendChild(ef.fold);
        } });
        list.appendChild(showAll);
      }
      listFold.body.appendChild(list); box.appendChild(listFold.fold);
    } else { const pre = document.createElement("pre"); pre.textContent = value; box.appendChild(pre); }
  } else if (typeof value === "string") { const pre = document.createElement("pre"); pre.textContent = value; box.appendChild(pre); }
  else { const tree = document.createElement("div"); tree.className = "json-tree"; tree.appendChild(createValueNode(value)); box.appendChild(tree); }
  parent.appendChild(box);
}

function createValueNode(value, options) {
  const depth = options?.depth ?? 0;
  const expDepth = typeof options?.expandedDepth === "number" ? options.expandedDepth : null;
  const exp = options?.expanded === true || (expDepth !== null && depth < expDepth);
  const childOpts = options ? { ...options, depth: depth + 1 } : undefined;
  if (value === null) { const s = document.createElement("span"); s.className = "null"; s.textContent = "null"; return s; }
  if (Array.isArray(value)) {
    const d = document.createElement("details"); d.open = exp;
    const sum = document.createElement("summary"); sum.textContent = "Array(" + value.length + ")"; d.appendChild(sum);
    const body = document.createElement("div"); d.appendChild(body);
    function render() { value.forEach((item, i) => { const e = document.createElement("div"); e.className = "entry"; const k = document.createElement("span"); k.className = "key"; k.textContent = i + ": "; e.appendChild(k); e.appendChild(createValueNode(item, childOpts)); body.appendChild(e); }); }
    if (exp) render(); else { let done = false; d.addEventListener("toggle", () => { if (done || !d.open) return; done = true; render(); }); }
    return d;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value); const d = document.createElement("details"); d.open = exp;
    const sum = document.createElement("summary"); sum.textContent = "Object{" + entries.length + "}"; d.appendChild(sum);
    const body = document.createElement("div"); d.appendChild(body);
    function render() { for (const [k, v] of entries) { const e = document.createElement("div"); e.className = "entry"; const key = document.createElement("span"); key.className = "key"; key.textContent = k + ": "; e.appendChild(key); e.appendChild(createValueNode(v, childOpts)); body.appendChild(e); } }
    if (exp) render(); else { let done = false; d.addEventListener("toggle", () => { if (done || !d.open) return; done = true; render(); }); }
    return d;
  }
  if (typeof value === "string") {
    const quoted = JSON.stringify(value);
    if (value.length <= STRING_PREVIEW_LENGTH) { const s = document.createElement("span"); s.className = "string"; s.textContent = quoted; return s; }
    const d = document.createElement("details"); d.className = "inline-fold";
    const sum = document.createElement("summary");
    const preview = document.createElement("span"); preview.className = "string"; preview.textContent = JSON.stringify(value.slice(0, STRING_PREVIEW_LENGTH) + "\u2026");
    const meta = document.createElement("span"); meta.className = "inline-meta"; meta.textContent = value.length + " chars";
    sum.appendChild(preview); sum.appendChild(meta); d.appendChild(sum);
    const body = document.createElement("div"); body.className = "entry"; const full = document.createElement("span"); full.className = "string"; full.textContent = quoted; body.appendChild(full); d.appendChild(body);
    return d;
  }
  const s = document.createElement("span");
  if (typeof value === "number") { s.className = "number"; s.textContent = String(value); }
  else if (typeof value === "boolean") { s.className = "boolean"; s.textContent = String(value); }
  else { s.textContent = String(value); }
  return s;
}

/* ── Stream Parsing ── */
function parseStreamEvents(text) {
  const n = text.replaceAll("\r\n", "\n");
  if (!/^(data|event|id|retry):/m.test(n)) return null;
  const events = []; let curEvent, curData = [], curId, curRetry, sawField = false, sawAny = false;
  function flush() {
    if (!sawField) return;
    const data = curData.join("\n"); let parsed;
    if (data && data !== "[DONE]") { try { parsed = JSON.parse(data); } catch {} }
    events.push({ event: curEvent, data, parsed, id: curId, retry: curRetry });
    curEvent = undefined; curData = []; curId = undefined; curRetry = undefined; sawField = false; sawAny = true;
  }
  for (const line of n.split("\n")) {
    if (line === "") { flush(); continue; }
    if (line.startsWith(":")) { sawField = true; continue; }
    if (line.startsWith("data:")) { curData.push(line.slice(5).trimStart()); sawField = true; continue; }
    if (line.startsWith("event:")) { curEvent = line.slice(6).trimStart(); sawField = true; continue; }
    if (line.startsWith("id:")) { curId = line.slice(3).trimStart(); sawField = true; continue; }
    if (line.startsWith("retry:")) { curRetry = line.slice(6).trimStart(); sawField = true; continue; }
    if (!sawField || curData.length === 0) return null;
    curData[curData.length - 1] += "\n" + line;
  }
  flush(); return sawAny ? events : null;
}

function reconstructStreamResponse(events) {
  return reconstructOpenAIResponsesStream(events) ?? reconstructOpenAIChatStream(events) ?? reconstructAnthropicStream(events);
}
function reconstructOpenAIChatStream(events) {
  let state = null; const toolMap = new Map(); let text = "", refusal = "", reasoning = "", saw = false;
  for (const { parsed: p } of events) {
    if (!p || typeof p !== "object" || p.object !== "chat.completion.chunk") continue; saw = true;
    if (!state) state = { id: p.id, created: p.created, model: p.model, finishReason: null, usage: null };
    if (p.usage) state.usage = p.usage;
    const c = Array.isArray(p.choices) ? p.choices[0] : null; if (!c) continue;
    if (c.finish_reason != null) state.finishReason = c.finish_reason;
    const d = c.delta ?? {};
    if (typeof d.content === "string" && d.content) text += d.content;
    if (typeof d.refusal === "string" && d.refusal) refusal += d.refusal;
    if (typeof d.reasoning === "string" && d.reasoning) reasoning += d.reasoning;
    else if (typeof d.reasoning_content === "string" && d.reasoning_content) reasoning += d.reasoning_content;
    if (Array.isArray(d.tool_calls)) d.tool_calls.forEach((tc) => {
      const idx = Number.isFinite(tc.index) ? tc.index : 0;
      let e = toolMap.get(idx);
      if (!e) { e = { id: tc.id || "call_" + idx, type: "function", function: { name: tc.function?.name || "", arguments: "" } }; toolMap.set(idx, e); }
      if (tc.id) e.id = tc.id; if (tc.function?.name) e.function.name = tc.function.name;
      if (tc.function?.arguments) e.function.arguments += tc.function.arguments;
    });
  }
  if (!saw || !state) return null;
  const msg = { role: "assistant", content: null, refusal: refusal || null };
  if (reasoning) msg.reasoning = reasoning;
  if (text && refusal) msg.content = [{ type: "text", text }, { type: "refusal", refusal }];
  else if (refusal) msg.content = [{ type: "refusal", refusal }];
  else if (text) msg.content = text;
  const tcs = [...toolMap.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  if (tcs.length > 0) msg.tool_calls = tcs;
  return { id: state.id, object: "chat.completion", created: state.created, model: state.model, choices: [{ index: 0, message: msg, finish_reason: state.finishReason ?? (tcs.length > 0 ? "tool_calls" : "stop"), logprobs: null }], usage: state.usage };
}
function reconstructAnthropicStream(events) {
  let response = null, saw = false; const toolBufs = new Map();
  function finalizeTool(i) { const b = response?.content?.[i]; if (!b || b.type !== "tool_use") return; const p = toolBufs.get(i); if (!p) { b.input = b.input && typeof b.input === "object" ? b.input : {}; return; } try { b.input = JSON.parse(p); } catch { b.input = { raw: p }; } }
  for (const { parsed: p } of events) {
    if (!p || typeof p !== "object" || typeof p.type !== "string") continue;
    const t = p.type;
    if (!["message_start", "content_block_start", "content_block_delta", "content_block_stop", "message_delta", "message_stop"].includes(t)) continue;
    saw = true;
    if (t === "message_start" && p.message && typeof p.message === "object") { response = JSON.parse(JSON.stringify(p.message)); if (!Array.isArray(response.content)) response.content = []; continue; }
    if (!response) continue;
    if (t === "content_block_start") { const i = p.index, b = p.content_block ?? {}; if (b.type === "text") response.content[i] = { type: "text", text: b.text ?? "", citations: b.citations ?? null }; else if (b.type === "thinking") response.content[i] = { type: "thinking", thinking: b.thinking ?? "", signature: b.signature ?? "" }; else if (b.type === "redacted_thinking") response.content[i] = { type: "redacted_thinking", data: b.data ?? "" }; else if (b.type === "tool_use") { response.content[i] = { type: "tool_use", id: b.id, caller: b.caller ?? { type: "direct" }, name: b.name, input: {} }; toolBufs.set(i, ""); } continue; }
    if (t === "content_block_delta") { const i = p.index, b = response.content[i], d = p.delta ?? {}; if (!b || !d.type) continue; if (d.type === "text_delta") b.text = (b.text ?? "") + (d.text ?? ""); else if (d.type === "thinking_delta") b.thinking = (b.thinking ?? "") + (d.thinking ?? ""); else if (d.type === "signature_delta") b.signature = (b.signature ?? "") + (d.signature ?? ""); else if (d.type === "input_json_delta") toolBufs.set(i, (toolBufs.get(i) ?? "") + (d.partial_json ?? "")); continue; }
    if (t === "content_block_stop") { finalizeTool(p.index); continue; }
    if (t === "message_delta") { response.stop_reason = p.delta?.stop_reason ?? response.stop_reason ?? null; response.stop_sequence = p.delta?.stop_sequence ?? response.stop_sequence ?? null; if (p.usage) response.usage = p.usage; continue; }
    if (t === "message_stop") { for (const i of toolBufs.keys()) finalizeTool(i); return response; }
  }
  if (!saw || !response) return null;
  for (const i of toolBufs.keys()) finalizeTool(i);
  return response;
}
function reconstructOpenAIResponsesStream(events) {
  let lastResponse = null, saw = false;
  for (const item of events) {
    const p = item.parsed; if (!p || typeof p !== "object") continue;
    const type = item.event || p.type; if (typeof type !== "string" || !type.startsWith("response.")) continue; saw = true;
    if (p.response && typeof p.response === "object") lastResponse = p.response;
    if (type === "response.completed" && p.response) { if (Array.isArray(p.response.output) && p.response.output.length > 0) return p.response; }
  }
  if (!saw) return null;
  if (!lastResponse) lastResponse = { id: "", object: "response", status: "completed", output: [], model: "", created_at: 0 };
  return lastResponse;
}

/* ── Save / Refresh / Reset ── */
function focusPendingTarget(opts) {
  if (!pendingFocusTarget) return;
  const t = document.querySelector("[data-focus-id=\"" + pendingFocusTarget + "\"]");
  if (!t) return; pendingFocusTarget = null;
  requestAnimationFrame(() => { if (!opts?.skipScroll) t.scrollIntoView({ behavior: "smooth", block: "center" }); t.focus({ preventScroll: true }); });
}

async function refreshFromServer() {
  const r = await fetch("/admin/config/data", { cache: "no-store" });
  const p = await r.json(); if (!r.ok) throw new Error(p.error || "刷新失败");
  currentSnapshot = p; formState = hydrateForm(p.form); markDirty(false); renderCurrentView();
}

async function saveConfig() {
  setSaving(true); setStatus("warn", "正在保存...");
  try {
    const r = await fetch("/admin/config/apply", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: dehydrateForm(), baseVersion: currentSnapshot.version }),
    });
    const p = await r.json();
    if (!r.ok) {
      if (p.currentSnapshot) { currentSnapshot = p.currentSnapshot; if (r.status === 409) formState = hydrateForm(p.currentSnapshot.form); renderCurrentView(); }
      setStatus(r.status === 409 ? "error" : "error", r.status === 409 ? "配置已被外部更新，请先刷新" : (p.error || "保存失败"));
      return;
    }
    currentSnapshot = p.snapshot; formState = hydrateForm(p.snapshot.form); markDirty(false); renderCurrentView();
    setStatus(p.requiresRestartFields?.length > 0 ? "warn" : "success", p.requiresRestartFields?.length > 0 ? "保存成功。port 变更需重启。" : "保存成功，配置已生效。");
  } catch (e) { setStatus("error", e instanceof Error ? e.message : "保存失败"); }
  finally { setSaving(false); }
}

saveBtn.addEventListener("click", () => saveConfig().catch((e) => { setSaving(false); setStatus("error", e instanceof Error ? e.message : "保存失败"); }));
refreshBtn.addEventListener("click", () => refreshFromServer().then(() => setStatus("success", "已刷新")).catch((e) => setStatus("error", e instanceof Error ? e.message : "刷新失败")));
resetBtn.addEventListener("click", () => { formState = hydrateForm(currentSnapshot.form); markDirty(false); renderCurrentView(); setStatus("", "已撤销修改"); });

window.addEventListener("pageshow", (e) => {
  if (saving || dirty) return;
  if (e?.persisted || (performance.getEntriesByType?.("navigation")?.[0]?.type === "back_forward")) {
    refreshFromServer().catch((e) => setStatus("error", e instanceof Error ? e.message : "刷新失败"));
  }
});

/* ── Init ── */
if (!window.location.hash) window.location.hash = "#/models";
updateNav();
renderCurrentView();
`;

function AdminShell({ payload }: { payload: Record<string, unknown> }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>nanollm admin</title>
        <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      </head>
      <body>
        <div class="shell">
          <nav class="sidebar">
            <div class="sidebar-brand">nanollm</div>
            <div class="sidebar-nav">
              <button class="nav-item" data-view="models">Models</button>
              <button class="nav-item" data-view="fallback">Fallback Groups</button>
              <div class="nav-separator"></div>
              <button class="nav-item" data-view="endpoints">API Endpoints</button>
              <button class="nav-item" data-view="settings">Global Settings</button>
              <div class="nav-separator"></div>
              <button class="nav-item" data-view="records">Request Records</button>
            </div>
            <div class="sidebar-footer">
              <div class="toolbar">
                <button id="save-button" type="button" style="width:100%">保存并应用</button>
                <button id="refresh-button" class="secondary" type="button" style="width:100%">刷新</button>
                <button id="reset-button" class="ghost" type="button" style="width:100%">撤销修改</button>
              </div>
              <div class="status" id="save-status"></div>
              <div class="sidebar-meta" id="snapshot-meta"></div>
            </div>
          </nav>
          <main class="content-area">
            <div id="view-container"></div>
          </main>
        </div>
        <aside class="tooltip" id="tooltip" aria-hidden="true">
          <p class="tooltip-title" id="tooltip-title"></p>
          <dl class="tooltip-grid" id="tooltip-grid"></dl>
        </aside>
        <script
          dangerouslySetInnerHTML={{
            __html: SCRIPT.replace("__INITIAL_PAYLOAD__", serializeForScript(payload)),
          }}
        />
      </body>
    </html>
  );
}

export function renderAdminShell(payload: Record<string, unknown>): string {
  return "<!doctype html>" + renderToString(<AdminShell payload={payload} />);
}

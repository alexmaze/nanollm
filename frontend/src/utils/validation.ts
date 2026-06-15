/**
 * Lightweight form validation helpers. Pure functions returning error keys
 * (empty string when valid) so callers can render inline error text.
 */

/** Non-empty after trimming. */
export function required(value: string): boolean {
  return value.trim().length > 0;
}

/** Positive integer string. */
export function positiveInt(value: string): boolean {
  if (!/^\d+$/.test(value.trim())) return false;
  const n = Number(value);
  return Number.isInteger(n) && n > 0;
}

/** Empty or positive integer. */
export function optionalPositiveInt(value: string): boolean {
  if (!value.trim()) return true;
  return positiveInt(value);
}

/** Empty or valid TCP port (1–65535). */
export function optionalPort(value: string): boolean {
  if (!value.trim()) return true;
  if (!/^\d+$/.test(value.trim())) return false;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 65535;
}

/** Empty or positive number (allows non-integers, e.g. timeouts in ms). */
export function optionalPositiveNumber(value: string): boolean {
  if (!value.trim()) return true;
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

/** Empty or http/https URL. */
export function optionalHttpUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Try to parse JSON; returns true on empty string or valid JSON. */
export function optionalJsonObject(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const parsed = JSON.parse(value);
    return parsed === null || typeof parsed === "object";
  } catch {
    return false;
  }
}

export interface ModelFieldErrors {
  name?: string;
  base_url?: string;
  model?: string;
  ttfb_timeout?: string;
  proxy?: string;
  body?: string;
}

export interface ModelAdvancedErrors {
  ttfb_timeout?: string;
  proxy?: string;
  body?: string;
}

/**
 * Validate advanced (extras) fields of a single model.
 * `extras` is the raw model.extras object from the hydrated form.
 */
export function validateModelAdvanced(extras: Record<string, unknown>): ModelAdvancedErrors {
  const errors: ModelAdvancedErrors = {};
  const ttfb = String(extras.ttfb_timeout ?? "");
  if (!optionalPositiveNumber(ttfb)) errors.ttfb_timeout = "validation.positiveNumber";
  const proxy = String(extras.proxy ?? "");
  if (!optionalHttpUrl(proxy)) errors.proxy = "validation.validUrl";
  const body = extras.body;
  if (body !== undefined && body !== null && typeof body === "object" && !Array.isArray(body)) {
    // object form is always valid
  } else if (typeof body === "string" && body.trim() && !optionalJsonObject(body)) {
    errors.body = "validation.validJson";
  }
  return errors;
}

/**
 * Validate a single model definition against the configured models list.
 * Returns a map of field → i18n key for the first error on each field.
 * `ownIndex` excludes the model itself when checking name uniqueness.
 */
export function validateModel(
  model: { name: string; base_url: string; model: string },
  allNames: string[],
  ownIndex: number,
): ModelFieldErrors {
  const errors: ModelFieldErrors = {};
  const trimmedName = model.name.trim();

  if (!required(model.name)) {
    errors.name = "validation.required";
  } else {
    const duplicateAt = allNames.findIndex((n, i) => i !== ownIndex && n.trim() === trimmedName);
    if (duplicateAt !== -1) errors.name = "validation.duplicateName";
  }

  if (!required(model.base_url)) errors.base_url = "validation.required";
  if (!required(model.model)) errors.model = "validation.required";
  return errors;
}

export interface SettingsFieldErrors {
  ttfb_timeout?: string;
  max_size?: string;
  port?: string;
  adminUsername?: string;
  adminPassword?: string;
  apiToken?: string;
}

export function validateSettings(
  server: { port: string; ttfb_timeout: string; auth: { admin: { enabled: string; username: string; password: string }; api: { enabled: string; token: string } } },
  record: { max_size: string },
): SettingsFieldErrors {
  const errors: SettingsFieldErrors = {};
  if (!positiveInt(server.ttfb_timeout)) errors.ttfb_timeout = "validation.positiveInt";
  if (!positiveInt(record.max_size)) errors.max_size = "validation.positiveInt";
  if (server.port.trim() && !optionalPort(server.port)) errors.port = "validation.validPort";
  if (server.auth.admin.enabled === "true") {
    if (!server.auth.admin.username.trim()) errors.adminUsername = "validation.required";
    if (!server.auth.admin.password.trim()) errors.adminPassword = "validation.required";
  }
  if (server.auth.api.enabled === "true") {
    if (!server.auth.api.token.trim()) errors.apiToken = "validation.required";
  }
  return errors;
}

export function hasErrors(errors: Record<string, string | undefined> | object): boolean {
  return Object.values(errors).some((v) => Boolean(v));
}

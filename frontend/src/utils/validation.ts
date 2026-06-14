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

export interface ModelFieldErrors {
  name?: string;
  base_url?: string;
  model?: string;
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
}

export function validateSettings(server: { ttfb_timeout: string }, record: { max_size: string }): SettingsFieldErrors {
  const errors: SettingsFieldErrors = {};
  if (!positiveInt(server.ttfb_timeout)) errors.ttfb_timeout = "validation.positiveInt";
  if (!positiveInt(record.max_size)) errors.max_size = "validation.positiveInt";
  return errors;
}

export function hasErrors(errors: Record<string, string | undefined> | object): boolean {
  return Object.values(errors).some((v) => Boolean(v));
}

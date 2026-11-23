import { isRecord } from "./json";
import { createPersistedStore, type Store } from "./store";

/** For each setting with a fixed set of values, the values a saved copy may hold. */
export type AllowedValues<T> = { [K in keyof T]?: readonly T[K][] };

/**
 * A saved group of settings read back over its defaults: each saved value is kept only when it has the
 * default's type and, where `allowed` lists values, is one of them. Anything else falls back to the default,
 * so an old or damaged copy can never put a screen into a state it can't show.
 */
export function readSettings<T extends object>(
  raw: string | null,
  defaults: T,
  allowed: AllowedValues<T> = {},
): T {
  let saved: unknown;
  try {
    saved = raw ? JSON.parse(raw) : null;
  } catch {
    saved = null;
  }
  if (!isRecord(saved)) return defaults;
  const out = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const v: unknown = saved[key as string];
    const ok = allowed[key];
    if (typeof v === typeof defaults[key] && (!ok || (ok as readonly unknown[]).includes(v))) {
      out[key] = v as T[typeof key];
    }
  }
  return out;
}

/** A group of settings saved to localStorage under `key`, so it survives the app being closed. */
export const createSettingsStore = <T extends object>(
  key: string,
  defaults: T,
  allowed: AllowedValues<T> = {},
): Store<T> =>
  createPersistedStore(
    key,
    (raw) => readSettings(raw, defaults, allowed),
    (v) => JSON.stringify(v),
  );

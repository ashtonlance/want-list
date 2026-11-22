/** Small runtime readers for JSON that comes from the database or the network. */

export type JsonRecord = Record<string, unknown>;

export const isRecord = (v: unknown): v is JsonRecord =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/** A string, or a number turned into one (card numbers are stored both ways). */
export const strish = (v: unknown): string | undefined =>
  typeof v === "string" ? v : typeof v === "number" ? String(v) : undefined;

export const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

/** A number, or null when the value is explicitly empty. */
export const numOrNull = (v: unknown): number | null | undefined => (v === null ? null : num(v));

export const bool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);

export const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export const numRecord = (v: unknown): Record<string, number> => {
  if (!isRecord(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, x] of Object.entries(v)) if (typeof x === "number") out[k] = x;
  return out;
};

/** Returns the value only when it is one of the allowed literals. */
export function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return allowed.find((a) => a === v);
}

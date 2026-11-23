// Made once: toLocaleString with options builds a new formatter on every call, which adds up over a
// screenful of prices.
const money = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const longDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/** "$1,234.50", or "" when there's no number. */
export function formatMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "";
  return "$" + money.format(n);
}

/** "Nov 22, 2026" from a YYYY-MM-DD date (or anything Date can read). */
export function formatDate(s: string | null | undefined): string {
  if (!s) return "";
  const d = new Date(s.length === 10 ? s + "T12:00:00" : s);
  return Number.isNaN(d.getTime()) ? s : longDate.format(d);
}

/** Today as YYYY-MM-DD in local time. */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function slugify(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-and-/g, "-")
    .replace(/^-|-$/g, "");
}

/** Collection and binder names: single spaces, at most 60 characters. */
export function cleanName(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
}

/** Card numbers sort by their digits; letter-prefixed numbers (TG05, SV052) sort after plain ones. */
export function numberSortKey(n: string | number | null | undefined): number {
  const m = /^(\D*)(\d+)/.exec(String(n ?? ""));
  return m ? (m[1] ? 1e6 : 0) + Number(m[2]) : 0;
}

export const plural = (n: number, one: string, many = one + "s"): string => `${n} ${n === 1 ? one : many}`;

/**
 * A typed-in dollar amount, or null when it isn't one. A comma is a thousands separator only before
 * groups of three digits ("1,250"); otherwise it's taken as a decimal point ("12,50"), never dropped.
 */
export function parseMoney(raw: string): number | null {
  let v = raw.replace(/[$\s]/g, "");
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(v)) v = v.replace(/,/g, "");
  else if (/^\d+,\d{1,2}$/.test(v)) v = v.replace(",", ".");
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(v)) return null;
  const n = Math.round(Number(v) * 100) / 100;
  return n > 0 ? n : null;
}

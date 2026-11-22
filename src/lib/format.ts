/** "$1,234.50", or "" when there's no number. */
export function formatMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "Nov 22, 2026" from a YYYY-MM-DD date (or anything Date can read). */
export function formatDate(s: string | null | undefined): string {
  if (!s) return "";
  const d = new Date(s.length === 10 ? s + "T12:00:00" : s);
  return Number.isNaN(d.getTime())
    ? s
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

import { today } from "~/lib/format";

/** When a set came out: a decade, 2025 on for the current sets, or not out yet. */
export type Era = "any" | "soon" | "now" | "2020s" | "2010s" | "2000s" | "1990s";

export const ERA_OPTIONS: readonly { value: Era; label: string }[] = [
  { value: "any", label: "Any year" },
  { value: "now", label: "2025 and newer" },
  { value: "2020s", label: "2020s" },
  { value: "2010s", label: "2010s" },
  { value: "2000s", label: "2000s" },
  { value: "1990s", label: "1990s" },
];

/** The same, with sets that aren't out yet. */
export const FEED_ERA_OPTIONS: readonly { value: Era; label: string }[] = [
  { value: "any", label: "Any year" },
  { value: "soon", label: "Not out yet" },
  ...ERA_OPTIONS.slice(1),
];

/** Whether a set released on `date` (YYYY-MM-DD, or "" when unknown) falls in `era`. */
export function inEra(date: string, era: Era, now: string = today()): boolean {
  if (era === "any") return true;
  if (era === "soon") return date > now;
  const year = Number(date.slice(0, 4));
  if (!year) return false;
  if (era === "now") return year >= 2025;
  const start = Number(era.slice(0, 4));
  return year >= start && year < start + 10;
}

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "~/data/keys";
import { isRecord, str } from "~/lib/json";
import { pidOf } from "./pricing";
import type { Card } from "./types";

/**
 * prices-history.json, added to by the daily sync: each tracked card's TCGplayer market price per day for
 * the last 90 days, in cents, every series as long as `days` (tools/lib/history.mjs).
 */
export interface PriceHistory {
  asOf: string;
  days: string[];
  items: Record<string, Record<string, (number | null)[]>>;
  /** Release dates of tracked cards from sets out within the window, by product id. */
  released: Record<string, string>;
}

export interface PricePoint {
  day: string;
  price: number;
}

export function parseHistory(v: unknown): PriceHistory | null {
  if (!isRecord(v) || !Array.isArray(v.days) || !isRecord(v.items)) return null;
  const days = v.days.filter((d): d is string => typeof d === "string");
  if (days.length !== v.days.length) return null;
  const items: PriceHistory["items"] = {};
  for (const [pid, subs] of Object.entries(v.items)) {
    if (!isRecord(subs)) continue;
    const out: Record<string, (number | null)[]> = {};
    for (const [sub, series] of Object.entries(subs)) {
      if (Array.isArray(series) && series.length === days.length)
        out[sub] = series.map((c) => (typeof c === "number" && c > 0 ? c : null));
    }
    items[pid] = out;
  }
  const released: PriceHistory["released"] = {};
  if (isRecord(v.released))
    for (const [pid, day] of Object.entries(v.released))
      if (typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day)) released[pid] = day;
  return { asOf: str(v.asOf) ?? days.at(-1) ?? "", days, items, released };
}

async function fetchHistory(): Promise<PriceHistory | null> {
  const r = await fetch(import.meta.env.BASE_URL + "prices-history.json", { cache: "no-cache" });
  return r.ok ? parseHistory(await r.json()) : null;
}

export const historyQuery = {
  queryKey: queryKeys.priceHistory,
  queryFn: fetchHistory,
  // It changes once a day, with the sync.
  staleTime: 60 * 60_000,
} as const;

export function usePriceHistory() {
  return useQuery(historyQuery);
}

/**
 * The card's market price by day, for the printing its price comes from, oldest first. The card's own
 * price (today's prices.json) is the latest point, so the trend always ends on the price the card shows,
 * whether the cached history is a day behind it or a day ahead.
 */
export function pricePoints(
  hist: PriceHistory | null | undefined,
  c: Pick<Card, "tcg" | "listing">,
): PricePoint[] {
  const pid = pidOf(c);
  const tcg = c.tcg;
  const series = hist && pid && tcg?.sub ? hist.items[String(pid)]?.[tcg.sub] : undefined;
  if (!series || !hist || !tcg) return [];
  // Days after the card's own price (a history fresher than a cached prices.json) are left off too.
  const until = tcg.market != null && tcg.asOf ? tcg.asOf : null;
  // A market price of zero means no sales, not a free card.
  const own = tcg.market != null && tcg.market > 0 ? tcg.market : null;
  const out: PricePoint[] = [];
  series.forEach((cents, i) => {
    const day = hist.days[i];
    if (cents != null && day && (until == null || day < until)) out.push({ day, price: cents / 100 });
  });
  if (until != null && own != null) out.push({ day: until, price: own });
  return out;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNum = (d: string) => Date.parse(d + "T00:00:00Z") / DAY_MS;

/** A drop is flagged when the price is this far under its usual level… */
export const DROP_SHARE = 0.15;
/** …and at least this many dollars under it, so a $3 card moving 40¢ isn't news. */
export const DROP_MIN = 1;
/** "Usual" is the median of the days before today, over this many days. */
export const DROP_WINDOW = 30;
/** The usual price needs at least this many priced days before today… */
export const DROP_MIN_DAYS = 7;
/** …spread over at least this many calendar days. */
export const DROP_MIN_SPAN = 14;
/**
 * A new set's first prices are left out for this many days after its release: they fall as presales
 * settle, and that shouldn't read as a drop. So a new card shows a drop four weeks after release at the
 * soonest (this plus DROP_MIN_SPAN).
 */
export const DROP_SETTLE = 14;

export interface PriceDrop {
  /** What it usually went for over the window, before today. */
  from: number;
  now: number;
  /** How far under, as a share of `from` (0.14 is 14%). */
  share: number;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] ?? 0) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
};

/**
 * Whether the latest price is meaningfully under the usual one: the median (so a one-day spike doesn't
 * count) of the 30 days before it, leaving out anything before a gap of more than a week and, for a card
 * `released` within the window, its first two weeks. Only a latest price from within a few days of `asOf`.
 */
export function priceDrop(points: readonly PricePoint[], asOf: string, released?: string): PriceDrop | null {
  const last = points.at(-1);
  if (!last || last.price <= 0 || dayNum(asOf) - dayNum(last.day) > 3) return null;
  const end = dayNum(last.day);
  // The days before a gap of more than a week say little about what's usual now.
  let from = points.length - 1;
  while (from > 0 && dayNum(points[from]?.day ?? "") - dayNum(points[from - 1]?.day ?? "") <= 7) from--;
  const settled = released ? dayNum(released) + DROP_SETTLE : -Infinity;
  const start = Math.max(dayNum(points[from]?.day ?? ""), settled, end - DROP_WINDOW);
  const before = points.slice(0, -1).filter((p) => dayNum(p.day) >= start);
  const oldest = before[0];
  if (!oldest || before.length < DROP_MIN_DAYS || end - dayNum(oldest.day) < DROP_MIN_SPAN) return null;
  // In cents, so a drop of exactly 15% isn't lost to rounding.
  const usual = median(before.map((p) => Math.round(p.price * 100)));
  const under = usual - Math.round(last.price * 100);
  const share = under / usual;
  return share >= DROP_SHARE && under >= DROP_MIN * 100
    ? { from: usual / 100, now: last.price, share }
    : null;
}

/** "14%", rounded down so a drop is never overstated. */
export const sharePct = (share: number): string => `${Math.floor(share * 100)}%`;

export interface PriceTrend {
  points: PricePoint[];
  first: PricePoint;
  last: PricePoint;
  low: number;
  high: number;
  /** Change from the first day shown to the latest, as a share of the first. */
  change: number;
}

/** The trend to draw: needs at least two days. */
export function priceTrend(points: PricePoint[]): PriceTrend | null {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last || points.length < 2) return null;
  const prices = points.map((p) => p.price);
  return {
    points,
    first,
    last,
    low: Math.min(...prices),
    high: Math.max(...prices),
    change: (last.price - first.price) / first.price,
  };
}

/** The card's drop, from the shared history query; null while it loads or when there's none. */
export function usePriceDrop(c: Card): PriceDrop | null {
  const { data } = usePriceHistory();
  // No drop beside a price of zero, which would come from an older day than the price shown.
  if (!data || !((c.tcg?.market ?? 0) > 0)) return null;
  const pid = pidOf(c);
  return priceDrop(pricePoints(data, c), latestDay(data, c), pid ? data.released[String(pid)] : undefined);
}

/** The newest day either the history or the card's own price is from. */
export const latestDay = (hist: PriceHistory, c: Pick<Card, "tcg">): string => {
  const own = c.tcg?.asOf ?? "";
  return own > hist.asOf ? own : hist.asOf;
};

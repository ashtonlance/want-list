import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "~/data/keys";
import { isRecord, str } from "~/lib/json";

/** TCGplayer prices by sub-type ("Holofoil", "Normal"…): [market, lowest listing]. */
export type SubPrices = Record<string, [number | null, number | null]>;

/** prices.json, rebuilt every day by the sync job: prices by TCGplayer product id. */
export interface PriceFile {
  asOf: string;
  items: Record<string, SubPrices>;
}

const priceOrNull = (v: unknown): number | null => (typeof v === "number" ? v : null);

export function parsePriceFile(v: unknown): PriceFile | null {
  if (!isRecord(v) || !isRecord(v.items)) return null;
  const items: Record<string, SubPrices> = {};
  for (const [pid, subs] of Object.entries(v.items)) {
    if (!isRecord(subs)) continue;
    const out: SubPrices = {};
    for (const [sub, pair] of Object.entries(subs)) {
      if (Array.isArray(pair)) out[sub] = [priceOrNull(pair[0]), priceOrNull(pair[1])];
    }
    items[pid] = out;
  }
  return { asOf: str(v.asOf) ?? "", items };
}

async function fetchPrices(): Promise<PriceFile | null> {
  const r = await fetch(import.meta.env.BASE_URL + "prices.json", { cache: "no-cache" });
  return r.ok ? parsePriceFile(await r.json()) : null;
}

export const pricesQuery = {
  queryKey: queryKeys.prices,
  queryFn: fetchPrices,
  staleTime: 30 * 60_000,
} as const;

export function usePrices() {
  return useQuery(pricesQuery);
}

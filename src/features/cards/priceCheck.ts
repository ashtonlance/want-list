import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { catalogQuery, realPrice, setOf, type Catalog } from "~/features/catalog/catalog";
import { matchCatalog } from "~/features/catalog/match";
import { fetchTdPrices, fetchTdSets, type TdPrices } from "~/features/explore/tcgdex";
import { today } from "~/lib/format";
import { queryKeys } from "~/data/keys";
import { useCardWrites, type UpdateResult } from "./api";
import { pricesQuery, type PriceFile } from "./prices";
import { isManual, pickSub, pidOf } from "./pricing";
import { NO_ASK, type Ask, type Card, type CardPatch } from "./types";

/**
 * The automatic price check. It matches the card to its TCGplayer product in the daily catalog, then
 * takes today's TCGplayer price for the card's printing: from prices.json when the daily sync already
 * tracks the product, else live from TCGdex (which carries TCGplayer's prices by sub-type), else the
 * catalog's market price. Once the card has a product, the daily sync keeps its price fresh.
 *
 * `transient` marks a miss caused by a source that didn't answer: nothing is saved for it, so the next
 * check tries again.
 */
export type PriceResult =
  | { found: true; pid: number; ask: Ask }
  | { found: false; pid: number | null; reason: string; transient?: true };

export interface PriceSources {
  /** The daily catalog, loaded only when the check needs it (it's large). */
  catalog: () => Promise<Catalog | undefined>;
  prices: PriceFile | null | undefined;
  /**
   * Live prices for a catalog printing from TCGdex, checked to be the same TCGplayer product. Null when
   * TCGdex doesn't have it; throws when TCGdex couldn't be reached.
   */
  live: (setName: string, number: string, pid: number) => Promise<TdPrices | null>;
}

const MARKET = "TCGplayer market";
const LOWEST = "TCGplayer lowest listing";

const market = (pid: number, amount: number, asOf: string): PriceResult => ({
  found: true,
  pid,
  ask: { kind: "market", amount, source: MARKET, asOf },
});

const retry = (pid: number | null, reason: string): PriceResult => ({
  found: false,
  pid,
  reason,
  transient: true,
});

export async function findPrice(
  card: Pick<Card, "name" | "set" | "number" | "variant" | "lang" | "tcg" | "listing" | "tcgProduct">,
  src: PriceSources,
): Promise<PriceResult> {
  let pid = pidOf(card);
  let cat: Catalog | undefined;
  if (pid == null) {
    cat = await src.catalog();
    if (!cat) return retry(null, "The card catalog didn't load. Try again.");
    const m = matchCatalog(cat, card);
    if ("reason" in m) return { found: false, pid: null, reason: m.reason };
    pid = m.pid;
  }

  const subs = src.prices?.items[String(pid)];
  const tracked = subs ? pickSub(subs, card.variant) : null;
  if (tracked?.market != null) return market(pid, tracked.market, src.prices?.asOf || today());

  cat ??= await src.catalog();
  if (!cat) return retry(pid, "The card catalog didn't load. Try again.");
  const row = cat.byPid.get(pid);
  const set = row ? setOf(cat, row) : null;
  let liveFailed = false;
  if (row && set && !set.jp) {
    try {
      const live = await src.live(set.name, row.number, pid);
      const p = live ? pickSub(live.subs, card.variant) : null;
      if (p?.market != null) return market(pid, p.market, live?.asOf || today());
    } catch {
      liveFailed = true;
    }
  }
  // The catalog keeps one price per product, the regular printing's, so it can't stand in for a
  // reverse holo or 1st edition.
  const regular = !/reverse|1st/i.test(card.variant);
  if (row && regular && realPrice(row.market)) return market(pid, realPrice(row.market), cat.asOf);
  if (tracked?.low != null)
    return {
      found: true,
      pid,
      ask: { kind: "ask", amount: tracked.low, source: LOWEST, asOf: src.prices?.asOf || today() },
    };
  if (liveFailed) return retry(pid, "Couldn't reach TCGdex for a live price. Try again.");
  return {
    found: false,
    pid,
    reason: row
      ? "TCGplayer shows no recent sales or listings for this printing."
      : "This TCGplayer product isn't in today's catalog.",
  };
}

/** A price the check filled in, as opposed to a marketplace ask or one typed in by hand. */
export const isAutoAsk = (ask: Ask | null): boolean =>
  ask?.kind === "market" || ask?.source === MARKET || ask?.source === LOWEST;

/** Whether a check leaves the card's saved price alone: a marketplace ask, or a price typed in by hand. */
export const keepsAsk = (ask: Ask | null): boolean =>
  isManual(ask) || (ask?.kind === "ask" && ask.amount != null && !isAutoAsk(ask));

/**
 * What a price check saves on the card, or null when a source didn't answer and nothing should change.
 * It also clears the old "Check price" queue flag. A kept price stays; the daily sync shows the market
 * price beside it from tomorrow.
 */
export function pricePatch(r: PriceResult, card: Pick<Card, "ask">, on: string = today()): CardPatch | null {
  if (r.found)
    return {
      tcgProduct: r.pid,
      ...(keepsAsk(card.ask) ? {} : { ask: r.ask }),
      noPrice: null,
      checkRequested: false,
    };
  if (r.transient) return null;
  return {
    ...(r.pid != null ? { tcgProduct: r.pid } : {}),
    // A price the check filled in earlier is out of date now; one from a seller or typed in stays.
    ...(isAutoAsk(card.ask) ? { ask: NO_ASK } : {}),
    noPrice: { reason: r.reason, at: on },
    checkRequested: false,
  };
}

const words = (s: string): string[] =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
const hasAll = (big: readonly string[], small: readonly string[]) =>
  small.length > 0 && small.every((w) => big.includes(w));

/**
 * Live prices from TCGdex for a catalog printing. TCGdex names sets its own way ("151" for "Scarlet &
 * Violet 151") and pads some numbers, so it tries the closest-named sets and only trusts a card whose
 * TCGplayer product is the one asked for.
 */
export function liveFromTcgdex(qc: QueryClient): PriceSources["live"] {
  return async (setName, number, pid) => {
    const { sets } = await qc.query({
      queryKey: queryKeys.tdSets,
      queryFn: fetchTdSets,
      staleTime: 6 * 3600_000,
    });
    const mine = words(setName);
    const score = (name: string) => {
      const theirs = words(name);
      if (theirs.join(" ") === mine.join(" ")) return 1000;
      if (!hasAll(mine, theirs) && !hasAll(theirs, mine)) return 0;
      return theirs.filter((w) => mine.includes(w)).length;
    };
    const candidates = sets
      .map((s) => ({ s, n: score(s.name) }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 3);
    const ids = new Set<string>();
    for (const { s } of candidates) {
      ids.add(`${s.id}-${number}`);
      if (/^\d+$/.test(number)) ids.add(`${s.id}-${number.padStart(3, "0")}`);
    }
    let failed: Error | null = null;
    for (const id of ids) {
      try {
        const p = await fetchTdPrices(id, pid);
        if (p?.pid === pid) return p;
      } catch (e) {
        failed = e instanceof Error ? e : new Error(String(e));
      }
    }
    if (failed) throw failed;
    return null;
  };
}

/** The fields that make a card the card it is; a check started on one copy is only saved if these hold. */
const sameCard = (a: Card, b: Card): boolean =>
  a.name === b.name &&
  a.set === b.set &&
  a.number === b.number &&
  a.variant === b.variant &&
  a.lang === b.lang &&
  (a.listing?.url ?? "") === (b.listing?.url ?? "");

/**
 * Saves a check's result against the card as it's stored now: skipped if the card was removed or changed
 * into another card while the check ran, and built from the latest copy, so a price typed in meanwhile
 * stays.
 */
export function useSavePrice() {
  const { update } = useCardWrites();
  return useCallback(
    (started: Card, r: PriceResult): Promise<UpdateResult> =>
      update(started, (now) => (sameCard(started, now) ? pricePatch(r, now) : null)),
    [update],
  );
}

/** Runs the price check on a card and saves what it found, or why it found nothing. */
export function usePriceCheck() {
  const qc = useQueryClient();
  const savePrice = useSavePrice();
  return useCallback(
    async (card: Card): Promise<{ result: PriceResult; saved: UpdateResult }> => {
      const prices = await qc.query(pricesQuery).catch(() => null);
      const result = await findPrice(card, {
        catalog: () => qc.query(catalogQuery).catch(() => undefined),
        prices,
        live: liveFromTcgdex(qc),
      });
      return { result, saved: await savePrice(card, result) };
    },
    [qc, savePrice],
  );
}

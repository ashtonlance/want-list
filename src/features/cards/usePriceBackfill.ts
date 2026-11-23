import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useDocsQuery } from "~/data/useDocs";
import { useAuth } from "~/features/auth/AuthProvider";
import { catalogQuery } from "~/features/catalog/catalog";
import { plural, today } from "~/lib/format";
import { useToast } from "~/ui/Toast";
import { useCards } from "./api";
import { findPrice, liveFromTcgdex, useSavePrice } from "./priceCheck";
import { usePrices } from "./prices";
import { isGot, priceOf } from "./pricing";
import type { Card } from "./types";

/** How long before a card the check couldn't price is tried again; the catalog grows every day. */
const RETRY_DAYS = 7;
/** At most this many cards per visit, so a long list is worked through over a few visits. */
const PER_VISIT = 40;

const daysSince = (date: string, now: string): number =>
  date ? (Date.parse(now) - Date.parse(date)) / 86_400_000 : Infinity;

/**
 * The cards the price check should look at: anything with no price at all, anything left in the old
 * "Check price" queue, and wanted cards it couldn't price a week or more ago.
 */
export function needsPriceCheck(c: Card, now: string = today()): boolean {
  if (c.checkRequested) return true;
  if (c.deal?.total != null || priceOf(c) != null) return false;
  if (!c.noPrice) return true;
  return !isGot(c) && daysSince(c.noPrice.at, now) >= RETRY_DAYS;
}

/**
 * Once per visit, for an editor: prices every card on the list that has no price yet, and clears the
 * old price queue. Each card is written with a fresh read of its stored copy, so nothing else on it
 * changes.
 */
export function usePriceBackfill(): void {
  const { canWrite } = useAuth();
  const { cards, loaded } = useCards();
  const cardDocs = useDocsQuery("cards");
  // Without today's prices, cards the daily sync prices would look unpriced.
  const prices = usePrices();
  const savePrice = useSavePrice();
  const qc = useQueryClient();
  const { toast } = useToast();
  const ran = useRef(false);

  const fresh = cardDocs.isFetchedAfterMount && !cardDocs.isFetching;
  useEffect(() => {
    if (!canWrite || !loaded || !fresh || !prices.isSuccess || ran.current) return;
    ran.current = true;
    // Wanted cards first: their price is the one that shows.
    const todo = cards
      .filter((c) => needsPriceCheck(c))
      .sort((a, b) => Number(isGot(a)) - Number(isGot(b)))
      .slice(0, PER_VISIT);
    if (!todo.length) return;
    void (async () => {
      const src = {
        catalog: () => qc.query(catalogQuery).catch(() => undefined),
        prices: prices.data,
        live: liveFromTcgdex(qc),
      };
      let found = 0;
      for (const c of todo) {
        const r = await findPrice(c, src);
        // A source that didn't answer won't for the next card either; the next visit tries again.
        if (!r.found && r.transient) break;
        const saved = await savePrice(c, r);
        // Refused or offline: the rest would fail the same way.
        if (saved === "denied" || saved === "failed") break;
        if (saved === "saved" && r.found) found++;
      }
      if (found) toast(`Found prices for ${plural(found, "card")}`);
    })().catch(() => undefined);
  }, [canWrite, loaded, fresh, prices.isSuccess, prices.data, cards, savePrice, qc, toast]);
}

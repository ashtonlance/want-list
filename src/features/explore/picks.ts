import { useMemo } from "react";
import { useDocsQuery } from "~/data/useDocs";
import { usePrices, type PriceFile } from "~/features/cards/prices";
import { pickSub } from "~/features/cards/pricing";
import type { Card } from "~/features/cards/types";
import { today } from "~/lib/format";
import { num, oneOf, str, strish, type JsonRecord } from "~/lib/json";
import { tcgImage } from "~/lib/images";
import type { LiveCard } from "./tcgdex";

export type PickStatus = "new" | "passed" | "added" | "owned";

/** A card Claude suggested for a collection, from the discover table. */
export interface PickCard {
  id: string;
  name: string;
  set: string;
  number: string;
  lang: "EN" | "JP";
  /** The collection it was picked for, or WILDCARDS. */
  coll: string;
  status: PickStatus;
  batch: number;
  rank: number;
  tcgdexId: string | null;
  tcgProduct: number | null;
  img: string | null;
  market: number | null;
  priceAsOf: string;
  /** True when the price came from TCGdex just now rather than the daily sync. */
  live: boolean;
  rarity: string;
  illustrator: string;
  reason: string;
}

export const WILDCARDS = "Wildcards";

export function parsePick(id: string, d: JsonRecord): PickCard {
  const product = num(d.tcgProduct) ?? (str(d.tcgProduct) ? Number(d.tcgProduct) : null);
  return {
    id,
    name: str(d.name) ?? "",
    set: str(d.set) ?? "",
    number: strish(d.number) ?? "",
    lang: d.lang === "JP" ? "JP" : "EN",
    coll: str(d.coll) ?? WILDCARDS,
    status: oneOf(d.status, ["new", "passed", "added", "owned"] as const) ?? "new",
    batch: num(d.batch) ?? 1,
    rank: num(d.rank) ?? 0,
    tcgdexId: str(d.tcgdexId) || null,
    tcgProduct: product != null && Number.isFinite(product) ? product : null,
    img: str(d.img) || null,
    market: num(d.market) ?? null,
    priceAsOf: str(d.priceAsOf) ?? "",
    live: false,
    rarity: str(d.rarity) ?? "",
    illustrator: str(d.illustrator) ?? "",
    reason: str(d.reason) ?? "",
  };
}

function withSyncedPrice(p: PickCard, prices: PriceFile | null | undefined): PickCard {
  const subs = prices && p.tcgProduct ? prices.items[String(p.tcgProduct)] : undefined;
  const sp = subs ? pickSub(subs, "") : null;
  return sp?.market != null && prices ? { ...p, market: sp.market, priceAsOf: prices.asOf, live: false } : p;
}

/** Fills a pick from live TCGdex data, keeping whichever price is fresher: the synced one or the live one. */
export function withLive(p: PickCard, d: LiveCard | undefined): PickCard {
  if (!d) return p;
  const out = { ...p };
  const upd = d.upd || today();
  if (d.market != null && (p.market == null || !p.priceAsOf || upd >= p.priceAsOf)) {
    out.market = d.market;
    out.priceAsOf = upd;
    out.live = true;
  }
  if (!out.rarity && d.rarity) out.rarity = d.rarity;
  if (!out.illustrator && d.illustrator) out.illustrator = d.illustrator;
  return out;
}

/** Every pick, with today's synced prices applied. */
export function usePicks() {
  const docs = useDocsQuery("discover");
  const prices = usePrices();
  const picks = useMemo(
    () => (docs.data ?? []).map((d) => withSyncedPrice(parsePick(d.id, d.data), prices.data)),
    [docs.data, prices.data],
  );
  return { picks, loaded: docs.data !== undefined };
}

const stripZeros = (s: string) => s.replace(/^0+/, "");

/** Whether the list already has this card, matched by name, number and set. */
export function pickOnList(cards: readonly Card[], p: PickCard): boolean {
  const name = p.name.toLowerCase();
  const set = p.set.toLowerCase();
  const no = stripZeros(p.number);
  return cards.some(
    (c) => c.name.toLowerCase() === name && stripZeros(c.number) === no && c.set.toLowerCase() === set,
  );
}

export const isPickAdded = (cards: readonly Card[], p: PickCard): boolean =>
  p.status === "added" || p.status === "owned" || pickOnList(cards, p);

export const pickImage = (p: PickCard, live: LiveCard | undefined): string | null =>
  p.tcgProduct ? tcgImage(p.tcgProduct) : (live?.img ?? null);

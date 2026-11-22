import { isRecord, num, str } from "~/lib/json";
import { createLimiter } from "~/lib/limit";
import { numberSortKey } from "~/lib/format";
import { tcgImage } from "~/lib/images";

/** Live card data from TCGdex: pictures, artists and today's TCGplayer prices. */
const TD = "https://api.tcgdex.net/v2/en";

/** A card shown in Explore, from TCGdex or from the daily catalog (ids that start with "cat:"). */
export interface LiveCard {
  id: string;
  name: string;
  set: string;
  setId: string;
  number: string;
  rarity: string;
  illustrator: string;
  img: string | null;
  pid: number | null;
  market: number | null;
  low: number | null;
  /** Date the price was updated (YYYY-MM-DD). */
  upd: string;
  jp: boolean;
}

export interface TdSet {
  id: string;
  name: string;
  /** Cards in the set, secret rares included. */
  count: number;
}

/** A card as TCGdex lists it in search results and sets, before its details load. */
export interface TdBrief {
  id: string;
  localId: string;
  name: string;
  image: string | null;
}

const limit = createLimiter(8);

async function tdJson(path: string): Promise<unknown> {
  const r = await limit(() => fetch(TD + path));
  if (!r.ok) throw new Error(`TCGdex ${path}: HTTP ${r.status}`);
  return r.json();
}

export const tdSetOf = (id: string): string => id.slice(0, id.lastIndexOf("-"));

/** TCGdex also lists Pokémon TCG Pocket, the phone game; those cards can't be bought, so they're left out. */
export const isPocket = (setId: string, img: string | null | undefined): boolean =>
  /^(P-[A-Z]|[A-Z]\d+[a-z]?)$/.test(setId) || (img ?? "").includes("/tcgp/");

const SUB_ORDER = [
  "holofoil",
  "normal",
  "unlimitedHolofoil",
  "unlimited",
  "1stEditionHolofoil",
  "1stEdition",
  "reverse-holofoil",
  "reverseHolofoil",
];

/** Reads one card's details: picture, rarity, artist, TCGplayer price and product. */
export function normalizeTdCard(j: unknown): LiveCard {
  const d = isRecord(j) ? j : {};
  const pricing = isRecord(d.pricing) && isRecord(d.pricing.tcgplayer) ? d.pricing.tcgplayer : {};
  const subs = Object.keys(pricing).filter((k) => isRecord(pricing[k]));
  const priceOf = (k: string) => {
    const v = pricing[k];
    return isRecord(v) ? (num(v.marketPrice) ?? num(v.midPrice) ?? null) : null;
  };
  const sub =
    SUB_ORDER.find((k) => subs.includes(k) && priceOf(k) != null) ??
    subs.find((k) => priceOf(k) != null) ??
    subs[0];
  const v = sub ? pricing[sub] : undefined;
  const variant = isRecord(v) ? v : null;
  const detailed = Array.isArray(d.variants_detailed) ? d.variants_detailed : [];
  const thirdParty = detailed
    .map((x) => (isRecord(x) && isRecord(x.thirdParty) ? num(x.thirdParty.tcgplayer) : undefined))
    .find((x) => x !== undefined);
  const pid = (variant ? num(variant.productId) : undefined) ?? thirdParty ?? null;
  const id = str(d.id) ?? "";
  const set = isRecord(d.set) ? d.set : null;
  const image = str(d.image);
  return {
    id,
    name: str(d.name) ?? "",
    set: (set && str(set.name)) ?? "",
    setId: (set && str(set.id)) ?? tdSetOf(id),
    number: str(d.localId) ?? "",
    rarity: str(d.rarity) ?? "",
    illustrator: str(d.illustrator) ?? "",
    img: image ? image + "/low.webp" : pid ? tcgImage(pid) : null,
    pid,
    market: priceOf(sub ?? ""),
    low: variant ? (num(variant.lowPrice) ?? null) : null,
    upd: (str(pricing.updated) ?? "").slice(0, 10),
    jp: false,
  };
}

export async function fetchTdCard(id: string): Promise<LiveCard> {
  return normalizeTdCard(await tdJson("/cards/" + encodeURIComponent(id)));
}

export interface TdSets {
  /** Sets with cards, newest first. */
  sets: TdSet[];
  /** Release order of every set id, newest first, for sorting search results. */
  rank: Map<string, number>;
}

export async function fetchTdSets(): Promise<TdSets> {
  const raw = await tdJson("/sets?sort:field=releaseDate&sort:order=DESC");
  const all = Array.isArray(raw) ? raw.filter(isRecord) : [];
  const rank = new Map(all.map((s, i) => [str(s.id) ?? "", i]));
  const sets = all
    .map((s) => ({
      id: str(s.id) ?? "",
      name: str(s.name) ?? "",
      count: isRecord(s.cardCount) ? (num(s.cardCount.total) ?? 0) : 0,
      logo: str(s.logo),
    }))
    .filter((s) => s.count > 0 && !isPocket(s.id, s.logo))
    .map(({ id, name, count }) => ({ id, name, count }));
  return { sets, rank };
}

function parseBriefs(v: unknown): TdBrief[] {
  return (Array.isArray(v) ? v : []).filter(isRecord).map((c) => ({
    id: str(c.id) ?? "",
    localId: str(c.localId) ?? "",
    name: str(c.name) ?? "",
    image: str(c.image) ?? null,
  }));
}

/** Every printing of a card name, newest sets first. */
export async function searchTd(q: string, sets: TdSets): Promise<TdBrief[]> {
  const rank = (b: TdBrief) => sets.rank.get(tdSetOf(b.id)) ?? 9999;
  return parseBriefs(await tdJson("/cards?name=" + encodeURIComponent(q)))
    .filter((c) => !isPocket(tdSetOf(c.id), c.image))
    .sort((a, b) => rank(a) - rank(b) || numberSortKey(b.localId) - numberSortKey(a.localId));
}

/** A set's cards, chase cards (highest numbers) first. */
export async function fetchTdSetCards(setId: string): Promise<TdBrief[]> {
  const st = await tdJson("/sets/" + encodeURIComponent(setId));
  return parseBriefs(isRecord(st) ? st.cards : []).sort(
    (a, b) => numberSortKey(b.localId) - numberSortKey(a.localId),
  );
}

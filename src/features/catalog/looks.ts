import type { Catalog, CatalogCard } from "./catalog";
import { fullArtCards } from "./rarity";

/** A quick "Every card" filter by how a card looks, or "any" for all of them. */
export type Look =
  "any" | "fullart" | "special" | "illustration" | "gold" | "shiny" | "ex" | "holo" | "promo";

export const LOOK_OPTIONS: readonly { value: Look; label: string }[] = [
  { value: "any", label: "All cards" },
  { value: "fullart", label: "Full art" },
  { value: "special", label: "Special & alt art" },
  { value: "illustration", label: "Illustration rares" },
  { value: "gold", label: "Gold & secret" },
  { value: "shiny", label: "Shiny" },
  { value: "ex", label: "ex, V & GX" },
  { value: "holo", label: "Holos" },
  { value: "promo", label: "Promos" },
];

const SPECIAL = /special (illustration|art) rare/i;
/** TCGplayer names Sword & Shield alt arts in the card name: "Umbreon VMAX (Alternate Art Secret)". */
const ALT_NAME = /alternate (full )?art|alt art|\(alt\b/i;
const ILLUSTRATION = /^(illustration rare|art rare|character (super )?rare)$/i;
const GALLERY_NUMBER = /^(TG|GG)\d/i;
/** Hyper rares are the gold cards; secret and rainbow rares sit past the set's printed count. */
const GOLD = /secret|hyper|rainbow/i;
const SECRET_NAME = /\([^)]*secret/i;
const SHINY = /shiny|radiant|shining|amazing|kagayaku/i;
const RULE_BOX = /\b(ex|EX|GX|V|VMAX|VSTAR|V-UNION|LV\.X|BREAK|Prime|LEGEND)\b/;
const HOLO = /holo/i;

type Test = (c: CatalogCard, rarity: string, cat: Catalog) => boolean;

const TESTS: Record<Exclude<Look, "any" | "fullart">, Test> = {
  special: (c, r) => SPECIAL.test(r) || ALT_NAME.test(c.name),
  illustration: (c, r) => ILLUSTRATION.test(r) || GALLERY_NUMBER.test(c.number),
  gold: (c, r) => GOLD.test(r) || SECRET_NAME.test(c.name),
  shiny: (_c, r) => SHINY.test(r),
  ex: (c) => RULE_BOX.test(c.name),
  holo: (_c, r) => HOLO.test(r),
  promo: (c, r, cat) => r === "Promo" || /promo/i.test(cat.sets[c.set]?.name ?? ""),
};

const cache = new WeakMap<Catalog, Map<Look, ReadonlySet<CatalogCard>>>();

/** The catalog's cards with a look, worked out once per catalog; null for "any". */
export function lookCards(cat: Catalog, look: Look): ReadonlySet<CatalogCard> | null {
  if (look === "any") return null;
  if (look === "fullart") return fullArtCards(cat);
  let byLook = cache.get(cat);
  if (!byLook) cache.set(cat, (byLook = new Map<Look, ReadonlySet<CatalogCard>>()));
  const hit = byLook.get(look);
  if (hit) return hit;
  const test = TESTS[look];
  const out = new Set<CatalogCard>();
  for (const c of cat.cards) if (test(c, cat.rarities[c.rarity] ?? "", cat)) out.add(c);
  byLook.set(look, out);
  return out;
}

/** The chase-ness of a rarity: gold, secret and special art first, then other full art, then hits, rares, the rest. */
const TOP = /hyper|special (illustration|art)|secret|rainbow|mega ultra|black white|mega attack/i;
const HIT =
  /ultra|double|triple|ace|radiant|amazing|shining|kagayaku|prism|break|legend|lv\.x|shiny|holo|super rare|futuristic|pikachu|classic/i;

const tierCache = new WeakMap<Catalog, Map<CatalogCard, number>>();

/** 4 for the top chase cards down to 0 for commons, worked out once per catalog. */
export function rarityTiers(cat: Catalog): ReadonlyMap<CatalogCard, number> {
  const hit = tierCache.get(cat);
  if (hit) return hit;
  const art = fullArtCards(cat);
  const out = new Map<CatalogCard, number>();
  for (const c of cat.cards) {
    const r = cat.rarities[c.rarity] ?? "";
    out.set(c, TOP.test(r) ? 4 : art.has(c) ? 3 : HIT.test(r) ? 2 : /rare/i.test(r) ? 1 : 0);
  }
  tierCache.set(cat, out);
  return out;
}

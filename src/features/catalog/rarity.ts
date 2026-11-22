import type { Catalog, CatalogCard } from "./catalog";

/**
 * Rarities printed as full or alternate art: the art fills the card. Matches TCGplayer's names
 * ("Special Illustration Rare", Japanese "Super Rare") and TCGdex's ("Illustration rare", "Full Art Trainer").
 */
const FULL_ART =
  /illustration|art rare|full art|character (super )?rare|shiny ultra rare|secret|hyper|rainbow|trainer gallery|galarian gallery|^super rare$/i;

/** "Ultra Rare" covers both regular and full art V, GX and ex cards, so it needs a second look. */
const ULTRA = /^ultra rare$/i;

/** TCGplayer names a full art printing in the card name: "Espeon GX (Full Art)". */
const ART_NAME = /full art|alternate art|\(alt/i;

/** Trainer Gallery and Galarian Gallery numbers ("TG06", "GG35") are full art whatever the rarity says. */
const GALLERY_NUMBER = /^(TG|GG)\d/i;

export interface ArtHints {
  /** The card's name, which sometimes says "(Full Art)". */
  name?: string;
  /** The highest number among the set's regular cards; an Ultra Rare numbered past it is full art. */
  mainSize?: number;
}

/** A card number's leading digits: "141" is 141, "TG06" and "" are 0. */
export const leadingNumber = (number: string): number => Number(/^\d+/.exec(number)?.[0] ?? 0);

export function isFullArt(rarity: string, number = "", { name = "", mainSize = 0 }: ArtHints = {}): boolean {
  if (FULL_ART.test(rarity) || GALLERY_NUMBER.test(number)) return true;
  if (!ULTRA.test(rarity)) return false;
  return ART_NAME.test(name) || (mainSize > 0 && leadingNumber(number) > mainSize);
}

/** Commons and uncommons are always inside a set's printed count, so they show where it ends. */
export const REGULAR = /^(common|uncommon)$/i;

const flagsCache = new WeakMap<Catalog, ReadonlySet<CatalogCard>>();

/** The catalog's full art cards, worked out once per catalog. */
export function fullArtCards(cat: Catalog): ReadonlySet<CatalogCard> {
  const hit = flagsCache.get(cat);
  if (hit) return hit;
  const mainSize = new Array<number>(cat.sets.length).fill(0);
  for (const c of cat.cards)
    if (REGULAR.test(cat.rarities[c.rarity] ?? ""))
      mainSize[c.set] = Math.max(mainSize[c.set] ?? 0, leadingNumber(c.number));
  const out = new Set<CatalogCard>();
  for (const c of cat.cards)
    if (isFullArt(cat.rarities[c.rarity] ?? "", c.number, { name: c.name, mainSize: mainSize[c.set] ?? 0 }))
      out.add(c);
  flagsCache.set(cat, out);
  return out;
}

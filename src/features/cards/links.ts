import { slugify } from "~/lib/format";
import type { Card } from "./types";

export interface ShopLink {
  label: string;
  href: string;
  title?: string;
}

export const tcgProductUrl = (pid: number | string): string => `https://www.tcgplayer.com/product/${pid}`;

export const tcgSearchUrl = (q: string, jp = false): string =>
  `https://www.tcgplayer.com/search/${jp ? "pokemon-japan" : "pokemon"}/product?q=${encodeURIComponent(q)}`;

export const ebayBuyNowUrl = (q: string): string =>
  `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}&LH_BIN=1&_sop=15`;

export const dhSetUrl = (set: string, jp = false): string =>
  `https://doubleholo.com/marketplace?sets=${encodeURIComponent("Pokemon " + (jp ? "Japanese " : "") + set)}`;

type LinkCard = Pick<Card, "name" | "number" | "variant" | "set" | "lang" | "dhUrl" | "tcg">;

function queryText(c: LinkCard): string {
  return [
    c.lang === "JP" ? "Japanese" : "",
    c.name,
    /reverse|1st/i.test(c.variant) ? c.variant : "",
    c.set,
    c.number,
  ]
    .filter(Boolean)
    .join(" ");
}

function dhLink(c: LinkCard): ShopLink {
  if (c.dhUrl) return { label: "DoubleHolo", href: c.dhUrl, title: "Open this card on DoubleHolo" };
  if (c.set)
    return {
      label: "DoubleHolo",
      href: dhSetUrl(c.set, c.lang === "JP"),
      title: "Open this card's set on DoubleHolo",
    };
  return {
    label: "DoubleHolo",
    href: `https://doubleholo.com/pokemon/${slugify(c.name.split(" ")[0])}`,
    title: "Open this Pokémon on DoubleHolo",
  };
}

/** Where to shop for a card on the list, most useful first. */
export function marketLinks(c: LinkCard): ShopLink[] {
  const q = encodeURIComponent(queryText(c));
  const short = [c.name, c.number].filter(Boolean).join(" ");
  return [
    dhLink(c),
    {
      label: "TCGplayer",
      href: c.tcg?.productId ? tcgProductUrl(c.tcg.productId) : tcgSearchUrl(short, c.lang === "JP"),
    },
    {
      label: "eBay",
      href: `https://www.ebay.com/sch/i.html?_nkw=${q}+pokemon&LH_BIN=1&_sop=15`,
      title: "Buy It Now, sorted by price plus shipping",
    },
    {
      label: "Cardmarket",
      href: `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(short)}`,
    },
    { label: "Mercari", href: `https://www.mercari.com/search/?keyword=${q}+pokemon` },
    { label: "PriceCharting", href: `https://www.pricecharting.com/search-products?type=prices&q=${q}` },
    {
      label: "eBay sold",
      href: `https://www.ebay.com/sch/i.html?_nkw=${q}+pokemon&LH_Sold=1&LH_Complete=1`,
      title: "What it actually sold for",
    },
  ];
}

/** Shop links for a card that isn't on the list yet (a pick or a live card). */
export function quickShopLinks(c: {
  name: string;
  set: string;
  number: string;
  pid: number | null;
}): ShopLink[] {
  return [
    { label: "TCGplayer", href: c.pid ? tcgProductUrl(c.pid) : tcgSearchUrl(`${c.name} ${c.number}`) },
    { label: "eBay", href: ebayBuyNowUrl(`${c.name} ${c.set} ${c.number} pokemon`) },
    { label: "DoubleHolo", href: dhSetUrl(c.set) },
  ];
}

import { slugify, today } from "~/lib/format";
import type { Lang, Listing } from "./types";

export interface ParsedCard {
  name: string;
  set: string;
  number: string;
  variant: string;
  lang: Lang;
}

export interface ParsedLink extends ParsedCard {
  listing: Listing | null;
  dhUrl: string | null;
  site: string;
  /** False when the link didn't carry a card name, so the person has to type it. */
  found: boolean;
}

const KEEP: Record<string, string> = {
  ex: "ex",
  gx: "GX",
  v: "V",
  vmax: "VMAX",
  vstar: "VSTAR",
  tag: "Tag",
  team: "Team",
  and: "&",
  of: "of",
};

/** Title-cases text typed in lower case, keeping card suffixes like ex and VMAX right. */
export function titleCase(s: string): string {
  if (/[A-Z]/.test(s)) return s;
  return s
    .split(" ")
    .filter(Boolean)
    .map((w) => KEEP[w] ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Reads text like "Umbreon ex Prismatic Evolutions 161 reverse jp" into card fields.
 * `knownSets` are matched longest first so "Evolutions" doesn't beat "Prismatic Evolutions".
 */
export function parseQuick(text: string, knownSets: readonly string[]): ParsedCard {
  let t = " " + text.trim().replace(/\s+/g, " ") + " ";
  const out: ParsedCard = { name: "", set: "", number: "", variant: "", lang: "EN" };
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = t.match(re);
    if (m) {
      fn(m);
      t = t.replace(m[0], " ");
    }
  };
  take(/\s(japanese|jp|jpn)\s/i, () => (out.lang = "JP"));
  take(/\s(reverse holo|reverse|rh)\s/i, () => (out.variant = "Reverse Holo"));
  take(/\s(1st edition|1st ed|first edition)\s/i, () => (out.variant = "1st Edition"));
  take(/\s#?([A-Z]{0,5}\d{1,4}[a-z]?)(\/\S+)?\s*$/i, (m) => (out.number = (m[1] ?? "").toUpperCase()));
  const tslug = "-" + slugify(t) + "-";
  const sets = [...knownSets].sort((a, b) => b.length - a.length);
  for (const s of sets) {
    const ss = "-" + slugify(s) + "-";
    const i = tslug.indexOf(ss);
    if (i >= 0) {
      out.set = s;
      t = " " + (tslug.slice(0, i) + "-" + tslug.slice(i + ss.length)).replace(/-+/g, " ").trim() + " ";
      break;
    }
  }
  if (!out.number) take(/\s#?([A-Z]{0,5}\d{1,4}[a-z]?)\s/i, (m) => (out.number = (m[1] ?? "").toUpperCase()));
  out.name = titleCase(t.trim());
  return out;
}

const SITES: [RegExp, string][] = [
  [/tcgplayer/, "TCGplayer"],
  [/(^|\.)ebay\./, "eBay"],
  [/cardmarket/, "Cardmarket"],
  [/pricecharting/, "PriceCharting"],
  [/mercari/, "Mercari"],
  [/doubleholo/, "DoubleHolo"],
  [/whatnot/, "Whatnot"],
  [/facebook/, "Facebook"],
  [/trollandtoad/, "Troll and Toad"],
  [/collectr/, "Collectr"],
];

export const siteOf = (host: string): string =>
  SITES.find(([re]) => re.test(host))?.[1] ?? host.replace(/^www\./, "");

const NOISE = /\b(pokemon|pokémon|tcg|card|cards|sir|sar|ir|ar|nm|lp|mint|near|english|ungraded|single)\b/gi;
const safeDecode = (s: string): string => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** Reads card details out of a listing link from TCGplayer, eBay, Cardmarket and other marketplaces. */
export function parseLink(raw: string, knownSets: readonly string[]): ParsedLink | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const site = siteOf(u.hostname);
  const segs = u.pathname.split("/").filter(Boolean).map(safeDecode);
  let words = "";
  let setHint = "";
  let lang: Lang = "EN";
  let dhUrl: string | null = null;
  if (site === "TCGplayer" && segs[0] === "product") {
    let s = segs[2] ?? "";
    if (s.startsWith("pokemon-japan-")) {
      lang = "JP";
      s = s.slice(14);
    } else s = s.replace(/^pokemon-/, "");
    s = s.replace(/^(sv|swsh|sm|xy|bw|me|m|s)(\d+[a-z]?)?(-\d+)?-(?=[a-z])/i, "");
    s = s.replace(/-(\d{1,4})-(\d{1,4})$/, " $1");
    words = s;
  } else if (site === "Cardmarket") {
    const i = segs.indexOf("Singles");
    if (i >= 0) {
      setHint = segs[i + 1] ?? "";
      words = (segs[i + 2] ?? "").replace(/-V\d+(?=-)/, "").replace(/-([A-Z]{2,5})(\d{1,4})$/, " $2");
    }
  } else if (site === "PriceCharting" && segs[0] === "game") {
    let s = (segs[1] ?? "").replace(/^pokemon-/, "");
    if (s.startsWith("japanese-")) {
      lang = "JP";
      s = s.slice(9);
    }
    setHint = s;
    words = segs[2] ?? "";
  } else {
    if (site === "DoubleHolo" && segs[0] === "card") dhUrl = u.origin + u.pathname;
    words =
      segs
        .filter(
          (s) =>
            /[a-z]{3,}/i.test(s) &&
            s.includes("-") &&
            !/^(itm|item|product|products|p|us|en|listing)$/i.test(s),
        )
        .sort((a, b) => b.length - a.length)[0] ?? "";
    if (/^japanese-/i.test(words)) {
      lang = "JP";
      words = words.slice(9);
    }
  }
  const text = [setHint, words]
    .join(" ")
    .replace(/[-_]+/g, " ")
    .replace(NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();
  const p: ParsedCard = text
    ? parseQuick(text, knownSets)
    : { name: "", set: "", number: "", variant: "", lang: "EN" };
  if (!p.set && setHint) {
    p.set = titleCase(setHint.replace(/[-_]+/g, " ").toLowerCase());
    p.name = titleCase(
      words
        .replace(/[-_]+/g, " ")
        .replace(/\s\d+$/, "")
        .trim()
        .toLowerCase(),
    );
  }
  if (lang === "JP") p.lang = "JP";
  return {
    ...p,
    listing: dhUrl ? null : { url: u.href, site, addedAt: today() },
    dhUrl,
    site,
    found: !!p.name,
  };
}

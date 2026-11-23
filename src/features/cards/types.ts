export type CardStatus = "want" | "got";
export type Lang = "EN" | "JP";
export type AskKind = "ask" | "market" | "price" | "none";

/** A price seen on a marketplace, before shipping. */
export interface Ask {
  kind: AskKind;
  amount: number | null;
  source: string;
  asOf: string;
}

/** The cheapest seller found with shipping included. */
export interface Deal {
  site: string;
  seller: string;
  condition: string;
  url: string;
  price: number | null;
  shipping: number | null;
  total: number | null;
  checkedAt: string;
}

export interface Listing {
  url: string;
  site: string;
  addedAt: string;
}

/** Today's TCGplayer price for the printing that matches the card's variant. */
export interface TcgPrice {
  sub: string;
  market: number | null;
  low: number | null;
  productId: number | null;
  asOf: string;
}

/** How worn a raw (ungraded) card is, best first. */
export type RawCondition = "NM" | "LP" | "MP" | "HP" | "DMG";
export const RAW_CONDITIONS: readonly RawCondition[] = ["NM", "LP", "MP", "HP", "DMG"];

/** Details of the copies you own. Prices are for one copy. */
export interface Owned {
  /** How many copies, 1 or more. */
  qty: number;
  /** A raw card's condition; null when not given. Ignored for a graded card. */
  condition: RawCondition | null;
  /** The grading company (PSA, BGS, CGC…), or "" for a raw card. */
  grader: string;
  /** The grade as printed on the slab, like "10" or "9.5". */
  grade: string;
  /** What one copy cost. */
  paid: number | null;
  /** Your own value for one copy, for graded cards the market price doesn't cover. */
  value: number | null;
}

/** A card on the want list. `slots` holds the card's position in each collection, by collection name. */
export interface Card {
  id: string;
  name: string;
  number: string;
  variant: string;
  set: string;
  lang: Lang;
  note: string;
  addedAt: string;
  ask: Ask | null;
  deal: Deal | null;
  listing: Listing | null;
  dhUrl: string | null;
  img: string | null;
  imgSource: string;
  priority: boolean;
  status: CardStatus;
  checkRequested: boolean;
  order: number | null;
  collections: string[];
  slots: Record<string, number>;
  tcg: TcgPrice | null;
  /** Quantity, grade and price paid for a card you've got; null until any are given. */
  owned: Owned | null;
}

/** What gets stored for a card: everything but its id and the price the app works out at load. */
export type CardData = Omit<Card, "id" | "tcg">;
export type CardPatch = Partial<CardData>;

export const NO_ASK: Ask = { kind: "none", amount: null, source: "", asOf: "" };

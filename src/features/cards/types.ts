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
}

/** What gets stored for a card: everything but its id and the price the app works out at load. */
export type CardData = Omit<Card, "id" | "tcg">;
export type CardPatch = Partial<CardData>;

export const NO_ASK: Ask = { kind: "none", amount: null, source: "", asOf: "" };

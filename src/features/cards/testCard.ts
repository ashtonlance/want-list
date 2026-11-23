import { NO_ASK, type Card } from "./types";

/** A card with every field set to its empty value, for tests. */
export function testCard(over: Partial<Card> = {}): Card {
  return {
    id: "c1",
    name: "Gengar",
    number: "94",
    variant: "",
    set: "Fossil",
    lang: "EN",
    note: "",
    addedAt: "2026-01-01",
    ask: NO_ASK,
    deal: null,
    listing: null,
    dhUrl: null,
    img: null,
    imgSource: "",
    priority: false,
    status: "want",
    checkRequested: false,
    order: null,
    collections: [],
    slots: {},
    tcg: null,
    owned: null,
    ...over,
  };
}

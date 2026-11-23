import {
  bool,
  isRecord,
  num,
  numOrNull,
  numRecord,
  oneOf,
  str,
  strArray,
  strish,
  type JsonRecord,
} from "~/lib/json";
import {
  RAW_CONDITIONS,
  type Ask,
  type Card,
  type Deal,
  type Listing,
  type NoPrice,
  type Owned,
  type TcgPrice,
} from "./types";

function parseAsk(v: unknown): Ask | null {
  if (!isRecord(v)) return null;
  return {
    kind: oneOf(v.kind, ["ask", "market", "price", "none"] as const) ?? "none",
    amount: num(v.amount) ?? null,
    source: str(v.source) ?? "",
    asOf: str(v.asOf) ?? "",
  };
}

function parseDeal(v: unknown): Deal | null {
  if (!isRecord(v)) return null;
  return {
    site: str(v.site) ?? "",
    seller: str(v.seller) ?? "",
    condition: str(v.condition) ?? "",
    url: str(v.url) ?? "",
    price: num(v.price) ?? null,
    shipping: num(v.shipping) ?? null,
    total: num(v.total) ?? null,
    checkedAt: str(v.checkedAt) ?? "",
  };
}

function parseListing(v: unknown): Listing | null {
  if (!isRecord(v)) return null;
  const url = str(v.url);
  return url ? { url, site: str(v.site) ?? "", addedAt: str(v.addedAt) ?? "" } : null;
}

function parseNoPrice(v: unknown): NoPrice | null {
  if (!isRecord(v)) return null;
  const reason = str(v.reason);
  return reason ? { reason, at: str(v.at) ?? "" } : null;
}

export function parseTcg(v: unknown): TcgPrice | null {
  if (!isRecord(v)) return null;
  const pid = num(v.productId) ?? (str(v.productId) ? Number(v.productId) : null);
  return {
    sub: str(v.sub) ?? "",
    market: numOrNull(v.market) ?? null,
    low: numOrNull(v.low) ?? null,
    productId: pid != null && Number.isFinite(pid) ? pid : null,
    asOf: str(v.asOf) ?? "",
  };
}

const money = (v: unknown): number | null => {
  const n = num(v);
  return n != null && n >= 0 ? n : null;
};

/** The copies you own. Bad values fall back to one raw copy with nothing paid. */
export function parseOwned(v: unknown): Owned | null {
  if (!isRecord(v)) return null;
  const qty = num(v.qty);
  return {
    qty: qty != null && qty >= 1 ? Math.floor(qty) : 1,
    condition: oneOf(v.condition, RAW_CONDITIONS) ?? null,
    grader: (str(v.grader) ?? "").trim(),
    grade: (strish(v.grade) ?? "").trim(),
    paid: money(v.paid),
    value: money(v.value),
  };
}

/** Reads one stored card. Missing or malformed fields fall back to empty values rather than failing. */
export function parseCard(id: string, d: JsonRecord): Card {
  return {
    id,
    name: str(d.name) ?? "",
    number: strish(d.number) ?? "",
    variant: str(d.variant) ?? "",
    set: str(d.set) ?? "",
    lang: d.lang === "JP" ? "JP" : "EN",
    note: str(d.note) ?? "",
    addedAt: str(d.addedAt) ?? "",
    ask: parseAsk(d.ask),
    deal: parseDeal(d.deal),
    listing: parseListing(d.listing),
    dhUrl: str(d.dhUrl) || null,
    img: str(d.img) || null,
    imgSource: str(d.imgSource) ?? "",
    priority: bool(d.priority) ?? false,
    status: d.status === "got" ? "got" : "want",
    checkRequested: bool(d.checkRequested) ?? false,
    tcgProduct: num(d.tcgProduct) ?? null,
    noPrice: parseNoPrice(d.noPrice),
    order: num(d.order) ?? null,
    collections: strArray(d.collections),
    slots: numRecord(d.slots),
    tcg: parseTcg(d.tcg),
    owned: parseOwned(d.owned),
  };
}

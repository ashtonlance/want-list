import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { mergeDoc } from "~/data/docs";
import { docKeys } from "~/data/keys";
import { catalogQuery, type Catalog } from "~/features/catalog/catalog";
import { catalogIdentity } from "~/features/explore/live";
import type { PickCard } from "~/features/explore/picks";
import type { LiveCard } from "~/features/explore/tcgdex";
import { today } from "~/lib/format";
import { bigImage } from "~/lib/images";
import { useToast } from "~/ui/Toast";
import { cardDocId, useCardWrites, useCards } from "./api";
import { addToCollection, collectionCards } from "./collections";
import { tcgProductUrl } from "./links";
import { isGot, pidOf } from "./pricing";
import { NO_ASK, type Card, type CardData, type CardPatch } from "./types";

type NewCardFields = Pick<CardData, "name"> & Partial<CardData>;

/** A new card with every field filled: anything not given gets its empty value. */
export function newCard(f: NewCardFields): CardData {
  return {
    number: "",
    variant: "",
    set: "",
    lang: "EN",
    note: "",
    addedAt: today(),
    ask: NO_ASK,
    deal: null,
    listing: null,
    dhUrl: null,
    img: null,
    imgSource: "",
    priority: false,
    status: "want",
    checkRequested: true,
    order: -Date.now(),
    collections: [],
    slots: {},
    ...f,
  };
}

export const marketAsk = (amount: number | null, asOf: string) =>
  amount != null ? { kind: "market" as const, amount, source: "TCGplayer market", asOf } : NO_ASK;

const tcgListing = (pid: number) => ({ url: tcgProductUrl(pid), site: "TCGplayer", addedAt: today() });

/** The live card if it's on the list: same TCGplayer product, or same name, number and set. */
export function findOnList(cards: readonly Card[], d: Pick<LiveCard, "pid" | "name" | "number" | "set">): Card | null {
  const nn = (s: string) => s.replace(/^0+/, "").toLowerCase();
  return (
    cards.find(
      (c) =>
        (d.pid != null && pidOf(c) === d.pid) ||
        (c.name.toLowerCase() === d.name.toLowerCase() && nn(c.number) === nn(d.number) && c.set.toLowerCase() === d.set.toLowerCase()),
    ) ?? null
  );
}

export type WantOrGot = "want" | "got";

const addedMessage = (name: string, got: boolean, coll: string) =>
  coll
    ? got
      ? `Marked ${name} as owned in ${coll}`
      : `Added ${name} to ${coll}`
    : got
      ? `Marked ${name} as owned`
      : `Added ${name} to your list`;

/** Adds cards from Explore and Binders. A card already on the list is updated instead of added twice. */
export function useAddCards() {
  const qc = useQueryClient();
  const { cards } = useCards();
  const { save, create } = useCardWrites();
  const { toast } = useToast();

  const slotIn = useCallback((coll: string) => collectionCards(cards, coll).length, [cards]);

  /** Puts an existing card in a collection and marks it owned if asked. */
  const updateExisting = useCallback(
    async (c: Card, got: boolean, coll: string) => {
      let patch: CardPatch = {};
      if (coll && !c.collections.includes(coll)) patch = addToCollection(c, coll, slotIn(coll));
      if (got && !isGot(c)) patch = { ...patch, status: "got", checkRequested: false };
      return Object.keys(patch).length ? save(c, patch, undefined, true) : true;
    },
    [save, slotIn],
  );

  const inColl = useCallback(
    (coll: string) => (coll ? { collections: [coll], slots: { [coll]: slotIn(coll) } } : {}),
    [slotIn],
  );

  const fromPick = useCallback(
    async (p: PickCard, want: WantOrGot, coll: string): Promise<boolean> => {
      const got = want === "got";
      const id = cardDocId([p.name, p.set, p.number].join(" "));
      const existing = cards.find((c) => c.id === id);
      const ok = existing
        ? await updateExisting(existing, got, coll)
        : await create(
            id,
            newCard({
              name: p.name,
              number: p.number,
              set: p.set,
              lang: p.lang,
              ask: marketAsk(p.market, p.priceAsOf),
              listing: p.tcgProduct ? tcgListing(p.tcgProduct) : null,
              img: p.img,
              imgSource: "tcgdex",
              status: got ? "got" : "want",
              checkRequested: !got,
              ...inColl(coll),
            }),
          );
      if (!ok) {
        toast("Couldn't add it. Try again.");
        return false;
      }
      try {
        await mergeDoc("discover", p.id, { status: got ? "owned" : "added" });
        void qc.invalidateQueries({ queryKey: docKeys.discover });
      } catch {
        /* the card is on the list; the pick catches up on the next sync */
      }
      toast(addedMessage(p.name, got, coll));
      return true;
    },
    [cards, create, updateExisting, inColl, qc, toast],
  );

  const catalogSoon = useCallback(async (): Promise<Catalog | undefined> => {
    const fetching = qc.fetchQuery(catalogQuery);
    const timeout = new Promise<undefined>((r) => setTimeout(() => r(undefined), 5000));
    return Promise.race([fetching, timeout]).catch(() => undefined);
  }, [qc]);

  const fromLive = useCallback(
    async (d: LiveCard, want: WantOrGot, coll: string): Promise<boolean> => {
      const got = want === "got";
      const who = catalogIdentity(d.pid != null ? await catalogSoon() : undefined, d);
      const id = cardDocId([who.name, who.set, who.number].join(" "));
      const existing = cards.find((c) => c.id === id) ?? findOnList(cards, d);
      const ok = existing
        ? await updateExisting(existing, got, coll)
        : await create(
            id,
            newCard({
              name: who.name,
              number: who.number,
              set: who.set,
              lang: who.jp ? "JP" : "EN",
              ask: marketAsk(d.market, d.upd || today()),
              listing: d.pid ? tcgListing(d.pid) : null,
              img: d.pid || !d.img ? null : bigImage(d.img),
              imgSource: d.pid ? "tcgplayer" : "tcgdex",
              status: got ? "got" : "want",
              checkRequested: !got && d.market == null,
              ...inColl(coll),
            }),
          );
      if (!ok) {
        toast("Couldn't add it. Try again.");
        return false;
      }
      toast(addedMessage(d.name, got, coll));
      return true;
    },
    [cards, create, updateExisting, inColl, catalogSoon, toast],
  );

  return { fromPick, fromLive, updateExisting, create, slotIn };
}


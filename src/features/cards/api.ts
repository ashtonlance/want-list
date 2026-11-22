import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { WriteError, type Doc } from "~/data/docs";
import { docKeys } from "~/data/keys";
import { useDocsQuery, useDocWrite } from "~/data/useDocs";
import { useAuth } from "~/features/auth/AuthProvider";
import { slugify } from "~/lib/format";
import type { JsonRecord } from "~/lib/json";
import { useToast } from "~/ui/Toast";
import { parseCard } from "./parse";
import { usePrices } from "./prices";
import { withPrices } from "./pricing";
import type { Card, CardData, CardPatch } from "./types";

/** Card ids come from the card's name, set and number, so the same card added twice lands on one row. */
export const cardDocId = (s: string): string => slugify(s).slice(0, 120) || "card";

export interface CardsState {
  cards: Card[];
  loaded: boolean;
  failed: boolean;
}

/** Every card on the list, with today's prices applied. */
export function useCards(): CardsState {
  const docs = useDocsQuery("cards");
  const prices = usePrices();
  const cards = useMemo(
    () => (docs.data ?? []).map((d) => withPrices(parseCard(d.id, d.data), prices.data)),
    [docs.data, prices.data],
  );
  return { cards, loaded: docs.data !== undefined, failed: docs.isError && docs.data === undefined };
}

export interface CardWrites {
  /** Changes some of a card's fields. Resolves false if the write didn't go through. */
  save: (card: Card, patch: CardPatch, message?: string, quiet?: boolean) => Promise<boolean>;
  /** Changes several cards, then reports how many went through. */
  saveMany: (pairs: readonly (readonly [Card, CardPatch])[], message?: string) => Promise<void>;
  create: (id: string, data: CardData) => Promise<boolean>;
  remove: (card: Card) => Promise<boolean>;
}

export function useCardWrites(): CardWrites {
  const qc = useQueryClient();
  const write = useDocWrite("cards");
  const { markReadOnly } = useAuth();
  const { toast } = useToast();

  const failed = useCallback(
    (e: unknown, quiet: boolean, fallback: string) => {
      if (e instanceof WriteError && e.code === "denied") {
        markReadOnly();
        toast("You can view this list but not change it");
      } else if (!quiet) toast(fallback);
    },
    [markReadOnly, toast],
  );

  const save = useCallback<CardWrites["save"]>(
    async (card, patch, message, quiet = false) => {
      const stored = qc.getQueryData<Doc[]>(docKeys.cards)?.find((d) => d.id === card.id)?.data ?? {};
      try {
        await write.mutateAsync({ kind: "set", id: card.id, data: { ...stored, ...(patch as JsonRecord) } });
        if (message) toast(message);
        return true;
      } catch (e) {
        failed(e, quiet, "Couldn't save. Check your connection and try again.");
        return false;
      }
    },
    [qc, write, toast, failed],
  );

  const saveMany = useCallback<CardWrites["saveMany"]>(
    async (pairs, message) => {
      let ok = 0;
      for (const [c, patch] of pairs) if (await save(c, patch, undefined, true)) ok++;
      if (message) toast(ok === pairs.length ? message : `Saved ${ok} of ${pairs.length}. Try again for the rest.`);
    },
    [save, toast],
  );

  const create = useCallback<CardWrites["create"]>(
    async (id, data) => {
      try {
        await write.mutateAsync({ kind: "set", id, data: data as unknown as JsonRecord });
        return true;
      } catch (e) {
        failed(e, true, "");
        return false;
      }
    },
    [write, failed],
  );

  const remove = useCallback<CardWrites["remove"]>(
    async (card) => {
      try {
        await write.mutateAsync({ kind: "delete", id: card.id });
        toast(`Removed ${card.name}`);
        return true;
      } catch {
        toast("Couldn't remove it. Try again.");
        return false;
      }
    },
    [write, toast],
  );

  return { save, saveMany, create, remove };
}

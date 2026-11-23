import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { WriteError, writeFailure, type Doc } from "~/data/docs";
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
  /** Asks for the list again after a failed load. */
  retry: () => void;
}

/** Every card on the list, with today's prices applied. */
export function useCards(): CardsState {
  const docs = useDocsQuery("cards");
  const prices = usePrices();
  const cards = useMemo(
    () => (docs.data ?? []).map((d) => withPrices(parseCard(d.id, d.data), prices.data)),
    [docs.data, prices.data],
  );
  const { refetch } = docs;
  const retry = useCallback(() => void refetch(), [refetch]);
  return { cards, loaded: docs.data !== undefined, failed: docs.isError && docs.data === undefined, retry };
}

export type UpdateResult = "saved" | "unchanged" | "denied" | "failed";

export interface CardWrites {
  /** Changes some of a card's fields. Resolves false if the write didn't go through. */
  save: (card: Card, patch: CardPatch, message?: string, quiet?: boolean) => Promise<boolean>;
  /**
   * Changes several cards, then reports how many went through (always, if some didn't). With `undo`, the
   * message comes with an Undo button that puts the cards back as they were, then runs `undo.after`.
   */
  saveMany: (
    pairs: readonly (readonly [Card, CardPatch])[],
    message?: string,
    undo?: { after?: () => Promise<unknown> },
  ) => Promise<void>;
  /**
   * Changes the card as it's stored now: `build` gets the server's latest copy and returns the fields to
   * change, or null to leave it, so a write made after a slow lookup can't undo an edit made meanwhile.
   * A card removed meanwhile stays removed. A refused write is reported to the user here.
   */
  update: (card: Pick<Card, "id">, build: (now: Card) => CardPatch | null) => Promise<UpdateResult>;
  create: (id: string, data: CardData) => Promise<boolean>;
  remove: (card: Card) => Promise<boolean>;
}

export function useCardWrites(): CardWrites {
  const qc = useQueryClient();
  const write = useDocWrite("cards");
  const { markReadOnly } = useAuth();
  const { toast, toastUndo } = useToast();

  const failed = useCallback(
    (e: unknown, quiet: boolean, fallback: string) => {
      if (e instanceof WriteError && e.code === "denied") {
        markReadOnly();
        toast("You can view this list but not change it");
      } else if (!quiet) toast(writeFailure(e, fallback));
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
    async (pairs, message, undo) => {
      const docs = qc.getQueryData<Doc[]>(docKeys.cards) ?? [];
      const before = pairs.flatMap(([c]) => docs.filter((d) => d.id === c.id));
      let ok = 0;
      for (const [c, patch] of pairs) if (await save(c, patch, undefined, true)) ok++;
      // A partial failure is always reported, even for changes that would have saved quietly.
      if (ok < pairs.length)
        toast(writeFailure(undefined, `Saved ${ok} of ${pairs.length}. Try again for the rest.`));
      else if (message && undo)
        toastUndo(message, () => {
          void (async () => {
            try {
              for (const d of before) await write.mutateAsync({ kind: "set", id: d.id, data: d.data });
              await undo.after?.();
              toast("Undone");
            } catch (e) {
              failed(e, false, "Couldn't undo all of it. Try again.");
            }
          })();
        });
      else if (message) toast(message);
    },
    [qc, save, write, toast, toastUndo, failed],
  );

  const update = useCallback<CardWrites["update"]>(
    async (card, build) => {
      try {
        const stored = await write.mutateAsync({
          kind: "update",
          id: card.id,
          build: (data) => build(parseCard(card.id, data)),
        });
        return stored ? "saved" : "unchanged";
      } catch (e) {
        failed(e, true, "");
        return e instanceof WriteError && e.code === "denied" ? "denied" : "failed";
      }
    },
    [write, failed],
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
      const stored = qc.getQueryData<Doc[]>(docKeys.cards)?.find((d) => d.id === card.id)?.data;
      try {
        await write.mutateAsync({ kind: "delete", id: card.id });
      } catch (e) {
        failed(e, false, "Couldn't remove it. Try again.");
        return false;
      }
      // Putting the same document back brings the card, its photo and its binder pockets back as they were.
      if (stored)
        toastUndo(`Removed ${card.name}`, () => {
          write.mutateAsync({ kind: "set", id: card.id, data: stored }).then(
            () => toast(`Put ${card.name} back`),
            (e: unknown) => failed(e, false, "Couldn't put it back. Try again."),
          );
        });
      else toast(`Removed ${card.name}`);
      return true;
    },
    [qc, write, toast, toastUndo, failed],
  );

  return { save, saveMany, update, create, remove };
}

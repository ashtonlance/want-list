import { useCallback, useMemo } from "react";
import { prefs } from "~/app/prefs";
import { WriteError, type Doc } from "~/data/docs";
import { useDocsQuery, useDocWrite } from "~/data/useDocs";
import { useAuth } from "~/features/auth/AuthProvider";
import { isRecord } from "~/lib/json";
import { useToast } from "~/ui/Toast";
import { useCards, useCardWrites } from "./api";
import { allCollections, removeFromCollection, renameInCard, type CollectionSummary } from "./collections";

/**
 * The list of collections, in order, is a row of its own in the layouts table, so a collection can
 * exist before it has cards and keeps the order it was given.
 */
export const COLLECTIONS_DOC = "meta:collections";

/** Rows in the layouts table that aren't binders. */
export const isMetaDoc = (id: string): boolean => id.startsWith("meta:");

function savedNames(docs: readonly Doc[] | undefined): string[] {
  const d = docs?.find((x) => x.id === COLLECTIONS_DOC)?.data;
  const names = isRecord(d) && Array.isArray(d.names) ? d.names : [];
  return [...new Set(names.filter((n): n is string => typeof n === "string" && n.trim() !== ""))];
}

export interface CollectionsState {
  collections: CollectionSummary[];
  /** True once both the cards and the saved list have loaded. */
  loaded: boolean;
}

/** Every collection, saved order first, with its progress. */
export function useCollections(): CollectionsState {
  const { cards, loaded } = useCards();
  const docs = useDocsQuery("layouts");
  const saved = useMemo(() => savedNames(docs.data), [docs.data]);
  const collections = useMemo(() => allCollections(cards, saved), [cards, saved]);
  return { collections, loaded: loaded && docs.data !== undefined };
}

export interface CollectionWrites {
  create: (name: string) => Promise<boolean>;
  rename: (from: string, to: string) => Promise<void>;
  remove: (name: string) => Promise<void>;
  /** Saves the collections in this order. */
  reorder: (names: readonly string[]) => Promise<void>;
}

export function useCollectionWrites(): CollectionWrites {
  const { cards } = useCards();
  const { collections } = useCollections();
  const { saveMany } = useCardWrites();
  const layouts = useDocWrite("layouts");
  const discover = useDocWrite("discover");
  const picks = useDocsQuery("discover");
  const { markReadOnly } = useAuth();
  const { toast } = useToast();
  const names = useMemo(() => collections.map((c) => c.name), [collections]);

  const saveNames = useCallback(
    async (next: readonly string[]): Promise<boolean> => {
      try {
        await layouts.mutateAsync({ kind: "set", id: COLLECTIONS_DOC, data: { names: [...next] } });
        return true;
      } catch (e) {
        if (e instanceof WriteError && e.code === "denied") {
          markReadOnly();
          toast("You can view this list but not change it");
        } else toast("Couldn't save. Check your connection and try again.");
        return false;
      }
    },
    [layouts, markReadOnly, toast],
  );

  const create = useCallback<CollectionWrites["create"]>(
    async (name) => {
      if (names.includes(name)) {
        toast(`${name} already exists`);
        return false;
      }
      const ok = await saveNames([...names, name]);
      if (ok) toast(`Made ${name}`);
      return ok;
    },
    [names, saveNames, toast],
  );

  const rename = useCallback<CollectionWrites["rename"]>(
    async (from, to) => {
      if (!to || to === from) return;
      if (names.includes(to)) {
        toast(`${to} already exists`);
        return;
      }
      if (!(await saveNames(names.map((n) => (n === from ? to : n))))) return;
      if (prefs.coll.get() === from) prefs.coll.set(to);
      // Its picks follow it, so they stay on its tab in Explore.
      for (const d of picks.data ?? [])
        if (isRecord(d.data) && d.data.coll === from)
          void discover.mutateAsync({ kind: "merge", id: d.id, patch: { coll: to } }).catch(() => undefined);
      await saveMany(
        cards.filter((c) => c.collections.includes(from)).map((c) => [c, renameInCard(c, from, to)] as const),
        `Renamed to ${to}`,
      );
    },
    [names, saveNames, picks.data, discover, saveMany, cards, toast],
  );

  const remove = useCallback<CollectionWrites["remove"]>(
    async (name) => {
      if (!(await saveNames(names.filter((n) => n !== name)))) return;
      if (prefs.coll.get() === name) prefs.coll.set(null);
      await saveMany(
        cards
          .filter((c) => c.collections.includes(name))
          .map((c) => [c, removeFromCollection(c, name)] as const),
        `Deleted ${name}. The cards are still on your list.`,
      );
    },
    [names, saveNames, saveMany, cards],
  );

  const reorder = useCallback<CollectionWrites["reorder"]>(
    async (next) => {
      await saveNames(next);
    },
    [saveNames],
  );

  return { create, rename, remove, reorder };
}

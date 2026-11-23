import { useEffect, useRef, useState } from "react";
import { useDocsQuery, useDocWrite } from "~/data/useDocs";
import { useAuth } from "~/features/auth/AuthProvider";
import { useCatalog } from "~/features/catalog/catalog";
import { isRecord, type JsonRecord } from "~/lib/json";
import { plural } from "~/lib/format";
import { useCardWrites, useCards } from "./api";
import { usePrices } from "./prices";
import { setNameFixes } from "./setNames";

/** Where each renamed card's old set name is kept, so a rename can be put back by hand. */
export const SET_NAMES_BACKUP_DOC = "meta:set-names-backup";

/**
 * Once per visit, for an editor: merges sets saved under two names into the catalog's name
 * (setNames.ts). The old names are saved to a backup first, and nothing is renamed if that fails.
 */
export function useSetNameCleanup(): void {
  const { canWrite } = useAuth();
  const { cards, loaded } = useCards();
  const prices = usePrices();
  const catalog = useCatalog(canWrite);
  const layouts = useDocsQuery("layouts");
  const cardDocs = useDocsQuery("cards");
  const writeLayout = useDocWrite("layouts");
  const { saveMany } = useCardWrites();
  const ran = useRef(false);

  const cat = catalog.data;
  const docs = layouts.data;
  // Fresh from the server, not this device's saved copy, so a rename can't write back stale fields.
  // A saved copy may be young enough not to refetch on its own, so this asks once.
  const [fresh, setFresh] = useState(false);
  const { refetch: refetchCards } = cardDocs;
  const { refetch: refetchLayouts } = layouts;
  useEffect(() => {
    if (!canWrite || fresh) return;
    let live = true;
    void Promise.all([refetchCards(), refetchLayouts()]).then(([c, l]) => {
      if (live && c.isSuccess && l.isSuccess) setFresh(true);
    });
    return () => {
      live = false;
    };
  }, [canWrite, fresh, refetchCards, refetchLayouts]);
  // Prices carry each card's TCGplayer product, the surest way to tell its set.
  const ready = canWrite && loaded && fresh && !cardDocs.isFetching && prices.data !== undefined;
  useEffect(() => {
    if (!ready || !cat || !docs || ran.current) return;
    ran.current = true;
    const fixes = setNameFixes(cards, cat);
    if (!fixes.length) return;
    const old = docs.find((d) => d.id === SET_NAMES_BACKUP_DOC)?.data.cards;
    // The first name a card had is the one worth keeping, so earlier entries win.
    const backup: JsonRecord = {
      ...Object.fromEntries(fixes.map((f) => [f.card.id, f.from])),
      ...(isRecord(old) ? old : {}),
    };
    void (async () => {
      try {
        await writeLayout.mutateAsync({
          kind: "set",
          id: SET_NAMES_BACKUP_DOC,
          data: { cards: backup, savedAt: new Date().toISOString() },
        });
      } catch {
        return;
      }
      await saveMany(
        fixes.map((f) => [f.card, { set: f.to }] as const),
        `Merged duplicate set names on ${plural(fixes.length, "card")}`,
      );
    })();
  }, [ready, cards, cat, docs, writeLayout, saveMany]);
}

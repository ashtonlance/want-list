import { useEffect, useRef } from "react";
import { fetchDocs } from "~/data/docs";
import { useDocWrite } from "~/data/useDocs";
import { useAuth } from "~/features/auth/AuthProvider";
import { useCatalog } from "~/features/catalog/catalog";
import { plural } from "~/lib/format";
import { isRecord, type JsonRecord } from "~/lib/json";
import { useToast } from "~/ui/Toast";
import { parseCard } from "./parse";
import { usePrices } from "./prices";
import { withPrices } from "./pricing";
import { setNameFixes } from "./setNames";

/** Where each renamed card's old set name is kept, so a rename can be put back by hand. */
export const SET_NAMES_BACKUP_DOC = "meta:set-names-backup";

/**
 * Once per visit, for an editor: merges sets saved under two names into the catalog's name
 * (setNames.ts). It reads the cards straight from the server rather than this device's saved copy,
 * saves the old names to a backup first, renames nothing if that fails, and changes only each
 * card's set, so it can't write back stale fields.
 */
export function useSetNameCleanup(): void {
  const { canWrite } = useAuth();
  const prices = usePrices();
  const catalog = useCatalog(canWrite);
  const writeCards = useDocWrite("cards");
  const writeLayouts = useDocWrite("layouts");
  const { toast } = useToast();
  const ran = useRef(false);

  // Prices carry each card's TCGplayer product, the surest way to tell its set.
  const cat = catalog.data;
  const priceFile = prices.data;
  const ready = canWrite && cat !== undefined && priceFile !== undefined;
  useEffect(() => {
    if (!ready || ran.current) return;
    ran.current = true;
    void (async () => {
      try {
        const [cardDocs, layoutDocs] = await Promise.all([fetchDocs("cards"), fetchDocs("layouts")]);
        const cards = cardDocs.map((d) => withPrices(parseCard(d.id, d.data), priceFile));
        const fixes = setNameFixes(cards, cat);
        if (!fixes.length) return;
        const old = layoutDocs.find((d) => d.id === SET_NAMES_BACKUP_DOC)?.data.cards;
        // The first name a card had is the one worth keeping, so earlier entries win.
        const backup: JsonRecord = {
          ...Object.fromEntries(fixes.map((f) => [f.card.id, f.from])),
          ...(isRecord(old) ? old : {}),
        };
        await writeLayouts.mutateAsync({
          kind: "set",
          id: SET_NAMES_BACKUP_DOC,
          data: { cards: backup, savedAt: new Date().toISOString() },
        });
        let done = 0;
        for (const f of fixes) {
          await writeCards.mutateAsync({ kind: "merge", id: f.card.id, patch: { set: f.to } });
          done++;
        }
        toast(`Merged duplicate set names on ${plural(done, "card")}`);
      } catch {
        // Nothing to tell: it tries again next visit, and the backup is written before any rename.
      }
    })();
  }, [ready, cat, priceFile, writeCards, writeLayouts, toast]);
}

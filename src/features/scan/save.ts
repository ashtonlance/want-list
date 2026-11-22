/* Saving a reviewed scan: every matched card becomes owned on the list, then the pages go into a binder. */
import { useCallback } from "react";
import { prefs } from "~/app/prefs";
import { newBinderId } from "~/features/binders/parse";
import { setBinderPage } from "~/features/binders/state";
import type { Binder, Slot } from "~/features/binders/types";
import { useBinders } from "~/features/binders/useBinders";
import { cardDocId, useCardWrites, useCards } from "~/features/cards/api";
import { marketAsk, newCard } from "~/features/cards/create";
import { tcgProductUrl } from "~/features/cards/links";
import { isGot, pidOf } from "~/features/cards/pricing";
import { cleanName, plural, today } from "~/lib/format";
import { useToast } from "~/ui/Toast";
import type { Entry } from "./engine/match";
import { DEFAULT_NAME, willSave, type ScanState } from "./session";

/** Appending whole pages: a partly filled last page is padded so the first scanned page starts a new one. */
function padToPage(slots: readonly (Slot | null)[], pockets: number): (Slot | null)[] {
  const gap = (pockets - (slots.length % pockets)) % pockets;
  return [...slots, ...new Array<null>(gap).fill(null)];
}

export function useSaveScan() {
  const { cards } = useCards();
  const { save, create } = useCardWrites();
  const binders = useBinders();
  const { toast } = useToast();

  /**
   * Saves the scan, calling `onCard` after each pocket. Resolves false if the binder couldn't be saved
   * (useBinders has said so); the cards are owned either way, so trying again doesn't add them twice.
   */
  return useCallback(
    async (s: ScanState, onCard: () => void): Promise<boolean> => {
      const byId = (id: string) => cards.find((c) => c.id === id);
      // A printing that shows up in several pockets is marked or added once.
      const done = new Map<number, string>();

      /** The list card for a printing: found and marked owned, or added as owned. */
      async function own(e: Entry): Promise<string> {
        const known = done.get(e.pid);
        if (known) return known;
        const id = cardDocId([e.name, e.set, e.no].join(" "));
        const c = (e.mine ? byId(e.mine) : undefined) ?? cards.find((x) => pidOf(x) === e.pid) ?? byId(id);
        if (c) {
          if (!isGot(c) && !(await save(c, { status: "got", checkRequested: false }, undefined, true)))
            throw new Error("save");
          done.set(e.pid, c.id);
          return c.id;
        }
        const ok = await create(
          id,
          newCard({
            name: e.name,
            number: e.no,
            set: e.set,
            lang: e.jp ? "JP" : "EN",
            ask: marketAsk(e.market, s.asOf),
            listing: { url: tcgProductUrl(e.pid), site: "TCGplayer", addedAt: today() },
            status: "got",
            checkRequested: false,
          }),
        );
        if (!ok) throw new Error("create");
        done.set(e.pid, id);
        return id;
      }

      const slots: (Slot | null)[] = [];
      let failed = 0;
      for (const c of s.pages.flat()) {
        if (!willSave(c)) {
          slots.push(null);
          continue;
        }
        try {
          slots.push({ k: "c", id: await own(c.pick) });
        } catch {
          failed++;
          slots.push(null);
        }
        onCard();
      }

      const existing = binders.binders.find((b) => b.id === s.dest);
      const kept = existing ? padToPage(existing.slots, existing.pockets) : [];
      const b: Binder = existing
        ? { ...existing, slots: [...kept, ...slots] }
        : {
            id: newBinderId(),
            name: cleanName(s.name) || DEFAULT_NAME,
            pockets: s.pockets,
            slots,
            createdAt: new Date().toISOString(),
            updatedAt: "",
          };
      if (!(await binders.save(b))) return false;
      prefs.binder.set(b.id);
      setBinderPage(b.id, kept.length / b.pockets);
      const n = slots.filter(Boolean).length;
      toast(
        `Saved ${plural(n, "card")} to ${b.name}${failed ? `. ${failed} didn't save, so those pockets are empty.` : "."}`,
      );
      return true;
    },
    [cards, save, create, binders, toast],
  );
}

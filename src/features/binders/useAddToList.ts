import { useCallback } from "react";
import { cardDocId, useCardWrites, useCards } from "~/features/cards/api";
import { marketAsk, newCard } from "~/features/cards/create";
import { tcgProductUrl } from "~/features/cards/links";
import { today } from "~/lib/format";
import { useToast } from "~/ui/Toast";
import type { WebSlot } from "./types";

/** Puts a catalog card from a pocket on the want list. Resolves to the new card's id, or null if it wasn't added. */
export function useAddToList(): (s: WebSlot) => Promise<string | null> {
  const { cards } = useCards();
  const { create } = useCardWrites();
  const { toast } = useToast();
  return useCallback(
    async (s) => {
      const id = cardDocId([s.n, s.s, s.no].join(" "));
      if (cards.some((c) => c.id === id)) {
        toast("Already on your list");
        return null;
      }
      const ok = await create(
        id,
        newCard({
          name: s.n,
          number: s.no,
          set: s.s,
          lang: s.jp ? "JP" : "EN",
          ask: marketAsk(s.m, ""),
          listing: { url: tcgProductUrl(s.pid), site: "TCGplayer", addedAt: today() },
        }),
      );
      if (!ok) toast("Couldn't add it. Try again.");
      return ok ? id : null;
    },
    [cards, create, toast],
  );
}

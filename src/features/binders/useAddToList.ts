import { useCallback } from "react";
import { cardDocId, useCardWrites, useCards } from "~/features/cards/api";
import { marketAsk, newCard } from "~/features/cards/create";
import { parseCard } from "~/features/cards/parse";
import { usePriceCheck } from "~/features/cards/priceCheck";
import { tcgProductUrl } from "~/features/cards/links";
import { today } from "~/lib/format";
import { useToast } from "~/ui/Toast";
import type { WebSlot } from "./types";

/** Puts a catalog card from a pocket on the want list. Resolves to the new card's id, or null if it wasn't added. */
export function useAddToList(): (s: WebSlot) => Promise<string | null> {
  const { cards } = useCards();
  const { create } = useCardWrites();
  const checkPrice = usePriceCheck();
  const { toast } = useToast();
  return useCallback(
    async (s) => {
      const id = cardDocId([s.n, s.s, s.no].join(" "));
      if (cards.some((c) => c.id === id)) {
        toast("Already on your list");
        return null;
      }
      const data = newCard({
        name: s.n,
        number: s.no,
        set: s.s,
        lang: s.jp ? "JP" : "EN",
        ask: marketAsk(s.m, ""),
        listing: { url: tcgProductUrl(s.pid), site: "TCGplayer", addedAt: today() },
      });
      const ok = await create(id, data);
      if (!ok) toast("Couldn't add it. Try again.");
      else if (data.ask?.amount == null) void checkPrice(parseCard(id, data)).catch(() => undefined);
      return ok ? id : null;
    },
    [cards, create, checkPrice, toast],
  );
}

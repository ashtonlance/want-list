import { Empty } from "~/components/ui/empty";
import { useCallback, useMemo, useRef } from "react";
import { useOverlayNav } from "~/app/overlayNav";
import { useAuth } from "~/features/auth/AuthProvider";
import { useCards } from "~/features/cards/api";
import { useAddCards } from "~/features/cards/create";
import { isGot } from "~/features/cards/pricing";
import type { Catalog } from "~/features/catalog/catalog";
import type { FeedLang } from "~/features/catalog/feed";
import { formatDate, formatMoney } from "~/lib/format";
import { usePhotoFeed } from "~/ui/Lightbox";
import { VirtualGrid } from "~/ui/VirtualGrid";
import { catalogLightbox, listMark } from "./display";
import { useEnterAnimation } from "~/lib/motion";
import { useScrollRestoration } from "~/lib/scroll";
import { AddedMark, ExCard, PriceTag, QuickWant } from "./ExCard";
import { catalogLiveCard } from "./live";
import { listLookup } from "./onList";
import { useQuickAddTo } from "./quickAdd";

interface FeedProps {
  cat: Catalog;
  /** Indexes into `cat.cards`, already filtered and sorted. */
  rows: readonly number[];
  lang: FeedLang;
  /** Names this exact feed (language, order, filters), so a position is only restored in the same feed. */
  scrollKey: string;
  /** The search these rows answer, or "" for every card. */
  q?: string;
  /** True when look, rarity, price or era filters narrow the feed. */
  filtered?: boolean;
}

/**
 * "Every card", or a search of it: the daily catalog, every row of it scrollable at once. Only the
 * rows near the screen are drawn (ui/VirtualGrid), so tens of thousands of cards scroll like a screenful.
 */
export function EveryCardFeed({ cat, rows, lang, scrollKey, q = "", filtered = false }: FeedProps) {
  useScrollRestoration(scrollKey, true);
  // New filters or sort: the feed fades in afresh.
  const grid = useRef<HTMLDivElement>(null);
  useEnterAnimation(grid, rows);

  const { cards } = useCards();
  const onList = useMemo(() => listLookup(cards), [cards]);
  const { canWrite } = useAuth();
  const addTo = useQuickAddTo();
  const { fromLive } = useAddCards();
  const { open } = useOverlayNav();
  const total = rows.length;
  const toPhoto = useCallback(
    (i: number) => {
      const row = cat.cards[i];
      if (!row) return null;
      const d = catalogLiveCard(cat, row);
      if (!d.img) return null;
      const want = canWrite ? { coll: addTo, run: () => fromLive(d, "want", addTo) } : null;
      const item = catalogLightbox(d, d.img, listMark(onList(d)), want);
      return { ...item, onDetails: () => open({ live: d.id }) };
    },
    [cat, onList, canWrite, fromLive, addTo, open],
  );
  const photoOf = usePhotoFeed(rows, toPhoto);

  const tile = useCallback(
    (i: number, at: number) => {
      const row = cat.cards[i];
      if (!row) return null;
      const d = catalogLiveCard(cat, row);
      const have = onList(d);
      return (
        <ExCard
          key={d.id}
          sr={d.id}
          label={`${d.name}, ${d.set}${d.market ? `, ${formatMoney(d.market)}` : ""}`}
          img={d.img}
          name={d.name}
          meta={`${d.set} · #${d.number}`}
          badge={d.jp && lang !== "jp" ? "JP" : undefined}
          onOpen={() => open({ live: d.id }, d.id)}
          onPhoto={photoOf(at)}
          line={
            <>
              <PriceTag market={d.market} />
              {have ? (
                <AddedMark have={isGot(have)} />
              ) : canWrite ? (
                <QuickWant name={d.name} coll={addTo} onWant={() => fromLive(d, "want", addTo)} />
              ) : null}
            </>
          }
        />
      );
    },
    [cat, onList, lang, open, photoOf, canWrite, addTo, fromLive],
  );

  return (
    <>
      {total ? (
        <VirtualGrid ref={grid} className="ex-grid" items={rows} renderItem={tile} scrollKey={scrollKey} />
      ) : (
        <Empty>
          {q
            ? `No ${lang === "en" ? "English " : lang === "jp" ? "Japanese " : ""}cards match “${q}”.${filtered ? ` Try clearing filters${lang === "both" ? "" : " or another language"} under Filter and sort.` : lang === "both" ? "" : " Try another language under Filter and sort."}`
            : "No cards match these filters."}
        </Empty>
      )}
      {total ? <p className="hint lv-foot">That&apos;s all {total.toLocaleString()} cards.</p> : null}
      <p className="hint">
        Every English and Japanese card from TCGplayer&apos;s catalog, refreshed daily. Prices are TCGplayer
        market before shipping, as of {formatDate(cat.asOf)}.
      </p>
    </>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOverlayNav } from "~/app/overlayNav";
import { useAuth } from "~/features/auth/AuthProvider";
import { useCards } from "~/features/cards/api";
import { useAddCards } from "~/features/cards/create";
import { isGot } from "~/features/cards/pricing";
import type { Catalog } from "~/features/catalog/catalog";
import type { FeedLang } from "~/features/catalog/feed";
import { formatDate, formatMoney } from "~/lib/format";
import { usePhotoGrid } from "~/ui/Lightbox";
import { exploreLightbox } from "./display";
import { useEnterAnimation } from "~/lib/motion";
import { savedRowCount, useScrollRestoration } from "~/lib/scroll";
import { AddedMark, ExCard, PriceTag, QuickWant } from "./ExCard";
import { catalogLiveCard } from "./live";
import { listLookup } from "./onList";
import { useQuickAddTo } from "./quickAdd";

const PAGE = 60;

interface FeedProps {
  cat: Catalog;
  /** Indexes into `cat.cards`, already filtered and sorted. */
  rows: readonly number[];
  lang: FeedLang;
  /** Names this exact feed (language, order, filters), so a position is only restored in the same feed. */
  scrollKey: string;
  /** The search these rows answer, or "" for every card. */
  q?: string;
}

/** "Every card", or a search of it: the daily catalog, loading another page as the end comes into view. */
export function EveryCardFeed({ cat, rows, lang, scrollKey, q = "" }: FeedProps) {
  // Coming back to a feed loads as many pages as it had before, so its saved card is there to scroll to.
  const startShown = () => Math.min(Math.max(savedRowCount(scrollKey) ?? PAGE, PAGE), rows.length);
  const [page, setPage] = useState(() => ({ rows, shown: startShown() }));
  // New filters or a new day's catalog: as many pages as that feed had last time, or the first page.
  if (page.rows !== rows) setPage({ rows, shown: startShown() });
  const { shown } = page;
  const more = shown < rows.length;
  useScrollRestoration(scrollKey, true, shown);

  const foot = useRef<HTMLParagraphElement>(null);
  // New filters or sort: the feed fades in afresh.
  const grid = useRef<HTMLDivElement>(null);
  useEnterAnimation(grid, rows);
  // A fresh observer after every page, so a page that still leaves the end in view loads the next one.
  useEffect(() => {
    const el = foot.current;
    if (!el || !more) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting))
          setPage((p) => ({ ...p, shown: Math.min(p.shown + PAGE, p.rows.length) }));
      },
      { rootMargin: "1500px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [more, shown]);

  const { cards } = useCards();
  const onList = useMemo(() => listLookup(cards), [cards]);
  const { canWrite } = useAuth();
  const addTo = useQuickAddTo();
  const { fromLive } = useAddCards();
  const { open } = useOverlayNav();
  const total = rows.length;
  const visible = useMemo(() => rows.slice(0, shown), [rows, shown]);
  const toPhoto = useCallback(
    (i: number) => {
      const row = cat.cards[i];
      if (!row) return null;
      const d = catalogLiveCard(cat, row);
      return d.img ? { ...exploreLightbox(d, d.img), onDetails: () => open({ live: d.id }) } : null;
    },
    [cat, open],
  );
  const photoOf = usePhotoGrid(visible, toPhoto);

  return (
    <>
      <div className="ex-grid" ref={grid}>
        {visible.map((i) => {
          const row = cat.cards[i];
          if (!row) return null;
          const d = catalogLiveCard(cat, row);
          const have = onList(d);
          return (
            <ExCard
              key={d.id}
              sr={d.id}
              className="cv"
              label={`${d.name}, ${d.set}${d.market ? `, ${formatMoney(d.market)}` : ""}`}
              img={d.img}
              name={d.name}
              meta={`${d.set} · #${d.number}`}
              badge={d.jp && lang !== "jp" ? "JP" : undefined}
              onOpen={() => open({ live: d.id }, d.id)}
              onPhoto={photoOf(i)}
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
        })}
        {total ? null : (
          <div className="empty-state">
            {q
              ? `No ${lang === "en" ? "English " : lang === "jp" ? "Japanese " : ""}cards match “${q}”.${lang === "both" ? "" : " Try another language under Filter and sort."}`
              : "No cards match these filters."}
          </div>
        )}
      </div>
      <p className="hint lv-foot" ref={foot}>
        {more
          ? `Loading more… ${shown.toLocaleString()} of ${total.toLocaleString()}`
          : total
            ? `That's all ${total.toLocaleString()} cards.`
            : ""}
      </p>
      <p className="hint">
        Every English and Japanese card from TCGplayer&apos;s catalog, refreshed daily. Prices are TCGplayer
        market before shipping, as of {formatDate(cat.asOf)}.
      </p>
    </>
  );
}

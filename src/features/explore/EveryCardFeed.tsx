import { useEffect, useMemo, useRef, useState } from "react";
import { useOverlayNav } from "~/app/overlayNav";
import { useAuth } from "~/features/auth/AuthProvider";
import { useCards } from "~/features/cards/api";
import { useAddCards } from "~/features/cards/create";
import { isGot } from "~/features/cards/pricing";
import type { Catalog } from "~/features/catalog/catalog";
import type { FeedLang } from "~/features/catalog/feed";
import { formatDate, formatMoney } from "~/lib/format";
import { savedRowCount, useScrollRestoration } from "~/lib/scroll";
import { AddedMark, ExCard, PriceTag, QuickWant } from "./ExCard";
import { catalogLiveCard } from "./live";
import { listLookup } from "./onList";
import { useLiveUi } from "./state";

const SCROLL_KEY = "live:all";
const PAGE = 60;

interface FeedProps {
  cat: Catalog;
  /** Indexes into `cat.cards`, already filtered and sorted. */
  rows: readonly number[];
  lang: FeedLang;
}

/** "Every card": the daily catalog, loading another page as the end comes into view. */
export function EveryCardFeed({ cat, rows, lang }: FeedProps) {
  const [page, setPage] = useState(() => ({
    rows,
    shown: Math.min(Math.max(savedRowCount(SCROLL_KEY) ?? PAGE, PAGE), rows.length),
  }));
  // New filters or a new day's catalog start again from the first page.
  if (page.rows !== rows) setPage({ rows, shown: Math.min(PAGE, rows.length) });
  const { shown } = page;
  const more = shown < rows.length;
  useScrollRestoration(SCROLL_KEY, true, shown);

  const foot = useRef<HTMLParagraphElement>(null);
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
  const { addTo } = useLiveUi();
  const { fromLive } = useAddCards();
  const { open } = useOverlayNav();
  const total = rows.length;

  return (
    <>
      <div className="ex-grid">
        {rows.slice(0, shown).map((i) => {
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
              onOpen={() => open({ live: d.id })}
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
        {total ? null : <div className="empty-state">No cards match these filters.</div>}
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

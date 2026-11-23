import { useCallback, useMemo, useRef, useState } from "react";
import { useOverlayNav } from "~/app/overlayNav";
import { useAuth } from "~/features/auth/AuthProvider";
import { useCards } from "~/features/cards/api";
import { useAddCards } from "~/features/cards/create";
import { isGot } from "~/features/cards/pricing";
import { useEnterAnimation } from "~/lib/motion";
import { savedRowCount, useScrollRestoration } from "~/lib/scroll";
import { usePhotoGrid } from "~/ui/Lightbox";
import { SkeletonGrid } from "~/ui/Skeleton";
import { catalogLightbox, exploreLightbox } from "./display";
import { LoadError } from "~/ui/LoadError";
import { AddedMark, ExCard, PriceTag, QuickWant } from "./ExCard";
import { useLiveCards, useTdSetCards, useTdSets } from "./live";
import { listLookup } from "./onList";
import { useQuickAddTo } from "./quickAdd";
import { useLiveUi } from "./state";
import type { TdBrief } from "./tcgdex";

const PAGE = 24;
/** Sorting or filtering by price needs each result's price, so that many are fetched up front. */
const PRICED_MAX = 250;

/** One set's cards, from TCGdex. Give it a `key` per set. */
export function LiveResults({ set }: { set: string }) {
  const scrollKey = `live:set:${set}`;
  const sets = useTdSets();
  const list = useTdSetCards(set);
  const { sort, cap } = useLiveUi();
  const addTo = useQuickAddTo();
  const [shown, setShown] = useState(() => Math.max(savedRowCount(scrollKey) ?? PAGE, PAGE));
  useScrollRestoration(scrollKey, list.data !== undefined, shown);

  const priced = sort !== "num" || cap > 0;
  const priceIds = useMemo(() => (list.data ?? []).slice(0, PRICED_MAX).map((b) => b.id), [list.data]);
  const prices = useLiveCards(priceIds, priced);

  const rows = useMemo(() => {
    const market = (b: TdBrief) => prices.map.get(b.id)?.market ?? null;
    let out = list.data ?? [];
    if (cap) out = out.filter((b) => (market(b) ?? Infinity) <= cap);
    if (sort === "high") out = [...out].sort((a, b) => (market(b) ?? -1) - (market(a) ?? -1));
    if (sort === "low") out = [...out].sort((a, b) => (market(a) ?? Infinity) - (market(b) ?? Infinity));
    return out;
  }, [list.data, prices.map, cap, sort]);

  const visible = useMemo(() => rows.slice(0, shown), [rows, shown]);
  const visibleIds = useMemo(() => visible.map((b) => b.id), [visible]);
  const tiles = useLiveCards(visibleIds);

  const { cards } = useCards();
  const onList = useMemo(() => listLookup(cards), [cards]);
  const { canWrite } = useAuth();
  const { fromLive } = useAddCards();
  const { open } = useOverlayNav();
  const toPhoto = useCallback(
    (b: TdBrief) => {
      const d = tiles.map.get(b.id);
      const src = b.image ? `${b.image}/low.webp` : d?.img;
      if (!src) return null;
      // Until its details arrive the card can't be matched to the list or added, so it shows plain.
      const item = d
        ? catalogLightbox(d, src, onList(d), canWrite ? () => fromLive(d, "want", addTo) : null)
        : exploreLightbox({ name: b.name, set: "", number: b.localId, market: null }, src);
      return { ...item, onDetails: () => open({ live: b.id }) };
    },
    [tiles.map, onList, canWrite, fromLive, addTo, open],
  );
  const photoOf = usePhotoGrid(visible, toPhoto);
  const grid = useRef<HTMLDivElement>(null);
  useEnterAnimation(grid, `${set}|${sort}|${String(cap)}`);

  if (sets.isError || list.isError)
    return (
      <LoadError
        text="Couldn't reach the live card data. Check your connection and try again."
        onRetry={() => {
          void sets.refetch();
          if (sets.data) void list.refetch();
        }}
      />
    );
  if (!list.data) return <SkeletonGrid className="ex-grid" count={6} />;

  const progress =
    priced && prices.settled < priceIds.length
      ? `Getting prices… ${prices.settled} of ${priceIds.length}`
      : "";

  return (
    <>
      {progress ? <p className="hint">{progress}</p> : null}
      <div className="ex-grid" ref={grid}>
        {visible.map((b) => {
          const d = tiles.map.get(b.id);
          const have = d ? onList(d) : null;
          return (
            <ExCard
              key={b.id}
              sr={b.id}
              label={b.name + (d?.set ? `, ${d.set}` : "")}
              img={b.image ? `${b.image}/low.webp` : d?.img}
              name={b.name}
              meta={d ? `${d.set} · #${d.number}` : `#${b.localId}`}
              onOpen={() => open({ live: b.id }, b.id)}
              onPhoto={photoOf(b)}
              line={
                d ? (
                  <>
                    <PriceTag market={d.market} />
                    {have ? (
                      <AddedMark have={isGot(have)} />
                    ) : canWrite ? (
                      <QuickWant name={d.name} coll={addTo} onWant={() => fromLive(d, "want", addTo)} />
                    ) : null}
                  </>
                ) : tiles.failed.has(b.id) ? (
                  <span className="ex-meta">No price</span>
                ) : (
                  <span className="ex-meta lv-wait">…</span>
                )
              }
            />
          );
        })}
        {rows.length ? null : (
          <div className="empty-state">{progress ? "Getting prices…" : "No cards match these filters."}</div>
        )}
      </div>
      {rows.length > shown ? (
        <button className="btn wide lv-more" type="button" onClick={() => setShown((n) => n + PAGE)}>
          Show more ({rows.length - shown} left)
        </button>
      ) : null}
      <p className="hint">
        Live card data from TCGdex, refreshed daily. Prices are TCGplayer market before shipping.
      </p>
    </>
  );
}

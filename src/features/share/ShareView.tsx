import { useCallback, useMemo } from "react";
import { useCards } from "~/features/cards/api";
import { cardImageSrc } from "~/features/cards/image";
import { lightboxItem } from "~/features/cards/lightboxItem";
import { shortPrice } from "~/features/cards/pricing";
import type { Card } from "~/features/cards/types";
import { formatMoney, plural } from "~/lib/format";
import { useScrollRestoration } from "~/lib/scroll";
import { CardImage } from "~/ui/CardImage";
import { usePhotoGrid } from "~/ui/Lightbox";
import { SkeletonGrid } from "~/ui/Skeleton";
import { buyUrl, printingOf, sharedList } from "./share";

function ShareTile({ card: c, onPhoto }: { card: Card; onPhoto: (() => void) | undefined }) {
  const sp = shortPrice(c);
  const printing = printingOf(c);
  return (
    <article className="share-tile" data-sr={c.id}>
      <button
        type="button"
        className="tile-img"
        aria-label={`Show ${c.name} full screen`}
        onClick={onPhoto}
        disabled={!onPhoto}
      >
        <CardImage src={cardImageSrc(c)} name={c.name} />
      </button>
      <div className="tile-name">{c.name}</div>
      <div className="tile-sub">
        {[c.lang === "JP" ? "Japanese" : "", c.set, c.number ? `#${c.number}` : ""]
          .filter(Boolean)
          .join(" · ")}
      </div>
      {printing ? <div className="tile-sub tile-variant">{printing}</div> : null}
      <div className="share-buy">
        <span className="share-price num">{sp?.amt ?? "No price yet"}</span>
        <a href={buyUrl(c)} target="_blank" rel="noopener">
          Buy
        </a>
      </div>
    </article>
  );
}

function Section({
  title,
  cards,
  photoOf,
}: {
  title: string;
  cards: readonly Card[];
  photoOf: (c: Card) => (() => void) | undefined;
}) {
  if (!cards.length) return null;
  return (
    <section className="share-sec" aria-label={title}>
      <h2 className="sec-title">{title}</h2>
      <div className="list grid">
        {cards.map((c) => (
          <ShareTile key={c.id} card={c} onPhoto={photoOf(c)} />
        ))}
      </div>
    </section>
  );
}

/** The read-only want list for family and friends: what's still wanted, priority picks first, with prices. */
export function ShareView({ coll }: { coll: string | null }) {
  const { cards, loaded, failed } = useCards();
  const list = useMemo(() => sharedList(cards, coll), [cards, coll]);
  const rows = useMemo(() => [...list.top, ...list.rest], [list]);
  const toPhoto = useCallback((c: Card) => {
    const src = cardImageSrc(c);
    return src ? lightboxItem(c, src) : null;
  }, []);
  const photoOf = usePhotoGrid(rows, toPhoto);
  useScrollRestoration(`share:${coll ?? ""}`, loaded);

  let body;
  if (!loaded && !failed) body = <SkeletonGrid className="list grid" count={9} />;
  else if (failed)
    body = <div className="banner">Couldn&apos;t load the list. Check your connection and try again.</div>;
  else if (!rows.length) body = <div className="empty-state">Nothing on this list right now.</div>;
  else
    body = (
      <>
        <Section title="Most wanted" cards={list.top} photoOf={photoOf} />
        <Section title={list.top.length ? "Also wanted" : "Wanted"} cards={list.rest} photoOf={photoOf} />
      </>
    );

  return (
    <div className="share">
      <header className="share-head">
        <small>Poke Cards</small>
        <h1>Ashton&apos;s want list</h1>
        {coll ? <p className="share-coll">{coll}</p> : null}
        {loaded && rows.length ? (
          <p className="share-sum">
            {plural(list.count, "card")}
            {list.total > 0
              ? ` · about ${formatMoney(Math.round(list.total)).replace(/\.00$/, "")} in all`
              : ""}
          </p>
        ) : null}
      </header>
      {body}
      <p className="share-foot">Prices update every day. Tap a picture to see the card up close.</p>
    </div>
  );
}

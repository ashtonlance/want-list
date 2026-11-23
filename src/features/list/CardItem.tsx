import { useCardWrites } from "~/features/cards/api";
import { cardImageSrc } from "~/features/cards/image";
import { sharePct, usePriceDrop, type PriceDrop } from "~/features/cards/history";
import { ownedBadge, ownedOf } from "~/features/cards/owned";
import { isGot, shortPrice } from "~/features/cards/pricing";
import type { Card } from "~/features/cards/types";
import { formatDate } from "~/lib/format";
import { CardImage } from "~/ui/CardImage";
import { StarIcon, StarMark } from "~/ui/icons";
import { showCollection } from "./state";

interface ItemProps {
  card: Card;
  selecting: boolean;
  selected: boolean;
  canWrite: boolean;
  /** Opens the card, or toggles it while selecting. */
  onActivate: (card: Card) => void;
  /** Shows the card full screen when its picture is tapped (not while selecting). */
  onPhoto?: (() => void) | undefined;
}

function Check({ on }: { on: boolean }) {
  return <span className={"check" + (on ? " on" : "")}>{on ? "✓" : ""}</span>;
}

/** What a card's open button reads out: name, printing, set, and whether it's got or its price. */
function cardLabel(c: Card, drop: PriceDrop | null): string {
  const sp = shortPrice(c);
  return (
    c.name +
    (c.variant ? `, ${c.variant}` : "") +
    (c.set ? `, ${c.set}` : "") +
    (isGot(c) ? ", got it" : sp?.amt ? `, ${sp.amt}` : "") +
    (drop ? `, down ${sharePct(drop.share)}` : "")
  );
}

/**
 * A meaningful drop in the market price the tile or row shows. Only on wanted cards, and only when the price
 * shown is that market price (not a shipped deal or an ask), so the two always agree.
 */
function useShownDrop(c: Card): PriceDrop | null {
  const drop = usePriceDrop(c);
  return !isGot(c) && shortPrice(c)?.label === "market" && c.tcg?.market != null ? drop : null;
}

/** The button over a tile's or row's picture that shows it full screen; none while selecting. */
function PhotoButton({ name, onPhoto }: { name: string; onPhoto: () => void }) {
  return (
    <button className="photo-open" type="button" aria-label={`Show ${name} full screen`} onClick={onPhoto} />
  );
}

/*
 * A tile or row is a plain container. Its .card-open button, stretched over it, opens the card (or
 * toggles it while selecting); the picture's button and the row's chips and star sit above it, so no
 * control is nested in another (styles/cards.css).
 */

/** A card in the grid layout. */
export function CardTile({ card: c, selecting, selected, onActivate, onPhoto }: ItemProps) {
  const got = isGot(c);
  const sp = shortPrice(c);
  const drop = useShownDrop(c);
  const label = cardLabel(c, drop) + (selecting ? (selected ? ", selected" : ", not selected") : "");
  return (
    <article className={"tile" + (got ? " got" : "") + (selected ? " sel" : "")} data-sr={c.id}>
      <button className="card-open" type="button" aria-label={label} onClick={() => onActivate(c)} />
      <div className="tile-img">
        <CardImage src={cardImageSrc(c)} name={c.name} />
        {got ? <span className="tile-badge have">{ownedBadge(ownedOf(c))}</span> : null}
        {!got && sp?.amt ? (
          <span className={"tile-badge" + (sp.deal ? " deal" : "")}>
            {sp.amt}
            {drop ? <span className="drop"> ↓{sharePct(drop.share)}</span> : null}
          </span>
        ) : null}
        {c.priority ? (
          <span className="tile-star" aria-hidden="true">
            <StarMark />
          </span>
        ) : null}
        {selecting ? <Check on={selected} /> : null}
        {onPhoto && !selecting ? <PhotoButton name={c.name} onPhoto={onPhoto} /> : null}
      </div>
      <div className="tile-name">{c.name}</div>
      <div className="tile-sub">
        {[c.lang === "JP" ? "JP" : "", c.set, c.number ? `#${c.number}` : ""].filter(Boolean).join(" · ")}
      </div>
      {/* Two printings of one card look alike in the grid; this tells them apart. */}
      {c.variant ? <div className="tile-sub tile-variant">{c.variant}</div> : null}
    </article>
  );
}

/** A card in the list layout. */
export function CardRow({ card: c, selecting, selected, canWrite, onActivate, onPhoto }: ItemProps) {
  const { save } = useCardWrites();
  const got = isGot(c);
  const sp = shortPrice(c);
  const drop = useShownDrop(c);
  const src = cardImageSrc(c);
  return (
    <article className={"row" + (got ? " got" : "") + (selected ? " sel" : "")} data-sr={c.id}>
      <button
        className="card-open"
        type="button"
        aria-pressed={selecting ? selected : undefined}
        aria-label={selecting ? (selected ? "Unselect " : "Select ") + c.name : cardLabel(c, drop)}
        onClick={() => onActivate(c)}
      />
      <div className={"thumb" + (src ? "" : " empty")}>
        {src ? <CardImage src={src} name={c.name} /> : "No photo"}
        {selecting ? <Check on={selected} /> : null}
        {onPhoto && !selecting ? <PhotoButton name={c.name} onPhoto={onPhoto} /> : null}
      </div>
      <div className="who">
        <div className="name">
          {c.name}
          {c.variant ? <span className="tag">{c.variant}</span> : null}
          {c.lang === "JP" ? <span className="tag">Japanese</span> : null}
        </div>
        <div className="meta">
          <span>{c.set || "Set unknown"}</span>
          {c.number ? <span className="num">#{c.number}</span> : null}
          <span>added {formatDate(c.addedAt)}</span>
        </div>
        {got || c.collections.length ? (
          <div className="flags">
            {got ? <span className="flag">{ownedBadge(ownedOf(c))}</span> : null}
            {c.collections.map((n) => (
              <button
                key={n}
                className="collchip"
                type="button"
                title={`Show ${n}`}
                onClick={() => showCollection(n)}
              >
                {n}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="rprice">
        {canWrite && !selecting ? (
          <button
            className="star"
            type="button"
            aria-pressed={c.priority}
            aria-label="Priority"
            title="Mark as priority"
            onClick={() => void save(c, { priority: !c.priority })}
          >
            <StarIcon />
          </button>
        ) : c.priority ? (
          <span className="prio-mark" aria-label="Priority">
            <StarMark />
          </span>
        ) : null}
        {sp?.amt ? <span className={"amt" + (sp.deal ? " deal" : "")}>{sp.amt}</span> : null}
        {drop ? (
          <small className="drop">↓ {sharePct(drop.share)} lately</small>
        ) : sp ? (
          <small>{sp.label}</small>
        ) : null}
      </div>
    </article>
  );
}

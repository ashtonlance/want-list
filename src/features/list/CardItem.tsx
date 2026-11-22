import type { KeyboardEvent, MouseEvent } from "react";
import { useCardWrites } from "~/features/cards/api";
import { cardImageSrc } from "~/features/cards/image";
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

/** A card in the grid layout. */
export function CardTile({ card: c, selecting, selected, onActivate, onPhoto }: ItemProps) {
  const got = isGot(c);
  const sp = shortPrice(c);
  const label =
    c.name +
    (c.set ? `, ${c.set}` : "") +
    (got ? ", got it" : sp?.amt ? `, ${sp.amt}` : "") +
    (selecting ? (selected ? ", selected" : ", not selected") : "");
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate(c);
    }
  };
  return (
    <article
      className={"tile" + (got ? " got" : "") + (selected ? " sel" : "")}
      role="button"
      tabIndex={0}
      aria-label={label}
      data-sr={c.id}
      onClick={() => onActivate(c)}
      onKeyDown={onKeyDown}
    >
      <div
        className="tile-img"
        onClick={
          onPhoto && !selecting
            ? (e) => {
                e.stopPropagation();
                onPhoto();
              }
            : undefined
        }
      >
        <CardImage src={cardImageSrc(c)} name={c.name} />
        {got ? <span className="tile-badge have">Got it</span> : null}
        {!got && sp?.amt ? <span className={"tile-badge" + (sp.deal ? " deal" : "")}>{sp.amt}</span> : null}
        {c.priority ? (
          <span className="tile-star" aria-hidden="true">
            <StarMark />
          </span>
        ) : null}
        {selecting ? <Check on={selected} /> : null}
      </div>
      <div className="tile-name">{c.name}</div>
      <div className="tile-sub">
        {[c.lang === "JP" ? "JP" : "", c.set, c.number ? `#${c.number}` : ""].filter(Boolean).join(" · ")}
      </div>
    </article>
  );
}

/** A card in the list layout. */
export function CardRow({ card: c, selecting, selected, canWrite, onActivate, onPhoto }: ItemProps) {
  const { save } = useCardWrites();
  const got = isGot(c);
  const sp = shortPrice(c);
  const src = cardImageSrc(c);
  const inner = src ? <CardImage src={src} name={c.name} /> : "No photo";
  const onClick = (e: MouseEvent) => {
    if ((e.target as Element).closest("button,a,input,label")) return;
    onActivate(c);
  };
  return (
    <article
      className={"row" + (got ? " got" : "") + (selected ? " sel" : "")}
      data-sr={c.id}
      onClick={onClick}
    >
      {selecting ? (
        <button
          className={"thumb pick" + (src ? "" : " empty")}
          type="button"
          aria-pressed={selected}
          aria-label={(selected ? "Unselect " : "Select ") + c.name}
          onClick={() => onActivate(c)}
        >
          {inner}
          <Check on={selected} />
        </button>
      ) : (
        <div
          className={"thumb" + (src ? "" : " empty")}
          onClick={
            onPhoto
              ? (e) => {
                  e.stopPropagation();
                  onPhoto();
                }
              : undefined
          }
        >
          {inner}
        </div>
      )}
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
        {got || c.checkRequested || c.collections.length ? (
          <div className="flags">
            {got ? <span className="flag">Got it</span> : null}
            {!got && c.checkRequested ? <span className="flag">Price check queued</span> : null}
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
        {sp ? <small>{sp.label}</small> : null}
      </div>
    </article>
  );
}

import { useState, type KeyboardEvent, type ReactNode } from "react";
import { formatMoney } from "~/lib/format";
import { CardImage } from "~/ui/CardImage";
import { CrossIcon, PlusIcon, TickIcon } from "~/ui/icons";
import { quickWantLabels } from "./display";

interface ExCardProps {
  /** The scroll-restoration anchor id. */
  sr: string;
  label: string;
  img: string | null | undefined;
  name: string;
  meta: string;
  /** The price, or "No price yet", and what follows it on the bottom line. */
  line: ReactNode;
  onOpen: () => void;
  /** Shows the card full screen when its picture is tapped; without it the picture opens the sheet too. */
  onPhoto?: (() => void) | undefined;
  className?: string;
  /** Drawn over the picture, like the JP badge. */
  badge?: string;
  /** The collection a pick is for, shown above its name. */
  coll?: string;
}

/** A card tile in Explore's grids. */
export function ExCard({
  sr,
  label,
  img,
  name,
  meta,
  line,
  onOpen,
  onPhoto,
  className,
  badge,
  coll,
}: ExCardProps) {
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onOpen();
    }
  };
  return (
    <article
      className={"ex-card" + (className ? " " + className : "")}
      role="button"
      tabIndex={0}
      aria-label={label}
      data-sr={sr}
      onClick={onOpen}
      onKeyDown={onKeyDown}
    >
      <div
        className="tile-img"
        onClick={
          onPhoto
            ? (e) => {
                e.stopPropagation();
                onPhoto();
              }
            : undefined
        }
      >
        <CardImage src={img} name={name} />
        {badge ? <span className="tile-badge">{badge}</span> : null}
      </div>
      {coll ? <div className="ex-coll">{coll}</div> : null}
      <div className="ex-name">{name}</div>
      <div className="ex-meta">{meta}</div>
      <div className="ex-line">{line}</div>
    </article>
  );
}

/** "✓ Have it" or "✓ On list" for a card already on the list. */
export const AddedMark = ({ have }: { have: boolean }) => (
  <span className="ex-added">{have ? "✓ Have it" : "✓ On list"}</span>
);

/** The + on a tile: adds the card as wanted, showing a tick straight away and going back if it fails. */
export function QuickWant({
  name,
  coll,
  onWant,
}: {
  name: string;
  coll: string;
  onWant: () => Promise<boolean>;
}) {
  const [done, setDone] = useState(false);
  const { label, title } = quickWantLabels(name, coll);
  return (
    <button
      className={"ex-quick" + (done ? " done" : "")}
      type="button"
      aria-label={label}
      title={title}
      disabled={done}
      onClick={(e) => {
        e.stopPropagation();
        setDone(true);
        void onWant().then((ok) => {
          if (!ok) setDone(false);
        });
      }}
    >
      {done ? <TickIcon /> : <PlusIcon />}
    </button>
  );
}

/** The × on a pick's tile: passes on it without opening it. */
export const PassButton = ({ name, onPass }: { name: string; onPass: () => void }) => (
  <button
    className="ex-quick ex-pass"
    type="button"
    aria-label={`Pass on ${name}`}
    title="Not for me"
    onClick={(e) => {
      e.stopPropagation();
      onPass();
    }}
  >
    <CrossIcon />
  </button>
);

/** A price on a tile, or "No price yet". */
export const PriceTag = ({ market, prefix = "" }: { market: number | null; prefix?: string }) =>
  market != null ? (
    <span className="ex-price">{prefix + formatMoney(market)}</span>
  ) : (
    <span className="ex-meta">No price yet</span>
  );

/** A failed load, with a way to try again. */
export const LoadError = ({ text, onRetry }: { text: string; onRetry: () => void }) => (
  <div className="empty-state">
    {text}{" "}
    <button className="btn small" type="button" onClick={onRetry}>
      Try again
    </button>
  </div>
);

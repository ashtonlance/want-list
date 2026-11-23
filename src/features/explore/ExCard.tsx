import { useState, type ReactNode } from "react";
import { Button } from "~/components/ui/button";
import { formatMoney } from "~/lib/format";
import { cn } from "~/lib/utils";
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

/**
 * A card tile in Explore's grids. The tile is a plain container: a button stretched over it opens the
 * card, and the picture's button (full screen) and any quick actions on the bottom line sit above it,
 * so no control is nested in another (styles/explore.css).
 */
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
  return (
    <article className={"ex-card" + (className ? " " + className : "")} data-sr={sr}>
      <button className="card-open" type="button" aria-label={label} onClick={onOpen} />
      <div className="tile-img">
        <CardImage src={img} name={name} />
        {badge ? <span className="tile-badge">{badge}</span> : null}
        {onPhoto ? (
          <button
            className="photo-open"
            type="button"
            aria-label={`Show ${name} full screen`}
            onClick={onPhoto}
          />
        ) : null}
      </div>
      {coll ? <div className="ex-coll">{coll}</div> : null}
      <div className="ex-name">{name}</div>
      <div className="ex-meta">{meta}</div>
      <div className="ex-line">{line}</div>
    </article>
  );
}

/** "✓ Got it" or "✓ On list" for a card already on the list. */
export const AddedMark = ({ have }: { have: boolean }) => (
  <span className="ex-added">{have ? "✓ Got it" : "✓ On list"}</span>
);

/** The round quick actions on a tile's bottom line: 32px, sunken, a 16px icon. */
const quick = "text-foreground [&_svg:not([class*='size-'])]:size-4";

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
    <Button
      size="icon-sm"
      // Solid ink once added; it stays that way rather than greying out while disabled.
      className={cn(quick, done && "bg-foreground text-background disabled:opacity-100")}
      aria-label={label}
      title={title}
      disabled={done}
      onClick={() => {
        setDone(true);
        void onWant().then((ok) => {
          if (!ok) setDone(false);
        });
      }}
    >
      {done ? <TickIcon /> : <PlusIcon />}
    </Button>
  );
}

/** The × on a pick's tile: passes on it without opening it. */
export const PassButton = ({ name, onPass }: { name: string; onPass: () => void }) => (
  <Button
    size="icon-sm"
    className={cn(quick, "text-muted-foreground")}
    aria-label={`Pass on ${name}`}
    title="Not for me"
    onClick={() => onPass()}
  >
    <CrossIcon />
  </Button>
);

/** A price on a tile, or "No price yet". */
export const PriceTag = ({ market, prefix = "" }: { market: number | null; prefix?: string }) =>
  market != null ? (
    <span className="ex-price">{prefix + formatMoney(market)}</span>
  ) : (
    <span className="ex-meta">No price yet</span>
  );

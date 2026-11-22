import { CardImage } from "./CardImage";

interface PickTileProps {
  src: string | null;
  name: string;
  sub: string;
  tag?: string;
  /** Dimmed with an "In binder" tag when the card is already placed. */
  already?: boolean;
  onPick: () => void;
}

/** A small tappable card used in pickers. */
export function PickTile({ src, name, sub, tag, already = false, onPick }: PickTileProps) {
  return (
    <button
      className={"pick" + (already ? " dim" : "")}
      type="button"
      onClick={onPick}
      aria-label={`${name}, ${sub}${already ? ", already in this binder" : ""}`}
    >
      <span className="pick-img">
        <CardImage src={src} name={name} />
      </span>
      <span className="pick-name">{name}</span>
      <span className="pick-sub">{sub}</span>
      {tag ? <span className="pick-tag">{already ? "In binder" : tag}</span> : null}
    </button>
  );
}

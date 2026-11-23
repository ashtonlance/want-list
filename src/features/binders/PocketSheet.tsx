import { Button } from "~/components/ui/button";
import { CardImage } from "~/ui/CardImage";
import { tcgProductUrl } from "~/features/cards/links";
import { formatMoney } from "~/lib/format";
import type { SlotInfo } from "./slots";
import type { WebSlot } from "./types";

interface PocketSheetProps {
  info: SlotInfo;
  /** Whether a card from the catalog can be added to the want list from here. */
  canAddToList: boolean;
  onMove: () => void;
  onReplace: () => void;
  onRemove: () => void;
  onAddToList: (s: WebSlot) => void;
}

/** The pocket's actions sit two to a row and may wrap onto a second line. */
const ACT = "min-h-12 text-center whitespace-normal";

function status(info: SlotInfo): string {
  if (info.got) return "In your collection";
  const price = info.price ? formatMoney(info.price) : "";
  if (info.web) return "Not on your list" + (price ? ` · ~${price} market` : "");
  return "On your want list" + (price ? ` · ${price}` : "");
}

/** What's in a filled pocket, and what can be done with it. */
export function PocketSheet({
  info,
  canAddToList,
  onMove,
  onReplace,
  onRemove,
  onAddToList,
}: PocketSheetProps) {
  const { web } = info;
  return (
    <>
      <div className="pocket-detail">
        {info.img ? (
          <span className="pd-img">
            <CardImage src={info.img} name={info.name} alt={info.name} />
          </span>
        ) : null}
        <div>
          <b>{info.name}</b>
          <div className="hint mt-0.5 mb-0">{info.sub}</div>
          <div className="pd-status">{status(info)}</div>
        </div>
      </div>
      <div className="sheet-acts">
        <Button variant="default" className={`col-span-full ${ACT}`} onClick={onMove}>
          Move or swap
        </Button>
        <Button className={ACT} onClick={onReplace}>
          Replace card
        </Button>
        <Button variant="destructive" className={ACT} onClick={onRemove}>
          Take out of pocket
        </Button>
        {web && canAddToList ? (
          <Button className={ACT} onClick={() => onAddToList(web)}>
            Add to my want list
          </Button>
        ) : null}
        {web ? (
          <Button asChild className={ACT}>
            <a href={tcgProductUrl(web.pid)} target="_blank" rel="noopener">
              See it on TCGplayer
            </a>
          </Button>
        ) : null}
      </div>
    </>
  );
}

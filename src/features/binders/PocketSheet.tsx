import { useState } from "react";
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
  const [imgFailed, setImgFailed] = useState(false);
  const { web } = info;
  return (
    <>
      <div className="pocket-detail">
        {info.img && !imgFailed ? (
          <img src={info.img} alt={info.name} onError={() => setImgFailed(true)} />
        ) : null}
        <div>
          <b>{info.name}</b>
          <div className="hint" style={{ margin: "2px 0 0" }}>
            {info.sub}
          </div>
          <div className="pd-status">{status(info)}</div>
        </div>
      </div>
      <div className="sheet-acts">
        <button className="btn primary" type="button" onClick={onMove}>
          Move or swap
        </button>
        <button className="btn" type="button" onClick={onReplace}>
          Replace card
        </button>
        <button className="btn danger" type="button" onClick={onRemove}>
          Take out of pocket
        </button>
        {web && canAddToList ? (
          <button className="btn" type="button" onClick={() => onAddToList(web)}>
            Add to my want list
          </button>
        ) : null}
        {web ? (
          <a className="btn" href={tcgProductUrl(web.pid)} target="_blank" rel="noopener">
            See it on TCGplayer
          </a>
        ) : null}
      </div>
    </>
  );
}

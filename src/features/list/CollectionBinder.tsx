import { useCallback, useMemo, type CSSProperties } from "react";
import { useOverlayNav } from "~/app/overlayNav";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import type { Pockets } from "~/app/prefs";
import { useCardWrites } from "~/features/cards/api";
import { collectionCards, moveInCollection } from "~/features/cards/collections";
import { cardImageSrc } from "~/features/cards/image";
import { lightboxItem } from "~/features/cards/lightboxItem";
import { isGot, priceOf } from "~/features/cards/pricing";
import type { Card } from "~/features/cards/types";
import { formatMoney } from "~/lib/format";
import { CardImage } from "~/ui/CardImage";
import { usePhotoGrid } from "~/ui/Lightbox";

/** A pocket's move arrows: small dark squares over the card art. A disabled one lets taps through to the card. */
const moveClass =
  "pointer-events-auto size-7 rounded-[7px] bg-black/66 text-[11px] leading-none font-normal disabled:pointer-events-none disabled:opacity-30";

interface Props {
  cards: readonly Card[];
  coll: string;
  pockets: Pockets;
  canWrite: boolean;
}

/** A collection laid out as binder spreads, in collection order. */
export function CollectionBinder({ cards, coll, pockets, canWrite }: Props) {
  const ordered = useMemo(() => collectionCards(cards, coll), [cards, coll]);
  const { saveMany } = useCardWrites();
  const { open } = useOverlayNav();
  const toPhoto = useCallback(
    (c: Card) => {
      const src = cardImageSrc(c);
      return src ? { ...lightboxItem(c, src), onDetails: () => open({ card: c.id }) } : null;
    },
    [open],
  );
  const photoOf = usePhotoGrid(ordered, toPhoto);
  const cols = pockets === 4 ? 2 : 3;
  const filled = Math.ceil(ordered.length / pockets);
  const pages = Math.max(2, filled + (filled % 2));
  const move = (i: number, dir: -1 | 1) => void saveMany(moveInCollection(ordered, coll, i, dir));

  const pocket = (i: number) => {
    const c = ordered[i];
    if (!c) return <div key={i} className="pocket" aria-label="Empty pocket" />;
    const need = !isGot(c);
    const src = cardImageSrc(c);
    const price = priceOf(c);
    return (
      <div key={i} className="pocket-wrap" data-sr={c.id}>
        <button
          className={"pocket" + (need ? " need" : "")}
          type="button"
          aria-label={c.name + (need ? ", still needed" : ", collected")}
          title={[c.name, c.set, c.number ? `#${c.number}` : ""].filter(Boolean).join(" · ")}
          onClick={() => {
            const show = photoOf(c);
            if (show) show();
            else open({ card: c.id }, c.id);
          }}
        >
          <CardImage src={src} name={c.name} />
          {need ? <span className="lbl need">{price != null ? formatMoney(price) : "Need"}</span> : null}
        </button>
        {canWrite ? (
          <div className="mv">
            <Button
              variant="glass"
              size="icon"
              className={moveClass}
              aria-label={`Move ${c.name} earlier`}
              disabled={i === 0}
              onClick={() => move(i, -1)}
            >
              <ChevronLeftIcon className="size-3.5" />
            </Button>
            <Button
              variant="glass"
              size="icon"
              className={moveClass}
              aria-label={`Move ${c.name} later`}
              disabled={i === ordered.length - 1}
              onClick={() => move(i, 1)}
            >
              <ChevronRightIcon className="size-3.5" />
            </Button>
          </div>
        ) : null}
      </div>
    );
  };

  const spreads = Array.from({ length: pages / 2 }, (_, s) => s * 2);
  return (
    <div className="binder">
      {canWrite && ordered.length > 1 ? (
        <p className="hint" style={{ margin: 0 }}>
          Use the arrows on a pocket to move a card earlier or later in the binder.
        </p>
      ) : null}
      {spreads.map((s) => (
        <div
          key={s}
          className="spread"
          role="group"
          aria-label={`Pages ${s + 1} and ${s + 2}`}
          style={{ "--cols": cols, "--rows": pockets / cols } as CSSProperties}
        >
          {[s, s + 1].map((p) => (
            <div key={p} className="page">
              <div className="page-label">Page {p + 1}</div>
              <div className="pockets">
                {Array.from({ length: pockets }, (_, k) => pocket(p * pockets + k))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

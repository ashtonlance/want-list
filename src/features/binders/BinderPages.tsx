import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import { useRef, type CSSProperties } from "react";
import { Button } from "~/components/ui/button";
import { CardImage } from "~/ui/CardImage";
import { pageCount, type SlotInfo } from "./slots";
import type { Binder } from "./types";

interface BinderPagesProps {
  binder: Binder;
  /** One SlotInfo (or null for an empty pocket) per slot. */
  infos: readonly (SlotInfo | null)[];
  /** The first page shown, already a multiple of `per`. */
  page: number;
  per: 1 | 2;
  moving: number | null;
  onPage: (page: number) => void;
  onPocket: (i: number) => void;
}

const COLS: Record<Binder["pockets"], number> = { 4: 2, 9: 3, 12: 4 };

/** The page turner and the open spread: one page on a phone, two side by side on a wider screen. */
export function BinderPages({ binder, infos, page, per, moving, onPage, onPocket }: BinderPagesProps) {
  const pages = pageCount(binder);
  const swipeX = useRef<number | null>(null);
  const canNext = page + per < pages;
  const prev = () => onPage(Math.max(0, page - per));
  const next = () => onPage(page + per);

  const shown = Array.from({ length: Math.min(pages, page + per) - page }, (_, k) => page + k);
  const label =
    per === 1
      ? `Page ${page + 1} of ${pages}`
      : `Pages ${page + 1}${page + 1 < pages ? `–${page + 2}` : ""} of ${pages}`;

  return (
    <>
      <div className="bnav">
        <Button size="sm" disabled={page === 0} onClick={prev}>
          <ChevronLeftIcon />
          Prev
        </Button>
        <span>{label}</span>
        <Button size="sm" disabled={!canNext} onClick={next}>
          Next
          <ChevronRightIcon />
        </Button>
      </div>
      <div
        className={"spread bspread" + (per === 1 ? " one" : "")}
        onTouchStart={(e) => {
          swipeX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const x0 = swipeX.current;
          swipeX.current = null;
          const x1 = e.changedTouches[0]?.clientX;
          if (x0 === null || x1 === undefined || Math.abs(x1 - x0) <= 60) return;
          if (x1 < x0 && canNext) next();
          else if (x1 > x0 && page > 0) prev();
        }}
      >
        {shown.map((p) => (
          <div className="page" key={p}>
            <div className="page-label">Page {p + 1}</div>
            <div className="pockets" style={{ "--cols": COLS[binder.pockets] } as CSSProperties}>
              {Array.from({ length: binder.pockets }, (_, k) => {
                const i = p * binder.pockets + k;
                return (
                  <Pocket
                    key={i}
                    index={i}
                    pockets={binder.pockets}
                    info={infos[i] ?? null}
                    moving={moving}
                    onClick={() => onPocket(i)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

interface PocketProps {
  index: number;
  pockets: number;
  info: SlotInfo | null;
  moving: number | null;
  onClick: () => void;
}

function Pocket({ index, pockets, info, moving, onClick }: PocketProps) {
  const cls =
    "pocket bpocket" +
    (info ? (info.got ? " own" : " wanted") : " empty") +
    (info?.web ? " web" : "") +
    (moving === index ? " moving" : moving !== null ? " target" : "");
  const label = info
    ? info.name + (info.got ? ", owned" : info.web ? ", not on your list" : ", wanted")
    : `Empty pocket ${(index % pockets) + 1}, add a card`;
  return (
    <button className={cls} type="button" aria-label={label} data-sr={`pocket-${index}`} onClick={onClick}>
      {info ? (
        <>
          <CardImage src={info.img} name={info.name} />
          {info.got ? (
            <span className="own-mark" aria-hidden="true">
              <CheckIcon className="size-3.5" strokeWidth={3} />
            </span>
          ) : null}
        </>
      ) : (
        <PlusIcon className="plus size-6" aria-hidden="true" />
      )}
    </button>
  );
}

import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
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
  /** Given, cards drag between pockets: moves the card in pocket `from` to `to`, swapping with any there. */
  onMove?: (from: number, to: number) => void;
}

const COLS: Record<Binder["pockets"], number> = { 4: 2, 9: 3, 12: 4 };

/** How long a dragged card hovers over Prev or Next before the page turns. */
const TURN_MS = 600;

/**
 * The page turner and the open spread: one page on a phone, two side by side on a wider screen. Given
 * `onMove`, cards drag from pocket to pocket too, and holding one over Prev or Next turns the page.
 */
export function BinderPages({
  binder,
  infos,
  page,
  per,
  moving,
  onPage,
  onPocket,
  onMove,
}: BinderPagesProps) {
  const pages = pageCount(binder);
  const swipeX = useRef<number | null>(null);
  const canNext = page + per < pages;
  const prev = () => onPage(Math.max(0, page - per));
  const next = () => onPage(page + per);
  const drag = useDrag(onMove);
  const canDrag = onMove !== undefined && moving === null;

  const shown = Array.from({ length: Math.min(pages, page + per) - page }, (_, k) => page + k);
  const label =
    per === 1
      ? `Page ${page + 1} of ${pages}`
      : `Pages ${page + 1}${page + 1 < pages ? `–${page + 2}` : ""} of ${pages}`;

  return (
    <>
      <div className="bnav">
        <Button size="sm" disabled={page === 0} onClick={prev} {...drag.turner(page > 0 ? prev : null)}>
          <ChevronLeftIcon />
          Prev
        </Button>
        <span>{label}</span>
        <Button size="sm" disabled={!canNext} onClick={next} {...drag.turner(canNext ? next : null)}>
          Next
          <ChevronRightIcon />
        </Button>
      </div>
      <div
        className={"spread bspread" + (per === 1 ? " one" : "")}
        style={
          { "--cols": COLS[binder.pockets], "--rows": binder.pockets / COLS[binder.pockets] } as CSSProperties
        }
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
            <div className="pockets">
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
                    drag={canDrag ? drag.pocket(i, infos[i] != null) : undefined}
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

/** The drag pointer came in from, or went out to, outside this element, not one of its children. */
const crossed = (e: DragEvent) =>
  !(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget));

/** What makes a pocket a drag source (when it holds a card) and a drop target. */
type PocketDrag = ReturnType<ReturnType<typeof useDrag>["pocket"]>;

/**
 * Dragging cards between pockets with the mouse. The pocket being dragged and the one under it are
 * marked while it lasts; dropping on another pocket moves the card there, swapping with what's in it.
 */
function useDrag(onMove: ((from: number, to: number) => void) | undefined) {
  const [from, setFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const turn = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stopTurn = () => clearTimeout(turn.current);
  const end = useCallback(() => {
    clearTimeout(turn.current);
    setFrom(null);
    setOver(null);
  }, []);
  useEffect(() => end, [end]);
  // A page turn mid-drag unmounts the pocket the drag started from, and then the browser sends it no
  // dragend. So any drop, or the mouse moving with no button held once the drag is over, ends it too. A
  // drop that nothing took is cancelled, so the browser doesn't open the card's picture instead.
  const dragging = from !== null;
  useEffect(() => {
    if (!dragging) return;
    const onDrop = (e: globalThis.DragEvent) => {
      e.preventDefault();
      end();
    };
    const onMove = (e: MouseEvent) => {
      if (e.buttons === 0) end();
    };
    window.addEventListener("drop", onDrop);
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("mousemove", onMove);
    };
  }, [dragging, end]);
  /** Lets a drop happen here, while a card from this binder is being dragged. */
  const accept = (e: DragEvent) => {
    if (from === null) return false;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    return true;
  };

  return {
    pocket: (i: number, full: boolean) => ({
      dragging: from === i,
      over: over === i && from !== i,
      draggable: full,
      onDragStart: (e: DragEvent) => {
        e.dataTransfer.effectAllowed = "move";
        // Some browsers start no drag without data. A type of its own keeps it out of text fields.
        e.dataTransfer.setData("application/x-binder-pocket", String(i));
        // After the browser has taken its picture of the card, so the one in hand isn't faded too.
        requestAnimationFrame(() => setFrom(i));
      },
      onDragEnd: end,
      onDragOver: (e: DragEvent) => {
        if (accept(e) && over !== i) setOver(i);
      },
      onDragLeave: (e: DragEvent) => {
        if (crossed(e)) setOver((o) => (o === i ? null : o));
      },
      onDrop: (e: DragEvent) => {
        if (from === null) return;
        e.preventDefault();
        if (from !== i) onMove?.(from, i);
        end();
      },
    }),
    /** Prev or Next: a card held over it turns the page, so it can go to a page not shown. */
    turner: (go: (() => void) | null) =>
      from === null || !go
        ? {}
        : {
            onDragEnter: (e: DragEvent) => {
              if (!crossed(e)) return;
              stopTurn();
              turn.current = setTimeout(go, TURN_MS);
            },
            onDragOver: (e: DragEvent) => e.preventDefault(),
            onDragLeave: (e: DragEvent) => {
              if (crossed(e)) stopTurn();
            },
            onDrop: (e: DragEvent) => {
              e.preventDefault();
              stopTurn();
            },
          },
  };
}

interface PocketProps {
  index: number;
  pockets: number;
  info: SlotInfo | null;
  moving: number | null;
  onClick: () => void;
  drag: PocketDrag | undefined;
}

function Pocket({ index, pockets, info, moving, onClick, drag }: PocketProps) {
  const { dragging, over, ...dnd } = drag ?? {};
  const cls =
    "pocket bpocket" +
    (info ? (info.got ? " own" : " wanted") : " empty") +
    (info?.web ? " web" : "") +
    (moving === index ? " moving" : moving !== null ? " target" : "") +
    (dragging ? " dragging" : "") +
    (over ? " drop" : "");
  const label = info
    ? info.name + (info.got ? ", owned" : info.web ? ", not on your list" : ", wanted")
    : `Empty pocket ${(index % pockets) + 1}, add a card`;
  return (
    <button
      className={cls}
      type="button"
      aria-label={label}
      data-sr={`pocket-${index}`}
      onClick={onClick}
      {...dnd}
    >
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

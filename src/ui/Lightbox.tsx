import { useLocation } from "@tanstack/react-router";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type Ref,
} from "react";
import { bigImage } from "~/lib/images";
import { findPicture, isTransitioning, morph, sheetPicture } from "~/lib/motion";
import { useProgressiveSrc } from "./useProgressiveSrc";
import { useOverlay } from "./overlay";

export interface LightboxItem {
  src: string;
  name: string;
  /** The line under the name: set, number, price. */
  caption: string;
  /** Opens the card's sheet, from the Details button under the photo. */
  onDetails?: () => void;
}

interface LightboxApi {
  open: (item: LightboxItem) => void;
  /** The cards on screen right now, in order, so the photo can swipe to the next one. */
  sequenceRef: { current: readonly LightboxItem[] };
}

const LightboxContext = createContext<LightboxApi | null>(null);

/** How far a swipe has to travel, in pixels, to move to the next photo. */
const SWIPE = 50;

const sameCard = (a: LightboxItem, b: LightboxItem) => bigImage(a.src) === bigImage(b.src);

interface Opened {
  items: readonly LightboxItem[];
  index: number;
  href: string;
  /** Plays its own fade in; off when the picture flew in from its tile instead. */
  enter: boolean;
  /** The way the last swipe went, so the next card comes in from that side. */
  dir?: "next" | "prev";
}

/**
 * Full-screen card photo. Swipe or use the arrow keys to move through the cards on screen.
 * Closes on Escape, a tap outside the photo, or any navigation. Opening and closing fly the picture
 * from and back to its tile where it's on screen (lib/motion.ts).
 */
export function LightboxProvider({ children }: { children: ReactNode }) {
  const [opened, setOpened] = useState<Opened | null>(null);
  const [dragX, setDragX] = useState(0);
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  const sequenceRef = useRef<readonly LightboxItem[]>([]);
  const lastFocus = useRef<Element | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const photo = useRef<HTMLImageElement>(null);
  const href = useLocation({ select: (l) => l.href });
  // Navigating anywhere closes the photo.
  const shown = opened?.href === href ? opened : null;
  const item = shown ? shown.items[shown.index] : undefined;
  const count = shown?.items.length ?? 0;

  const close = () => {
    // Back to its tile if that's on screen; otherwise the photo just fades away.
    const tile = item ? findPicture(item.src, null, box.current) : null;
    morph({
      from: photo.current,
      update: () => setOpened(null),
      to: () => tile,
      wait: 0,
    });
    if (lastFocus.current instanceof HTMLElement) lastFocus.current.focus({ preventScroll: true });
  };
  const step = useCallback((dir: -1 | 1) => {
    setDragX(0);
    setOpened((o) => {
      if (!o) return o;
      const index = o.index + dir;
      return index >= 0 && index < o.items.length ? { ...o, index, dir: dir > 0 ? "next" : "prev" } : o;
    });
  }, []);
  useOverlay(item !== undefined, close);

  useEffect(() => {
    if (item) closeBtn.current?.focus();
  }, [item]);

  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    // Load the neighbours ahead of time so a swipe shows them at once.
    for (const n of [shown.items[shown.index - 1], shown.items[shown.index + 1]])
      if (n) new Image().src = bigImage(n.src);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, step]);

  const open = useCallback(
    (next: LightboxItem) => {
      lastFocus.current = document.activeElement;
      const items = sequenceRef.current;
      const index = items.findIndex((i) => sameCard(i, next));
      setDragX(0);
      morph({
        from: findPicture(next.src),
        update: () => {
          // Inside a transition the picture flies in, so the photo view skips its own fade.
          const enter = !isTransitioning();
          setOpened(index >= 0 ? { items, index, href, enter } : { items: [next], index: 0, href, enter });
        },
        to: () => photo.current,
      });
    },
    [href],
  );

  const onPointerDown = (e: PointerEvent) => {
    if (count > 1) drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (d?.id === e.pointerId) setDragX(e.clientX - d.x);
  };
  const onPointerUp = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (d?.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(e.clientY - d.y)) step(dx < 0 ? 1 : -1);
    else setDragX(0);
  };

  return (
    <LightboxContext value={{ open, sequenceRef }}>
      {children}
      {item && shown ? (
        <div
          ref={box}
          className={"lightbox" + (shown.enter ? "" : " no-enter")}
          role="dialog"
          aria-modal="true"
          aria-label="Card photo"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            drag.current = null;
            setDragX(0);
          }}
        >
          <button className="close" type="button" aria-label="Close" ref={closeBtn} onClick={close}>
            ×
          </button>
          <Photo
            key={item.src}
            ref={photo}
            item={item}
            className={shown.dir ? `from-${shown.dir}` : undefined}
            dragX={dragX}
          />
          <div className="cap">
            <b>{item.name}</b>
            {item.caption}
          </div>
          {item.onDetails ? (
            <button
              className="btn lb-details"
              type="button"
              onClick={() => {
                const details = item.onDetails;
                // The picture flies into the card's sheet as it opens.
                morph({
                  from: photo.current,
                  update: () => {
                    setOpened(null);
                    details?.();
                  },
                  to: sheetPicture,
                });
              }}
            >
              Details
            </button>
          ) : null}
          {count > 1 ? (
            <div className="lb-nav">
              <button
                type="button"
                aria-label="Previous card"
                disabled={shown.index === 0}
                onClick={() => step(-1)}
              >
                ‹
              </button>
              <span aria-live="polite">
                {shown.index + 1} of {count}
              </span>
              <button
                type="button"
                aria-label="Next card"
                disabled={shown.index === count - 1}
                onClick={() => step(1)}
              >
                ›
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </LightboxContext>
  );
}

interface PhotoProps {
  item: LightboxItem;
  ref: Ref<HTMLImageElement>;
  className: string | undefined;
  dragX: number;
}

/** The big picture: the grid's small image at once, so it can fly in, then the large one. */
function Photo({ item, ref, className, dragX }: PhotoProps) {
  const src = useProgressiveSrc(item.src);
  return (
    <img
      ref={ref}
      src={src}
      alt={`${item.name} card`}
      draggable={false}
      className={className}
      style={dragX ? { transform: `translateX(${String(dragX)}px)` } : undefined}
    />
  );
}

function useLightboxApi(): LightboxApi {
  const api = use(LightboxContext);
  if (!api) throw new Error("useLightbox needs a LightboxProvider");
  return api;
}

export function useLightbox(): (item: LightboxItem) => void {
  return useLightboxApi().open;
}

/**
 * Tells the photo view which cards are on screen, in order, so it can swipe between them.
 * The list on screen calls this; whatever opens the photo from it then gets swiping for free.
 */
export function useLightboxSequence(items: readonly LightboxItem[]): void {
  const { sequenceRef } = useLightboxApi();
  useEffect(() => {
    sequenceRef.current = items;
    return () => {
      if (sequenceRef.current === items) sequenceRef.current = [];
    };
  }, [sequenceRef, items]);
}

/**
 * For a grid of cards: makes the cards on screen the photo sequence and returns, for each row, what
 * tapping its picture does (undefined when it has no picture). `toItem` must be stable.
 */
export function usePhotoGrid<T>(
  rows: readonly T[],
  toItem: (row: T) => LightboxItem | null,
): (row: T) => (() => void) | undefined {
  const open = useLightbox();
  const byRow = useMemo(() => {
    const m = new Map<T, LightboxItem>();
    for (const r of rows) {
      const it = toItem(r);
      if (it) m.set(r, it);
    }
    return m;
  }, [rows, toItem]);
  const items = useMemo(() => [...byRow.values()], [byRow]);
  useLightboxSequence(items);
  return useCallback(
    (row: T) => {
      const it = byRow.get(row);
      return it ? () => open(it) : undefined;
    },
    [byRow, open],
  );
}

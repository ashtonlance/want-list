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
  type SyntheticEvent,
} from "react";
import { bigImage } from "~/lib/images";
import {
  canTransition,
  EASE_IN,
  findPicture,
  isTransitioning,
  morph,
  prefersReducedMotion,
  sheetPicture,
} from "~/lib/motion";
import { usePhotoZoom } from "./usePhotoZoom";
import { markReady, onArrive } from "./fadeIn";
import { useOverlay } from "./overlay";

export interface LightboxItem {
  /** Tells apart two cards that share a picture, like two printings. */
  id?: string;
  src: string;
  name: string;
  /** The line under the name: set, number, price. */
  caption: string;
  /** Where the card stands with the list, like "Got it", shown as a tag under the caption. */
  mark?: string;
  /** Opens the card's sheet, from the Details button under the photo. */
  onDetails?: () => void;
  /** One quick action beside Details, like marking the card as got. */
  action?: LightboxAction;
}

export interface LightboxAction {
  /** Names what it acts on (a card's id), since two printings can share a picture. */
  key: string;
  label: string;
  /** What the button reads once the action has worked. */
  doneLabel: string;
  /** Resolves true when it worked. */
  run: () => Promise<boolean>;
}

interface LightboxApi {
  open: (item: LightboxItem) => void;
  /** The cards on screen right now, in order, so the photo can swipe to the next one. */
  sequenceRef: { current: readonly LightboxItem[] };
}

const LightboxContext = createContext<LightboxApi | null>(null);

/** How far a swipe has to travel, in pixels, to move to the next photo. */
const SWIPE = 50;
/** How far a finger moves before the drag picks a direction: sideways to step, down to close. */
const SLOP = 8;
/** Pulled down this far, or flicked down this fast (px per ms), the photo closes on release. */
const DISMISS = 110;
const FLICK = 0.6;

interface Drag {
  id: number;
  x0: number;
  y0: number;
  axis: "x" | "y" | null;
  /** The last vertical position and time, for the speed of a flick. */
  y: number;
  t: number;
  vy: number;
}

const sameCard = (a: LightboxItem, b: LightboxItem) =>
  a.id && b.id ? a.id === b.id : bigImage(a.src) === bigImage(b.src);

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
 * Full-screen card photo. Swipe sideways or use the arrow keys to move through the cards on screen;
 * pull down to close, and pinch or double-tap to zoom, as in Photos (usePhotoZoom.ts). Also closes on
 * Escape, a tap outside the photo, or any navigation. Opening and closing fly the picture from and
 * back to its tile where it's on screen (lib/motion.ts).
 */
export function LightboxProvider({ children }: { children: ReactNode }) {
  const [opened, setOpened] = useState<Opened | null>(null);
  // Actions that already ran in this viewing, or are running, by key, so stepping back shows them.
  const [done, setDone] = useState<ReadonlySet<string>>(() => new Set());
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());
  const drag = useRef<Drag | null>(null);
  // A drag ends with a click on the backdrop; this keeps that click from closing the photo.
  const dragged = useRef(false);
  const sequenceRef = useRef<readonly LightboxItem[]>([]);
  const lastFocus = useRef<Element | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const photo = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLDivElement>(null);
  const href = useLocation({ select: (l) => l.href });
  // Navigating anywhere closes the photo.
  const shown = opened?.href === href ? opened : null;
  const item = shown ? shown.items[shown.index] : undefined;
  const count = shown?.items.length ?? 0;
  const zoom = usePhotoZoom(box, photo, shown ? shown.index : null);

  const close = () => {
    // Back to its tile if that's on screen; otherwise the photo just fades away.
    const tile = item ? findPicture(item.src, null, box.current) : null;
    morph({
      from: photo.current,
      update: () => setOpened(null),
      to: () => tile,
      wait: 0,
    });
  };
  const step = useCallback((dir: -1 | 1) => {
    setOpened((o) => {
      if (!o) return o;
      const index = o.index + dir;
      return index >= 0 && index < o.items.length ? { ...o, index, dir: dir > 0 ? "next" : "prev" } : o;
    });
  }, []);
  // Holds focus while open, like a sheet, and gives it back to whatever opened the photo.
  useOverlay(item !== undefined, close, { el: box, returnTo: () => lastFocus.current });

  useEffect(() => {
    if (item) closeBtn.current?.focus();
  }, [item]);

  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      // Zoomed in, the photo stays put; Escape still closes it.
      if (zoom.zoomed()) return;
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    // Load the neighbours ahead of time so a swipe shows them at once.
    for (const n of [shown.items[shown.index - 1], shown.items[shown.index + 1]])
      if (n) new Image().src = bigImage(n.src);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, step, zoom]);

  const open = useCallback(
    (next: LightboxItem) => {
      lastFocus.current = document.activeElement;
      setDone(new Set());
      const items = sequenceRef.current;
      const index = items.findIndex((i) => sameCard(i, next));
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

  /** Follows the finger: sideways moves the photo, down also shrinks it and lifts the dark backdrop. */
  const follow = (dx: number, dy: number) => {
    const img = photo.current;
    if (!img) return;
    if (drag.current?.axis === "x") {
      img.style.transform = `translateX(${String(dx)}px)`;
      return;
    }
    // Upward pulls give a little, then resist.
    const y = dy > 0 ? dy : dy * 0.25;
    const pulled = Math.min(Math.max(y, 0) / innerHeight, 1);
    img.style.transform = `translate(${String(dx * 0.5)}px, ${String(y)}px) scale(${String(1 - pulled * 0.3)})`;
    if (back.current)
      back.current.style.opacity = String(1 - Math.min(Math.max(y, 0) / (innerHeight * 0.45), 1));
  };
  const settle = () => {
    box.current?.classList.remove("dragging", "dragging-y");
    if (photo.current) photo.current.style.transform = "";
    if (back.current) back.current.style.opacity = "";
  };

  /** Closes after a pull down: flies back to the tile where it can, else slides away. */
  const dismiss = () => {
    box.current?.classList.remove("dragging", "dragging-y");
    const img = photo.current;
    if (img && !canTransition() && !prefersReducedMotion() && typeof img.animate === "function") {
      const away = { duration: 200, easing: EASE_IN, fill: "forwards" as const };
      back.current?.animate([{ opacity: back.current.style.opacity || "1" }, { opacity: 0 }], away);
      img
        .animate(
          [
            { transform: img.style.transform || "none" },
            { transform: `translateY(${String(innerHeight * 0.6)}px) scale(0.8)`, opacity: 0 },
          ],
          away,
        )
        .finished.then(close, close);
      return;
    }
    close();
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || (e.target as Element).closest("button")) return;
    dragged.current = false;
    // A second finger pinches, and any finger on a zoomed photo pans it.
    if (zoom.down(e)) {
      if (drag.current) {
        drag.current = null;
        settle();
      }
      return;
    }
    const now = performance.now();
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, axis: null, y: e.clientY, t: now, vy: 0 };
  };
  const onPointerMove = (e: PointerEvent) => {
    if (zoom.move(e)) {
      dragged.current = true;
      return;
    }
    const d = drag.current;
    if (d?.id !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.axis) {
      if (Math.hypot(dx, dy) < SLOP) return;
      // Sideways steps only when there's another card; otherwise any drag pulls the photo.
      d.axis = Math.abs(dx) > Math.abs(dy) && count > 1 ? "x" : "y";
      dragged.current = true;
      box.current?.classList.add("dragging", ...(d.axis === "y" ? ["dragging-y"] : []));
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const now = performance.now();
    const dt = now - d.t;
    if (dt > 0) d.vy = d.vy * 0.4 + ((e.clientY - d.y) / dt) * 0.6;
    d.y = e.clientY;
    d.t = now;
    follow(dx, dy);
  };
  const onPointerUp = (e: PointerEvent) => {
    if (zoom.up(e)) return;
    const d = drag.current;
    if (d?.id !== e.pointerId) return;
    drag.current = null;
    if (!d.axis) {
      zoom.tap(e);
      return;
    }
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    // A finger held still before lifting isn't a flick.
    const vy = performance.now() - d.t > 80 ? 0 : d.vy;
    if (d.axis === "y" && (dy > DISMISS || (vy > FLICK && dy > 24))) {
      dismiss();
      return;
    }
    settle();
    if (d.axis === "x" && Math.abs(dx) > SWIPE) step(dx < 0 ? 1 : -1);
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
            if (dragged.current) {
              dragged.current = false;
              return;
            }
            if (e.target !== e.currentTarget && e.target !== back.current) return;
            // Outside a zoomed photo, a tap zooms back out first.
            if (zoom.zoomed()) zoom.reset();
            else close();
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={(e) => {
            if (zoom.cancel(e)) return;
            drag.current = null;
            settle();
          }}
        >
          <div className="lb-back" ref={back} aria-hidden="true" />
          <button className="close" type="button" aria-label="Close" ref={closeBtn} onClick={close}>
            ×
          </button>
          <Photo
            key={item.src}
            ref={photo}
            item={item}
            className={shown.dir ? `from-${shown.dir}` : undefined}
          />
          <div className="cap">
            <b>{item.name}</b>
            {item.caption}
            {item.mark ? <span className="lb-mark">✓ {item.mark}</span> : null}
          </div>
          {item.onDetails || item.action ? (
            <div className="lb-acts">
              {item.action ? (
                <ActionButton
                  action={item.action}
                  done={done.has(item.action.key)}
                  busy={busy.has(item.action.key)}
                  onRun={async ({ key, run }) => {
                    setBusy((b) => new Set(b).add(key));
                    // A run that throws counts as one that didn't work.
                    const ok = await run()
                      .catch((e: unknown) => {
                        console.error(e);
                        return false;
                      })
                      .finally(() => setBusy((b) => new Set([...b].filter((k) => k !== key))));
                    if (ok) setDone((d) => new Set(d).add(key));
                  }}
                />
              ) : null}
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
            </div>
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

interface ActionButtonProps {
  action: LightboxAction;
  done: boolean;
  busy: boolean;
  onRun: (action: LightboxAction) => Promise<void>;
}

function ActionButton({ action, done, busy, onRun }: ActionButtonProps) {
  return (
    <button
      className={"btn lb-action" + (done ? " done" : "")}
      type="button"
      disabled={done || busy}
      onClick={() => void onRun(action)}
    >
      {done ? action.doneLabel : action.label}
    </button>
  );
}

interface PhotoProps {
  item: LightboxItem;
  ref: Ref<HTMLDivElement>;
  className: string | undefined;
}

/** The frame takes the picture's own shape once it arrives, so a photo that isn't card-shaped shows whole. */
const takeShape = (img: HTMLImageElement) => {
  const frame = img.parentElement;
  if (frame && img.naturalWidth > 0)
    frame.style.aspectRatio = `${String(img.naturalWidth)} / ${String(img.naturalHeight)}`;
};
const readyRef = (img: HTMLImageElement | null) => {
  markReady(img);
  if (img?.classList.contains("ready")) takeShape(img);
};
const onShown = (e: SyntheticEvent<HTMLImageElement>) => {
  onArrive(e);
  takeShape(e.currentTarget);
};

/**
 * The big picture, in a card-shaped frame that holds its place and shimmers until a picture arrives:
 * the grid's small image first (usually cached, so it can fly in), then the large one fading in over
 * it. The frame is what moves, zooms and flies. Give it `key={item.src}` so a new card starts fresh.
 */
function Photo({ item, ref, className }: PhotoProps) {
  const big = bigImage(item.src);
  const [smallFailed, setSmallFailed] = useState(false);
  const [bigFailed, setBigFailed] = useState(false);
  const pic = (src: string, onError: () => void) => (
    <img
      src={src}
      alt=""
      decoding="async"
      draggable={false}
      className="fade-img"
      ref={readyRef}
      onLoad={onShown}
      onError={onError}
    />
  );
  return (
    <div
      ref={ref}
      role="img"
      aria-label={`${item.name} card`}
      className={"lb-photo" + (className ? " " + className : "")}
    >
      {smallFailed ? null : pic(item.src, () => setSmallFailed(true))}
      {big !== item.src && !bigFailed ? pic(big, () => setBigFailed(true)) : null}
      {smallFailed && (bigFailed || big === item.src) ? <span className="noimg">{item.name}</span> : null}
    </div>
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

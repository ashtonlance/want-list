import {
  createContext,
  use,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent,
} from "react";
import { isTransitioning } from "~/lib/motion";
import { useOverlay } from "./overlay";

const SheetClose = createContext<() => void>(() => undefined);

interface SheetProps {
  label: string;
  onClose: () => void;
  children: ReactNode;
  /** Changing this scrolls the sheet back to the top, for a sheet that shows something else. */
  contentKey?: string;
}

/**
 * A bottom sheet: tap the backdrop, press Escape or drag the grip down to close. It slides up as it
 * opens and down as it closes (app/pageTransition.ts), or appears with a card's picture flying in.
 */
export function Sheet({ label, onClose, children, contentKey }: SheetProps) {
  useOverlay(true, onClose);
  // Opened inside a transition: that already animates it, so skip the slide-up. Fixed at mount.
  const [noEnter] = useState(isTransitioning);
  const card = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y0: number; dy: number } | null>(null);
  useLayoutEffect(() => {
    card.current?.scrollTo({ top: 0 });
  }, [contentKey]);

  const onTouchStart = (e: TouchEvent) => {
    const t = e.target as Element;
    if (!t.closest(".sheet-grip,.sheet-head") || t.closest("button,input,select,a")) return;
    drag.current = { y0: e.touches[0]?.clientY ?? 0, dy: 0 };
    if (card.current) card.current.style.transition = "none";
  };
  const onTouchMove = (e: TouchEvent) => {
    const d = drag.current;
    if (!d || !card.current) return;
    d.dy = Math.max(0, (e.touches[0]?.clientY ?? 0) - d.y0);
    card.current.style.transform = `translateY(${d.dy}px)`;
  };
  const onTouchEnd = () => {
    const d = drag.current;
    drag.current = null;
    const el = card.current;
    if (!d || !el) return;
    el.style.transition = "transform .24s cubic-bezier(0.2, 0.8, 0.2, 1)";
    if (d.dy > 110) onClose();
    else el.style.transform = "";
  };

  return (
    <SheetClose value={onClose}>
      <div
        className={"sheet" + (noEnter ? " no-enter" : "")}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="sheet-card"
          role="dialog"
          aria-modal="true"
          aria-label={label}
          ref={card}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="sheet-grip" aria-hidden="true" />
          {children}
        </div>
      </div>
    </SheetClose>
  );
}

export function SheetHead({ title }: { title: string }) {
  const close = use(SheetClose);
  return (
    <div className="sheet-head">
      <h3>{title}</h3>
      <button className="sheet-x" type="button" aria-label="Close" onClick={close}>
        ×
      </button>
    </div>
  );
}

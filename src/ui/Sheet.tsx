import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Sheet as SheetRoot, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { isInToaster } from "~/components/ui/sonner";
import { isTransitioning } from "~/lib/motion";
import { returnFocus, takeOpener } from "./focusReturn";

interface SheetProps {
  label: string;
  onClose: () => void;
  children: ReactNode;
  /** Changing this scrolls the sheet back to the top, for a sheet that shows something else. */
  contentKey?: string;
}

/** Taps on a toast (its Undo) don't count as a tap outside the sheet. */
/**
 * An open bottom sheet (shadcn/ui Sheet). It's open while mounted: tap outside, press Escape or drag it
 * down to close. It slides up as it opens and down as it closes (app/pageTransition.ts), or appears with
 * a card's picture flying in. A field marked autoFocus gets focus as it opens, else the sheet itself, and
 * focus goes back to what opened it on close.
 */
export function Sheet({ label, onClose, children, contentKey }: SheetProps) {
  const card = useRef<HTMLDivElement>(null);
  // Read while rendering, before an autoFocus field inside takes focus.
  const [opener] = useState(takeOpener);
  // Opened inside a transition: that already animates it, so skip the slide-up. Fixed at mount.
  const [noEnter] = useState(isTransitioning);
  useLayoutEffect(() => {
    card.current?.scrollTo({ top: 0 });
  }, [contentKey]);

  return (
    <SheetRoot
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        ref={card}
        aria-describedby={undefined}
        noEnter={noEnter}
        onDragClose={onClose}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          if (!card.current?.contains(document.activeElement)) card.current?.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          returnFocus(opener);
        }}
        onInteractOutside={(e) => {
          if (isInToaster(e.target)) e.preventDefault();
        }}
      >
        <SheetTitle className="sr-only">{label}</SheetTitle>
        {children}
      </SheetContent>
    </SheetRoot>
  );
}

export function SheetHead({ title }: { title: string }) {
  return (
    <SheetHeader>
      <h3 className="m-0 min-w-0 text-lg leading-tight font-bold tracking-[-0.01em]">{title}</h3>
    </SheetHeader>
  );
}

import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { stepPane, tileOf } from "~/lib/tiles";
import { Button } from "~/components/ui/button";
import { Sheet as SheetRoot, SheetContent, SheetHeader, SheetPane, SheetTitle } from "~/components/ui/sheet";
import { isInToaster } from "~/components/ui/sonner";
import { isTransitioning } from "~/lib/motion";
import { holdPlace } from "~/lib/scroll";
import { useDesktop } from "~/lib/useMediaQuery";
import { returnFocus, takeOpener } from "./focusReturn";

interface SheetProps {
  label: string;
  onClose: () => void;
  children: ReactNode;
  /** Changing this scrolls the sheet back to the top, for a sheet that shows something else. */
  contentKey?: string;
  /**
   * A card's details: on a desktop it docks beside the grid instead of covering it, and `contentKey`
   * is the card's tile anchor (lib/scroll.ts), so the pane can step to the cards around it.
   */
  dock?: boolean;
}

/**
 * An open sheet (shadcn/ui Sheet). It's open while mounted: tap outside, press Escape or drag it down to
 * close. On a desktop, a docked one sits beside the grid instead (see `dock`).
 */
export function Sheet(props: SheetProps) {
  const desktop = useDesktop();
  return props.dock && desktop ? <Pane {...props} /> : <BottomSheet {...props} />;
}

/**
 * The bottom sheet. It slides up as it opens and down as it closes (app/pageTransition.ts), or appears
 * with a card's picture flying in. A field marked autoFocus gets focus as it opens, else the sheet
 * itself, and focus goes back to what opened it on close.
 */
function BottomSheet({ label, onClose, children, contentKey }: SheetProps) {
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
        // Taps on a toast (its Undo) don't count as a tap outside the sheet.
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

/**
 * Set while the sheet being drawn is the desktop pane: whether its card's tile is in the grid, so its
 * header can offer the cards before and after it.
 */
const InPane = createContext<{ steps: boolean } | null>(null);

/**
 * The desktop details pane, docked at the right of the window. Clicking another tile shows that card
 * here; Escape or the close button closes it. Focus stays on the grid, so the arrow keys keep moving
 * between cards (app/useTileKeys.ts).
 */
function Pane({ label, onClose, children, contentKey }: SheetProps) {
  const box = useRef<HTMLDivElement>(null);
  // Read while rendering, from the grid as it was when this card was picked. A card opened from
  // somewhere other than a grid tile (a binder pocket, say) has no neighbours to step to.
  const steps = useMemo(() => contentKey !== undefined && tileOf(contentKey) !== null, [contentKey]);
  useLayoutEffect(() => {
    box.current?.scrollTo({ top: 0 });
  }, [contentKey]);
  useHoldTile(contentKey);

  return (
    <SheetRoot
      open
      modal={false}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetPane
        ref={box}
        data-for={contentKey}
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          // Focus was in the pane, now gone: back to the card's tile in the grid.
          const tile = contentKey ? tileOf(contentKey) : null;
          if (document.activeElement === document.body && tile) returnFocus(tile.querySelector(".card-open"));
        }}
        // The grid beside it stays live: clicking another card shows that one here instead.
        onInteractOutside={(e) => e.preventDefault()}
        // Escape in a field beside the pane (the search box) is for that field.
        onEscapeKeyDown={(e) => {
          const t = e.target;
          if (t instanceof HTMLElement && !box.current?.contains(t) && t.closest(FIELDS)) e.preventDefault();
        }}
      >
        <SheetTitle className="sr-only">{label}</SheetTitle>
        <InPane value={steps ? WITH_STEPS : NO_STEPS}>{children}</InPane>
      </SheetPane>
    </SheetRoot>
  );
}

const WITH_STEPS = { steps: true };
const NO_STEPS = { steps: false };
const FIELDS = "input, textarea, select, [contenteditable='true']";

/**
 * The pane narrows the grid as it opens and widens it again as it goes, which regroups the grid's
 * rows: this keeps the card it shows where it was on screen through both, however the pane opens or
 * closes (a click, Escape, the browser's back button).
 */
function useHoldTile(id: string | undefined): void {
  // Read while rendering, before the pane is in the page and the grid has narrowed.
  const [opened] = useState(() => (id ? holdPlace(id) : null));
  useLayoutEffect(() => {
    void opened?.();
  }, [opened]);
  const shown = useRef(id);
  useLayoutEffect(() => {
    shown.current = id;
  });
  useLayoutEffect(() => {
    const current = shown;
    return () => {
      // Runs as the pane leaves, while it's still in the page: the grid widens once it's gone.
      const last = current.current;
      if (!last) return;
      const settle = holdPlace(last);
      setTimeout(() => void settle());
    };
  }, []);
}

export function SheetHead({ title }: { title: string }) {
  const pane = useContext(InPane);
  return (
    <SheetHeader>
      <h3 className="m-0 min-w-0 flex-1 text-lg leading-tight font-bold tracking-[-0.01em]">{title}</h3>
      {pane?.steps ? (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous card"
            title="Previous card (←)"
            onClick={() => stepPane("left")}
          >
            <ChevronUpIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next card"
            title="Next card (→)"
            onClick={() => stepPane("right")}
          >
            <ChevronDownIcon />
          </Button>
        </div>
      ) : null}
    </SheetHeader>
  );
}

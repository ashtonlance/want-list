import { XIcon } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { useRef, type ComponentProps, type TouchEvent } from "react";
import { cn } from "~/lib/utils";

/**
 * shadcn/ui Sheet (Radix Dialog), as the app's bottom sheet: it rises from the bottom on phones and
 * sits centred on wide screens. Drag the grip or the header down to close. The `sheet` and `sheet-card`
 * class names are hooks for the view transitions in styles/motion.css and lib/motion.ts.
 */
function Sheet(props: ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

const SheetClose = SheetPrimitive.Close;

interface SheetContentProps extends ComponentProps<typeof SheetPrimitive.Content> {
  /** Skip the slide up, when a view transition already draws the sheet coming in. */
  noEnter?: boolean;
  /** Called when a drag down goes far enough to close. */
  onDragClose: () => void;
}

/** How far, in pixels, the sheet has to be pulled down to close on release. */
const DRAG_CLOSE = 110;

function SheetContent({ className, children, noEnter, onDragClose, ref, ...props }: SheetContentProps) {
  const card = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ y0: number; dy: number } | null>(null);

  const onTouchStart = (e: TouchEvent) => {
    const t = e.target as Element;
    if (!t.closest("[data-sheet-drag]") || t.closest("button,input,select,textarea,a")) return;
    drag.current = { y0: e.touches[0]?.clientY ?? 0, dy: 0 };
    if (card.current) card.current.style.transition = "none";
  };
  const onTouchMove = (e: TouchEvent) => {
    const d = drag.current;
    if (!d || !card.current) return;
    d.dy = Math.max(0, (e.touches[0]?.clientY ?? 0) - d.y0);
    card.current.style.transform = `translateY(${String(d.dy)}px)`;
  };
  const onTouchEnd = () => {
    const d = drag.current;
    drag.current = null;
    const el = card.current;
    if (!d || !el) return;
    el.style.transition = "transform var(--t) var(--ease)";
    if (d.dy > DRAG_CLOSE) onDragClose();
    else el.style.transform = "";
  };

  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        data-slot="sheet-overlay"
        data-no-enter={noEnter ? "" : undefined}
        className={cn(
          "sheet fixed inset-0 z-45 flex items-end justify-center bg-scrim",
          "animate-[fade_var(--t)_var(--ease)] data-no-enter:animate-none",
          "min-[700px]:items-center min-[700px]:p-6",
        )}
      >
        <SheetPrimitive.Content
          ref={(el) => {
            card.current = el;
            if (typeof ref === "function") ref(el);
            else if (ref) ref.current = el;
          }}
          data-slot="sheet-content"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className={cn(
            "sheet-card w-[min(640px,100%)] touch-pan-y overflow-auto overscroll-contain bg-card text-foreground outline-none",
            "max-h-[calc(100%-env(safe-area-inset-top,0px)-12px)] rounded-t-[20px] px-(--gx) pt-1.5 pb-[calc(20px+env(safe-area-inset-bottom,0px))]",
            "shadow-[0_-10px_40px_rgba(0,0,0,0.18)] animate-[up_var(--t-slow)_var(--ease-sheet)] in-data-no-enter:animate-none",
            "min-[700px]:max-h-[86dvh] min-[700px]:rounded-[20px] min-[700px]:pb-5",
            className,
          )}
          {...props}
        >
          <div
            data-sheet-drag
            aria-hidden="true"
            className="mx-auto my-1 h-[5px] w-9 rounded-[3px] bg-input"
          />
          {children}
        </SheetPrimitive.Content>
      </SheetPrimitive.Overlay>
    </SheetPrimitive.Portal>
  );
}

/**
 * The same sheet docked at the window's right edge, beside the content, on a desktop (ui/Sheet's `dock`).
 * Not modal: the grid beside it stays live. `pane` is the hook for the layout (styles/sheets.css).
 */
function SheetPane({ className, children, ...props }: ComponentProps<typeof SheetPrimitive.Content>) {
  return (
    <SheetPrimitive.Content
      data-slot="sheet-pane"
      className={cn(
        "pane fixed top-0 right-0 bottom-0 z-35 w-(--pane-w) overflow-y-auto overscroll-contain bg-card text-foreground outline-none",
        "border-l-[0.5px] border-input px-5 pt-1.5 pb-6 animate-[pane-in_var(--t-slow)_var(--ease)]",
        className,
      )}
      {...props}
    >
      {children}
    </SheetPrimitive.Content>
  );
}

/** The sticky title row, with the close button. Dragging it closes the sheet too. */
function SheetHeader({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      data-sheet-drag
      className={cn(
        "sticky -top-1.5 z-2 flex items-center justify-between gap-2.5 bg-card pt-2 pb-3",
        className,
      )}
      {...props}
    >
      {children}
      <SheetPrimitive.Close
        data-slot="button"
        aria-label="Close"
        className={cn(
          "grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-secondary p-0 text-muted-foreground",
          "transition-[scale] duration-(--t-fast) ease-(--ease) active:scale-96",
          "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        )}
      >
        <XIcon className="size-4.5" strokeWidth={2.4} />
      </SheetPrimitive.Close>
    </div>
  );
}

function SheetTitle({ className, ...props }: ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("m-0 min-w-0 text-lg leading-tight font-bold tracking-[-0.01em]", className)}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }: ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("m-0 text-[13px] text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetPane, SheetTitle };

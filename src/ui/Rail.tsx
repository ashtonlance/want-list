import { createContext, useContext, useId, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "~/components/ui/button";
import { Toggle } from "~/components/ui/toggle";
import { cn } from "~/lib/utils";
import { SideSlot } from "./sideSlot";

const InSide = createContext(false);

/**
 * A screen's set of choices (collections, sets, binders): a row of chips that scrolls sideways on a
 * phone, a list in the side bar on a desktop. Its items are RailItem and RailAction.
 */
export function Rail({ label, children }: { label: string; children: ReactNode }) {
  const slot = useContext(SideSlot);
  const head = useId();
  if (!slot)
    return (
      <div className="colltabs" role="group" aria-label={label}>
        {children}
      </div>
    );
  return createPortal(
    <InSide value={true}>
      <div className="side-rail" role="group" aria-labelledby={head}>
        <h2 className="side-head" id={head}>
          {label}
        </h2>
        {children}
      </div>
    </InSide>,
    slot,
  );
}

interface ItemProps {
  label: ReactNode;
  /** A quieter count or note beside the label. */
  sub?: ReactNode;
  pressed: boolean;
  /** Picks this one. Pressing the one already picked keeps it picked. */
  onPick: () => void;
  /** How far along it is, 0 to 1, drawn as a thin bar under the row in the side bar. */
  progress?: number;
  /** Extra classes for the phone's chip. */
  chipClassName?: string;
}

/** One choice in a Rail. */
export function RailItem({ label, sub, pressed, onPick, progress, chipClassName }: ItemProps) {
  const side = useContext(InSide);
  return (
    <Toggle
      variant={side ? "side" : "chip"}
      pressed={pressed}
      onPressedChange={() => onPick()}
      // In the side bar: level with the heading, and taller where a progress line sits under the label.
      className={side ? cn("px-3", progress !== undefined && "min-h-10 pb-2.5") : chipClassName}
    >
      <b>{label}</b>
      {sub !== undefined ? <span>{sub}</span> : null}
      {side && progress !== undefined ? (
        <i className="side-progress" style={{ "--p": Math.min(1, Math.max(0, progress)) } as CSSProperties} />
      ) : null}
    </Toggle>
  );
}

/** A quieter entry after the choices in a Rail, which opens something instead of picking. */
export function RailAction({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  const side = useContext(InSide);
  return (
    <Button
      variant={side ? "ghost" : "outline"}
      size="sm"
      className={side ? "w-full justify-start px-3 font-medium text-muted-foreground" : "rounded-full"}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

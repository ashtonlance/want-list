import { cva, type VariantProps } from "class-variance-authority";
import { Toggle as TogglePrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "~/lib/utils";

/**
 * shadcn/ui Toggle. The `chip` variant is the app's pill: outlined off, solid ink on; `side` is a row in the
 * desktop side bar. A <span> inside it (a count, say) reads quieter than the label; matching line heights
 * keep the two on one baseline.
 */
const toggleVariants = cva(
  [
    "inline-flex shrink-0 cursor-pointer touch-manipulation items-center justify-center gap-1.5 border-0 font-semibold whitespace-nowrap select-none",
    "transition-[scale,background-color,color,border-color] duration-(--t) ease-(--ease) active:scale-96",
    "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        chip: [
          "rounded-full border border-input bg-card text-ink-2 data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background",
          "[&>span]:text-xs [&>span]:leading-5 [&>span]:font-normal [&>span]:text-muted-foreground [&>span]:tabular-nums data-[state=on]:[&>span]:text-current data-[state=on]:[&>span]:opacity-65",
        ],
        default: "rounded-md bg-transparent text-muted-foreground data-[state=on]:text-foreground",
        /** A row in the desktop side bar (ui/Rail): label on the left, its count on the right. */
        side: [
          "w-full justify-between gap-3 rounded-lg bg-transparent text-left text-ink-2 hover:bg-accent data-[state=on]:bg-accent data-[state=on]:text-foreground",
          "[&>b]:min-w-0 [&>b]:truncate [&>b]:font-medium data-[state=on]:[&>b]:font-semibold [&>span]:text-xs [&>span]:font-normal [&>span]:text-muted-foreground [&>span]:tabular-nums",
        ],
      },
      size: {
        default: "min-h-9 px-3.5 py-1.5 text-sm",
        sm: "min-h-8 px-3 py-1 text-[13px]",
      },
    },
    defaultVariants: { variant: "chip", size: "default" },
  },
);

function Toggle({
  className,
  variant,
  size,
  ...props
}: ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };

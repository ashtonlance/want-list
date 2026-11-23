import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "~/lib/utils";

/**
 * shadcn/ui Button, themed to the app: 44px tall by default, a small press on tap, no hover wash on touch.
 * Controls drawn smaller than 44px still get a 44px tap area (styles/shadcn.css).
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 cursor-pointer touch-manipulation items-center justify-center gap-1.5 rounded-md border-0 font-semibold whitespace-nowrap no-underline select-none",
    "transition-[scale,background-color,color,border-color,opacity] duration-(--t) ease-(--ease) active:scale-96",
    "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "disabled:cursor-default disabled:opacity-40 aria-disabled:cursor-default aria-disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4.5",
  ],
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        destructive: "bg-secondary text-destructive",
        outline: "border border-input bg-card text-foreground",
        ghost: "bg-transparent text-foreground hover:bg-accent",
        link: "bg-transparent text-foreground underline decoration-input underline-offset-3",
        /** On the dark photo view. */
        glass: "bg-white/16 text-white",
        contrast: "bg-white text-[#111114]",
      },
      size: {
        default: "min-h-11 px-4 py-2.5 text-[15px]",
        sm: "min-h-9 px-3 py-1.5 text-sm",
        icon: "size-9 rounded-full p-0 [&_svg:not([class*='size-'])]:size-5",
        "icon-lg": "size-11 rounded-full p-0 [&_svg:not([class*='size-'])]:size-5",
        "icon-sm": "size-8 rounded-full p-0 text-xl leading-none text-muted-foreground",
      },
    },
    compoundVariants: [
      { variant: "link", class: "min-h-0 px-0 py-1.5 text-sm active:scale-100 active:opacity-60" },
    ],
    defaultVariants: { variant: "secondary", size: "default" },
  },
);

type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      data-variant={variant ?? "secondary"}
      data-size={size ?? "default"}
      className={cn(buttonVariants({ variant, size, className }))}
      // A plain button unless asked otherwise, so one inside a form never submits it by accident.
      type={asChild ? undefined : (type ?? "button")}
      {...props}
    />
  );
}

export { Button, buttonVariants };
export type { ButtonProps };

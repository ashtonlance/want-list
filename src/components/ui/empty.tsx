import type { ComponentProps } from "react";
import { cn } from "~/lib/utils";

/**
 * shadcn/ui Empty, as the app's empty state: a calm panel with a dashed card outline above the message.
 * It spans the whole row when placed in a grid of cards.
 */
function Empty({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "col-span-full flex flex-col items-center gap-3 rounded-xl bg-card px-6 py-11 text-center text-[15px] leading-normal text-muted-foreground shadow-(--shadow)",
        "before:h-13 before:w-10 before:rounded-[6px] before:border-2 before:border-dashed before:border-input",
        "[&_p]:m-0",
        className,
      )}
      {...props}
    />
  );
}

function EmptyTitle({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="empty-title" className={cn("font-semibold text-foreground", className)} {...props} />
  );
}

function EmptyDescription({ className, ...props }: ComponentProps<"p">) {
  return <p data-slot="empty-description" className={cn("m-0", className)} {...props} />;
}

export { Empty, EmptyDescription, EmptyTitle };

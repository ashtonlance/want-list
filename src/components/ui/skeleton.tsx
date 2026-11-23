import type { ComponentProps } from "react";
import { cn } from "~/lib/utils";

/** shadcn/ui Skeleton, with the app's shimmer instead of a pulse (styles/shadcn.css). */
function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="skeleton" className={cn("skeleton-shimmer rounded-[6px]", className)} {...props} />;
}

export { Skeleton };

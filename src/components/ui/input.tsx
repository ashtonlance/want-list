import type { ComponentProps } from "react";
import { cn } from "~/lib/utils";

/** shadcn/ui Input, themed to the app: a sunken 44px field that lifts to the surface when focused. */
const inputClass = [
  "min-h-11 w-full min-w-0 appearance-none rounded-md border border-transparent bg-secondary px-3 py-2.5 text-base text-foreground",
  "transition-[background-color,border-color] duration-(--t) ease-(--ease) outline-none placeholder:text-muted-foreground",
  "focus:border-input focus:bg-card disabled:cursor-not-allowed disabled:opacity-50",
  "aria-invalid:border-destructive",
];

function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        inputClass,
        "[&::-webkit-search-cancel-button]:cursor-pointer [&::-webkit-search-decoration]:appearance-none",
        className,
      )}
      {...props}
    />
  );
}

export { Input, inputClass };

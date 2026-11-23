import { SearchIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

type Props = Omit<ComponentProps<"input">, "type"> & {
  /** Classes for the box around the field, to size it in a row. `className` goes on the field. */
  wrapClassName?: string;
};

/** shadcn/ui Input as a search box, with the magnifier inside its left edge. */
export function SearchInput({ className, wrapClassName, ...props }: Props) {
  return (
    <div className={cn("relative min-w-0", wrapClassName)}>
      <SearchIcon
        aria-hidden="true"
        strokeWidth={2.2}
        className="pointer-events-none absolute top-1/2 left-3.25 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input type="search" className={cn("pl-9.5", className)} {...props} />
    </div>
  );
}

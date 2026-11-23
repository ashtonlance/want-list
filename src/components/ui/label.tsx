import { Label as LabelPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "~/lib/utils";

/**
 * shadcn/ui Label, as the app's field label: small muted text with its field under it. For a checkbox
 * or switch beside its text, add `flex-row items-center`.
 */
function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold text-muted-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };

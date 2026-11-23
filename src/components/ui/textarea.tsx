import type { ComponentProps } from "react";
import { cn } from "~/lib/utils";
import { inputClass } from "./input";

/** shadcn/ui Textarea, matching Input. */
function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(inputClass, "min-h-20 resize-y leading-snug", className)}
      {...props}
    />
  );
}

export { Textarea };

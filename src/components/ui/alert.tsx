import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "~/lib/utils";

/**
 * shadcn/ui Alert, as the app's banner: a calm panel of text above a screen. `muted` is the sunken one
 * for a passing state like being offline. No role by default: pass role="alert" or role="status" where
 * the message appears in response to something.
 */
const alertVariants = cva("w-full rounded-xl px-3.5 py-3 text-sm leading-[1.45] text-ink-2", {
  variants: {
    variant: {
      default: "bg-card shadow-(--shadow)",
      muted: "bg-secondary",
    },
  },
  defaultVariants: { variant: "default" },
});

function Alert({ className, variant, ...props }: ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="alert-title" className={cn("font-semibold text-foreground", className)} {...props} />
  );
}

function AlertDescription({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="alert-description" className={cn("text-muted-foreground", className)} {...props} />;
}

export { Alert, AlertDescription, AlertTitle, alertVariants };

import { ChevronRightIcon } from "lucide-react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "~/lib/utils";

/**
 * shadcn/ui Accordion, drawn as the app's grouped list: rows on a sunken panel, a chevron that turns as
 * a row opens, and the panel easing open (styles/shadcn.css has the height animation).
 */
function Accordion({ className, ...props }: ComponentProps<typeof AccordionPrimitive.Root>) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn("flex flex-col overflow-hidden rounded-lg bg-secondary", className)}
      {...props}
    />
  );
}

function AccordionItem({ className, ...props }: ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("border-t-[0.5px] border-input first:border-t-0", className)}
      {...props}
    />
  );
}

/** One row. Classes for a row that's a plain action (no panel) are in `accordionRowClass`. */
const accordionRowClass =
  "flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-3.5 py-3 text-left text-[15px] font-medium text-foreground outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:opacity-40";

function AccordionTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="m-0 flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(accordionRowClass, "group/accordion-trigger", className)}
        {...props}
      >
        {children}
        <ChevronRightIcon
          aria-hidden="true"
          className="size-5 shrink-0 text-faint transition-transform duration-(--t) ease-(--ease) group-data-[state=open]/accordion-trigger:rotate-90"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="accordion-content overflow-hidden"
      {...props}
    >
      <div className={cn("px-3.5 pt-1 pb-3.5", className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger, accordionRowClass };

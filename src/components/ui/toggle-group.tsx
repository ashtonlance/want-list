import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import { useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { cn } from "~/lib/utils";

/**
 * shadcn/ui Toggle Group, drawn as the app's segmented control: a sunken track with a raised pill that
 * slides to the chosen option. Use it with type="single".
 */
function ToggleGroup({ className, children, ...props }: ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  const track = useRef<HTMLDivElement>(null);
  // Set once the pill has its first place, so it appears there instead of sliding in from the left.
  const [ready, setReady] = useState(false);
  const value = "value" in props ? props.value : undefined;

  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const place = () => {
      const on = el.querySelector<HTMLElement>('[data-slot="toggle-group-item"][data-state="on"]');
      el.style.setProperty("--x", `${String(on?.offsetLeft ?? 0)}px`);
      el.style.setProperty("--w", `${String(on?.offsetWidth ?? 0)}px`);
    };
    place();
    if (typeof ResizeObserver === "undefined") return;
    // Widths change with the text size and the screen; keep the pill on its option.
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value]);

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <ToggleGroupPrimitive.Root
      ref={track}
      data-slot="toggle-group"
      data-ready={ready || undefined}
      className={cn(
        "group/toggle-group relative isolate inline-flex gap-0.5 rounded-md bg-secondary p-[3px]",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-[3px] left-0 -z-10 w-(--w) translate-x-(--x) rounded-[8px] bg-card shadow-[0_1px_2px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.04)]",
          "transition-[translate,width] duration-(--t) ease-(--ease) group-not-data-ready/toggle-group:transition-none",
        )}
      />
      {children}
    </ToggleGroupPrimitive.Root>
  );
}

function ToggleGroupItem({ className, ...props }: ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        "min-h-[34px] flex-1 cursor-pointer touch-manipulation rounded-[8px] border-0 bg-transparent px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap text-muted-foreground select-none",
        "transition-[color,scale] duration-(--t) ease-(--ease) active:scale-94 data-[state=on]:text-foreground",
        "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };

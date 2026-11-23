import { Loader2Icon } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const action =
  "ml-1 cursor-pointer border-0 bg-transparent p-1 font-extrabold text-inherit underline underline-offset-2 relative after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2";

/**
 * shadcn/ui Sonner, drawn as the app's toast: a dark pill centred above the tab bar. The `!` sizes beat
 * Sonner's own unlayered stylesheet, which stretches toasts full width on phones.
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="system"
      position="bottom-center"
      visibleToasts={1}
      className="toaster"
      icons={{ loading: <Loader2Icon className="size-4 animate-spin" /> }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex items-center gap-1 rounded-full bg-foreground px-4.5 py-2.75 font-sans text-sm font-semibold text-background shadow-[0_6px_24px_rgba(0,0,0,0.2)] pointer-events-auto inset-x-0! mx-auto! w-fit! max-w-[calc(100%-32px)]!",
          actionButton: action,
          cancelButton: action + " font-semibold opacity-70",
        },
      }}
      {...props}
    />
  );
}

/** Whether a tap landed on a toast: overlays stay open for it, so Undo works with a sheet or photo up. */
function isInToaster(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest("[data-sonner-toaster]");
}

export { Toaster, isInToaster };

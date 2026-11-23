import { createContext, use, type ReactNode } from "react";
import { toast as sonner } from "sonner";
import { Toaster } from "~/components/ui/sonner";

interface ToastApi {
  /** A short message at the bottom of the screen. */
  toast: (message: string) => void;
  /** A message with an Undo button, shown a little longer. */
  toastUndo: (message: string, undo: () => void) => void;
  /** A message that stays up while something slow runs, until the next message replaces it (a minute at most). */
  toastBusy: (message: string) => void;
}

/** One toast at a time: each new message takes the place of the last. */
const ID = "app";

const api: ToastApi = {
  // `action: undefined`: a new message keeps the old one's options unless told otherwise, Undo included.
  toast: (message) => sonner(message, { id: ID, duration: 2600, action: undefined }),
  toastUndo: (message, undo) =>
    sonner(message, {
      id: ID,
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          sonner.dismiss(ID);
          undo();
        },
      },
    }),
  toastBusy: (message) => sonner(message, { id: ID, duration: 60_000, action: undefined }),
};

const ToastContext = createContext<ToastApi | null>(null);

/** Toasts (shadcn/ui Sonner), shown above the tab bar. */
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <ToastContext value={api}>
      {children}
      <Toaster
        offset={{ bottom: "var(--toast-bottom)" }}
        mobileOffset={{ bottom: "var(--toast-bottom)", left: 0, right: 0 }}
      />
    </ToastContext>
  );
}

export function useToast(): ToastApi {
  const value = use(ToastContext);
  if (!value) throw new Error("useToast needs a ToastProvider");
  return value;
}

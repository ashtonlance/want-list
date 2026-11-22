import { useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback } from "react";
import { NO_OVERLAY, type RootSearch } from "./search";

declare module "@tanstack/react-router" {
  interface HistoryState {
    /** Set on history entries that only opened a sheet, so closing it can step back. */
    overlay?: boolean;
  }
}

/** Opens and closes the sheets kept in the address (card details, account, add, options). */
export function useOverlayNav() {
  const navigate = useNavigate();
  const router = useRouter();

  const open = useCallback(
    (search: RootSearch) =>
      void navigate({
        to: ".",
        search: (prev) => ({ ...prev, ...NO_OVERLAY, ...search }),
        state: (prev) => ({ ...prev, overlay: true }),
        resetScroll: false,
      }),
    [navigate],
  );

  const close = useCallback(() => {
    if (router.state.location.state.overlay) {
      router.history.back();
      return;
    }
    void navigate({ to: ".", search: (prev) => ({ ...prev, ...NO_OVERLAY }), replace: true, resetScroll: false });
  }, [navigate, router]);

  return { open, close };
}

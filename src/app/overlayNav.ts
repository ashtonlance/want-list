import { useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback } from "react";
import { morph, sheetPicture, tilePicture } from "~/lib/motion";
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

  /**
   * Opens a sheet. `from` is the anchor id (`data-sr`) of the tile that was tapped: its picture flies
   * into the sheet's as it opens.
   */
  const open = useCallback(
    (search: RootSearch, from?: string) => {
      morph({
        from: from ? tilePicture(from) : null,
        update: () =>
          navigate({
            to: ".",
            search: (prev) => ({ ...prev, ...NO_OVERLAY, ...search }),
            state: (prev) => ({ ...prev, overlay: true }),
            resetScroll: false,
          }),
        to: sheetPicture,
      });
    },
    [navigate],
  );

  const close = useCallback(() => {
    if (router.state.location.state.overlay) {
      router.history.back();
      return;
    }
    void navigate({
      to: ".",
      search: (prev) => ({ ...prev, ...NO_OVERLAY }),
      replace: true,
      resetScroll: false,
    });
  }, [navigate, router]);

  return { open, close };
}

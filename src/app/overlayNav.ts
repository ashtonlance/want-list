import { useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback } from "react";
import { EASE_IN, morph, prefersReducedMotion, sheetPicture, tilePicture } from "~/lib/motion";
import { isDesktop } from "~/lib/useMediaQuery";
import { detailOf, NO_OVERLAY, type RootSearch } from "./search";

declare module "@tanstack/react-router" {
  interface HistoryState {
    /** Set on history entries that only opened a sheet, so closing it can step back. */
    overlay?: boolean;
  }
}

/** Whether a card's details open in the desktop pane beside the grid (ui/Sheet's `dock`). */
const docks = (search: RootSearch) => detailOf(search) !== undefined && isDesktop();

/** The desktop pane sliding away, until it's gone. Another card picked meanwhile calls it off. */
let exit: Animation | null = null;

/** Opens and closes the sheets kept in the address (card details, account, add, options). */
export function useOverlayNav() {
  const navigate = useNavigate();
  const router = useRouter();

  /**
   * Opens a sheet. `from` is the anchor id (`data-sr`) of the tile that was tapped: its picture flies
   * into the sheet's as it opens. On a desktop a card's details open in the pane beside the grid
   * instead, which keeps the tile in place itself (ui/Sheet.tsx).
   */
  const open = useCallback(
    (search: RootSearch, from?: string) => {
      const go = (replace: boolean) =>
        navigate({
          to: ".",
          search: (prev) => ({ ...prev, ...NO_OVERLAY, ...search }),
          // A replaced entry keeps its own mark: one opened from a link has nothing to step back to.
          state: (prev) => ({ ...prev, overlay: replace ? prev.overlay : true }),
          replace,
          resetScroll: false,
        });
      if (docks(search)) {
        exit?.cancel();
        exit = null;
        // Another card while the pane is open shows in its place, and back still closes the pane.
        void go(detailOf(router.state.location.search) !== undefined);
        return;
      }
      morph({ from: from ? tilePicture(from) : null, update: () => go(false), to: sheetPicture });
    },
    [navigate, router],
  );

  const close = useCallback(() => {
    const back = () => {
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
    };
    const pane = document.querySelector<HTMLElement>(".pane");
    const id = detailOf(router.state.location.search);
    if (!pane || !id || prefersReducedMotion() || typeof pane.animate !== "function") {
      back();
      return;
    }
    // Escape and the close button pressed again while it slides away are the same close.
    if (exit) return;
    const slide = pane.animate([{ transform: "none" }, { opacity: 0, transform: "translateX(24px)" }], {
      duration: 160,
      easing: EASE_IN,
      fill: "forwards",
    });
    exit = slide;
    slide.finished.then(
      () => {
        if (exit !== slide) return;
        exit = null;
        // Unless it already went some other way (the browser's back button, say).
        if (detailOf(router.state.location.search) === id) back();
      },
      // Called off: another card was picked, so the pane stays.
      () => undefined,
    );
  }, [navigate, router]);

  return { open, close };
}

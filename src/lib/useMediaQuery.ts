import { useCallback, useSyncExternalStore } from "react";

/** Whether a CSS media query matches, kept up to date as the window changes. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const m = matchMedia(query);
      m.addEventListener("change", onChange);
      return () => m.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => matchMedia(query).matches,
    () => false,
  );
}

/** The desktop layout's breakpoint: the side bar, wider content and the details pane. Matches the CSS. */
export const DESKTOP_QUERY = "(min-width: 1024px)";

/** Whether the window is wide enough for the desktop layout. */
export const useDesktop = () => useMediaQuery(DESKTOP_QUERY);

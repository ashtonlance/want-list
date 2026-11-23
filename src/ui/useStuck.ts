import { useCallback } from "react";
import { useDesktop } from "~/lib/useMediaQuery";

/**
 * A ref for a search and filter bar that sticks under the top bar on a desktop (desktop.css). While
 * it's pinned it carries data-stuck, so it can take over the top bar's hairline, and --tools-h follows
 * its height, so a tile scrolled into view clears it. Phones don't pin the bar, so nothing runs there.
 */
export function useStuck(): (el: HTMLElement | null) => (() => void) | undefined {
  const desktop = useDesktop();
  return useCallback(
    (el: HTMLElement | null) => {
      if (
        !el ||
        !desktop ||
        typeof IntersectionObserver === "undefined" ||
        typeof ResizeObserver === "undefined"
      )
        return;
      // Where the bar pins, from its own sticky top, so the two can't drift apart.
      const top = parseFloat(getComputedStyle(el).top);
      if (Number.isNaN(top)) return;
      const root = document.documentElement;
      const pin = new IntersectionObserver(
        ([e]) => {
          if (e)
            el.toggleAttribute("data-stuck", e.intersectionRatio < 1 && e.boundingClientRect.top <= top + 1);
        },
        { rootMargin: `-${top + 1}px 0px 0px 0px`, threshold: 1 },
      );
      const size = new ResizeObserver(() => root.style.setProperty("--tools-h", `${el.offsetHeight}px`));
      pin.observe(el);
      size.observe(el);
      return () => {
        pin.disconnect();
        size.disconnect();
        root.style.removeProperty("--tools-h");
        el.removeAttribute("data-stuck");
      };
    },
    [desktop],
  );
}

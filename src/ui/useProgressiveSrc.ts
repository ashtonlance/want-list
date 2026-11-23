import { useEffect, useState } from "react";
import { bigImage } from "~/lib/images";

/**
 * The small picture straight away (it's usually cached from the grid), then the large one once it
 * has loaded. Used where a card is shown big, so it never flashes empty.
 */
export function useProgressiveSrc(src: string): string {
  const big = bigImage(src);
  const [loaded, setLoaded] = useState<string | null>(null);
  useEffect(() => {
    if (big === src) return;
    let live = true;
    const pre = new Image();
    pre.onload = () => {
      if (live) setLoaded(big);
    };
    pre.src = big;
    return () => {
      live = false;
    };
  }, [src, big]);
  return loaded === big ? big : src;
}

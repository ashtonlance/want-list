import type { SyntheticEvent } from "react";

/**
 * Card pictures fade in over their frame's shimmer once they've arrived (.fade-img in
 * styles/motion.css, the shimmer in styles/images.css). Set on the element, so no re-render.
 */
export const markReady = (img: HTMLImageElement | null): void => {
  if (img?.complete && img.naturalWidth > 0) img.classList.add("ready");
};

export const onArrive = (e: SyntheticEvent<HTMLImageElement>): void => {
  e.currentTarget.classList.add("ready");
};

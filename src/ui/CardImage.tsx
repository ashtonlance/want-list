import { useState, type ImgHTMLAttributes, type SyntheticEvent } from "react";
import { useProgressiveSrc } from "./useProgressiveSrc";

/** Pictures fade in once they've arrived (styles/motion.css). Set on the element, so no re-render. */
const markReady = (img: HTMLImageElement | null) => {
  if (img?.complete && img.naturalWidth > 0) img.classList.add("ready");
};
const onArrive = (e: SyntheticEvent<HTMLImageElement>) => e.currentTarget.classList.add("ready");

interface CardImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> {
  src: string | null | undefined;
  /** Shown in place of the picture when there isn't one or it fails to load. */
  name: string;
  alt?: string;
}

/** A card picture that falls back to the card's name if the image is missing or broken. */
export function CardImage({ src, name, alt = "", className, ...rest }: CardImageProps) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return <span className="noimg">{name}</span>;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={"fade-img" + (className ? " " + className : "")}
      ref={markReady}
      onLoad={onArrive}
      onError={() => setFailed(src)}
      {...rest}
    />
  );
}

/**
 * The large picture at the top of a card sheet: the small image straight away, the big one once it
 * has loaded. Give it `key={src}` so a new card starts fresh.
 */
export function HeroImage({ src, name }: { src: string; name: string }) {
  const shown = useProgressiveSrc(src);
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="noimg">{name}</span>;
  // Fades in over the frame's shimmer; the swap to the large picture keeps it shown, so it never blinks.
  return (
    <img
      src={shown}
      alt={`${name} card`}
      decoding="async"
      className="fade-img"
      ref={markReady}
      onLoad={onArrive}
      onError={() => setFailed(true)}
    />
  );
}

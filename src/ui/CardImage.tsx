import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { bigImage } from "~/lib/images";

interface CardImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> {
  src: string | null | undefined;
  /** Shown in place of the picture when there isn't one or it fails to load. */
  name: string;
  alt?: string;
}

/** A card picture that falls back to the card's name if the image is missing or broken. */
export function CardImage({ src, name, alt = "", ...rest }: CardImageProps) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return <span className="noimg">{name}</span>;
  return <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(src)} {...rest} />;
}

/** The large picture at the top of a card sheet: the small image straight away, the big one once it has loaded. */
export function HeroImage({ src, name }: { src: string; name: string }) {
  const [shown, setShown] = useState(src);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setShown(src);
    setFailed(false);
    const big = bigImage(src);
    if (big === src) return;
    let live = true;
    const pre = new Image();
    pre.onload = () => {
      if (live) setShown(big);
    };
    pre.src = big;
    return () => {
      live = false;
    };
  }, [src]);
  if (failed) return <span className="noimg">{name}</span>;
  return <img src={shown} alt={`${name} card`} decoding="async" onError={() => setFailed(true)} />;
}

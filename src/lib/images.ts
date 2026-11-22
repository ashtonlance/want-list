/** TCGplayer's product image: 400px wide, or the 1000px version for full screen. */
export function tcgImage(productId: number | string, big = false): string {
  return `https://tcgplayer-cdn.tcgplayer.com/product/${productId}${big ? "_in_1000x1000.jpg" : "_400w.jpg"}`;
}

/** The large version of a small TCGplayer or TCGdex image, or the same URL when there isn't one. */
export function bigImage(src: string): string {
  if (src.endsWith("_400w.jpg")) return src.slice(0, -"_400w.jpg".length) + "_in_1000x1000.jpg";
  if (/assets\.tcgdex\.net\/.+\/low\.webp$/.test(src)) return src.replace(/low\.webp$/, "high.webp");
  return src;
}

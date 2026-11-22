import { quickShopLinks } from "~/features/cards/links";

/** The Shop section of a pick or live card's sheet. */
export function ShopLinks(card: { name: string; set: string; number: string; pid: number | null }) {
  return (
    <div className="sec">
      <h4 className="sec-title">Shop</h4>
      <div className="shop">
        {quickShopLinks(card).map((l) => (
          <a key={l.label} href={l.href} target="_blank" rel="noopener" title={l.title}>
            {l.label}
          </a>
        ))}
      </div>
    </div>
  );
}

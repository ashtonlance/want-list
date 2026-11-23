import { describe, expect, it } from "vitest";
import { testCard } from "~/features/cards/testCard";
import { catalogLightbox, listMark } from "./display";

const raikou = { id: "td-136", name: "Raikou ex", set: "Delta Reign", number: "136", market: 101.83 };
const want = () => Promise.resolve(true);

describe("listMark", () => {
  it("says whether a catalog card is got, wanted or not on the list", () => {
    expect(listMark(testCard({ status: "got" }))).toBe("Got it");
    expect(listMark(testCard({ status: "want" }))).toBe("On your list");
    expect(listMark(null)).toBeUndefined();
  });
});

describe("catalogLightbox", () => {
  it("marks a card that's got, with no button", () => {
    const item = catalogLightbox(raikou, "x.webp", testCard({ status: "got" }), want);
    expect(item.mark).toBe("Got it");
    expect(item.action).toBeUndefined();
    expect(item.caption).toBe("Delta Reign · #136 · $101.83");
  });
  it("marks a wanted card as on the list", () => {
    const item = catalogLightbox(raikou, "x.webp", testCard({ status: "want" }), want);
    expect(item.mark).toBe("On your list");
    expect(item.action).toBeUndefined();
  });
  it("offers Want it for a card not on the list, only to editors", () => {
    const item = catalogLightbox(raikou, "x.webp", null, want);
    expect(item.mark).toBeUndefined();
    expect(item.action).toMatchObject({ key: "td-136", label: "Want it", run: want });
    expect(catalogLightbox(raikou, "x.webp", null, null).action).toBeUndefined();
  });
});

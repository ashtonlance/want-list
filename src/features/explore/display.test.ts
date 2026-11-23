import { describe, expect, it } from "vitest";
import { testCard } from "~/features/cards/testCard";
import { catalogLightbox, listMark } from "./display";

const raikou = { id: "td-136", name: "Raikou ex", set: "Delta Reign", number: "136", market: 101.83 };
const run = () => Promise.resolve(true);

describe("listMark", () => {
  it("says whether a catalog card is got, wanted or not on the list", () => {
    expect(listMark(testCard({ status: "got" }))).toBe("Got it");
    expect(listMark(testCard({ status: "want" }))).toBe("On your list");
    expect(listMark(null)).toBeUndefined();
  });
});

describe("catalogLightbox", () => {
  it("tags a card already on the list, with no button", () => {
    const item = catalogLightbox(raikou, "x.webp", "Got it", { coll: "", run });
    expect(item.mark).toBe("Got it");
    expect(item.action).toBeUndefined();
    expect(item.caption).toBe("Delta Reign · #136");
    expect(catalogLightbox(raikou, "x.webp", "On your list", null).caption).toBe(
      "Delta Reign · #136 · $101.83",
    );
  });
  it("offers Want it for a card not on the list, naming the collection, only to editors", () => {
    const item = catalogLightbox(raikou, "x.webp", undefined, { coll: "Legends", run });
    expect(item.mark).toBeUndefined();
    expect(item.action).toMatchObject({ key: "td-136", label: "Want it (adds to Legends)", run });
    expect(catalogLightbox(raikou, "x.webp", undefined, { coll: "", run }).action?.label).toBe("Want it");
    expect(catalogLightbox(raikou, "x.webp", undefined, null).action).toBeUndefined();
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { focusedTile, neighbor, tileOf } from "./tiles";

/** A 3-column grid of 5 tiles, 100px square, laid out as the browser would. */
function grid() {
  document.body.innerHTML = `<main>${[0, 1, 2, 3, 4]
    .map(
      (i) =>
        `<div data-sr="c${i}"><button class="card-open"></button><button class="photo-open"></button></div>`,
    )
    .join("")}<div data-sr="pocket"><span>no opener</span></div><input id="field"></main>`;
  for (const i of [0, 1, 2, 3, 4]) {
    const el = get(`[data-sr="c${i}"]`);
    const left = (i % 3) * 100;
    const top = Math.floor(i / 3) * 100;
    el.getBoundingClientRect = () => ({ left, top, width: 100, height: 100 }) as DOMRect;
  }
}

/** The element `sel` matches, failing the test where there's none. */
function get(sel: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(sel);
  if (!el) throw new Error(`No ${sel}`);
  return el;
}

const id = (el: HTMLElement | null) => el?.dataset.sr;

describe("tiles", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("finds tiles only where they can be opened", () => {
    grid();
    expect(tileOf("c1")).not.toBeNull();
    expect(tileOf("pocket")).toBeNull();
  });

  it("moves in reading order left and right, and by row up and down", () => {
    grid();
    const c = (n: number) => get(`[data-sr="c${n}"]`);
    expect(id(neighbor(c(2), "right"))).toBe("c3");
    expect(id(neighbor(c(0), "left"))).toBeUndefined();
    expect(id(neighbor(c(1), "down"))).toBe("c4");
    // Nothing straight below the last column: the nearest tile in the next row.
    expect(id(neighbor(c(2), "down"))).toBe("c4");
    expect(id(neighbor(c(3), "up"))).toBe("c0");
    expect(id(neighbor(c(4), "down"))).toBeUndefined();
  });

  it("counts focus anywhere in a tile, but not in a field", () => {
    grid();
    get('[data-sr="c2"] .photo-open').focus();
    expect(id(focusedTile())).toBe("c2");
    get("#field").focus();
    expect(focusedTile()).toBeNull();
  });
});

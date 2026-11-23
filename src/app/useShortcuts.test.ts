import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pressAct } from "./useShortcuts";

/** A row of three picks with quick actions; the second is already wanted, so its + is off. */
function picks() {
  document.body.innerHTML = `<main>${[0, 1, 2]
    .map(
      (i) => `<article data-sr="p${i}"><button class="card-open"></button>
        <button data-act="pass"></button><button data-act="want" ${i === 1 ? "disabled" : ""}></button></article>`,
    )
    .join("")}</main>`;
}

function get(sel: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(sel);
  if (!el) throw new Error(`No ${sel}`);
  return el;
}

/** Counts presses of the element `sel` matches. */
function spy(sel: string) {
  const fn = vi.fn();
  get(sel).addEventListener("click", fn);
  return fn;
}

describe("pressAct", () => {
  beforeEach(() => {
    // jsdom has no scrolling; a stand-in for this file only.
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      value: () => undefined,
      configurable: true,
    });
  });
  afterEach(() => {
    Reflect.deleteProperty(Element.prototype, "scrollIntoView");
    document.body.innerHTML = "";
  });

  it("presses the focused pick's button, then moves on to the next pick", () => {
    picks();
    const pass = spy('[data-sr="p0"] [data-act="pass"]');
    get('[data-sr="p0"] .card-open').focus();
    expect(pressAct("pass")).toBe(true);
    expect(pass).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(get('[data-sr="p1"] .card-open'));
  });

  it("goes back to the card before at the end of the row", () => {
    picks();
    get('[data-sr="p2"] .card-open').focus();
    expect(pressAct("pass")).toBe(true);
    expect(document.activeElement).toBe(get('[data-sr="p1"] .card-open'));
  });

  it("does nothing where the button is off or there's no card in hand", () => {
    picks();
    get('[data-sr="p1"] .card-open').focus();
    expect(pressAct("want")).toBe(false);
    expect(document.activeElement).toBe(get('[data-sr="p1"] .card-open'));
    (document.activeElement as HTMLElement).blur();
    expect(pressAct("want")).toBe(false);
  });

  it("uses the details pane's button for the card it shows, and shows the next one", () => {
    picks();
    const tile = spy('[data-sr="p0"] [data-act="want"]');
    document.body.insertAdjacentHTML(
      "beforeend",
      `<aside class="pane" data-for="p0"><button data-act="want"></button></aside>`,
    );
    const want = spy('.pane [data-act="want"]');
    const open = spy('[data-sr="p1"] .card-open');
    expect(pressAct("want")).toBe(true);
    expect(want).toHaveBeenCalledOnce();
    expect(tile).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledOnce();
  });

  it("acts on the card the pane shows when focus is in it, not on another", () => {
    picks();
    document.body.insertAdjacentHTML(
      "beforeend",
      `<aside class="pane" data-for="p2"><button id="x"></button></aside>`,
    );
    const other = spy('[data-sr="p0"] [data-act="pass"]');
    const shown = spy('[data-sr="p2"] [data-act="pass"]');
    get("#x").focus();
    expect(pressAct("pass")).toBe(true);
    expect(shown).toHaveBeenCalledOnce();
    expect(other).not.toHaveBeenCalled();
  });
});

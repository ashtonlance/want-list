import type { ParsedLocation } from "@tanstack/react-router";
import { canTransition, viewTransitionsSupported } from "~/lib/motion";
import { isDesktop } from "~/lib/useMediaQuery";
import { detailOf } from "./search";
import { sectionOf } from "./sections";

/**
 * Which view transition a navigation gets (styles/motion.css draws each one):
 * - "forward" / "back": a new screen, sliding the way the tab bar reads (My list, Explore, Binders).
 *   "within" is added for a move inside one section (Browse to For you), so its own tabs stay put.
 * - "sheet-close": a sheet kept in the address closing, by its button, a drag or the back button (not
 *   the desktop details pane, which slides away by itself).
 * - none: anything else. Opening a sheet has its own entrance, and filters change in place.
 */

/** Where each screen sits, left to right; a screen inside another sits just after it. */
function rank(pathname: string): number {
  if (pathname.startsWith("/explore/picks")) return 1.5;
  if (pathname.startsWith("/explore")) return 1;
  if (pathname.startsWith("/binders/scan")) return 2.5;
  if (pathname.startsWith("/binders")) return 2;
  return 0;
}

/** Search keys that open a sheet over the screen (app/search.ts and the binder sheets). */
const OVERLAY_KEYS = ["card", "pick", "live", "panel", "sheet", "pocket"] as const;

const hasOverlay = (loc: ParsedLocation): boolean => {
  const s = loc.search as Record<string, unknown>;
  return OVERLAY_KEYS.some((k) => s[k] != null && s[k] !== "");
};

/** Whether `loc` shows a card's details in the desktop pane rather than a sheet. */
const docked = (loc: ParsedLocation): boolean => detailOf(loc.search) !== undefined && isDesktop();

export function transitionTypes(info: {
  fromLocation?: ParsedLocation;
  toLocation: ParsedLocation;
  pathChanged: boolean;
}): string[] | false {
  const { fromLocation: from, toLocation: to, pathChanged } = info;
  if (!from || !canTransition()) return false;
  if (pathChanged) {
    const d = rank(to.pathname) - rank(from.pathname);
    const types = [d > 0 ? "forward" : d < 0 ? "back" : "fade"];
    if (sectionOf(from.pathname) === sectionOf(to.pathname)) types.push("within");
    return types;
  }
  // The desktop details pane slides away by itself (app/overlayNav.ts), and the grid it narrowed has to
  // regroup its rows as it widens, which a transition would hold back until it ended.
  if (hasOverlay(from) && !hasOverlay(to)) return docked(from) ? false : ["sheet-close"];
  return false;
}

/**
 * The router's default. The router only reads `types` where the browser supports them, and otherwise
 * would run a plain transition on every change, so it's off entirely there.
 */
export const defaultViewTransition = viewTransitionsSupported ? { types: transitionTypes } : false;

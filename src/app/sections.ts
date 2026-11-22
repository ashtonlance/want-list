import { prefs, type ExploreTab, type Section } from "./prefs";

/** The three tabs at the bottom of the screen, by path. */
export function sectionOf(pathname: string): Section {
  if (pathname.startsWith("/explore")) return "explore";
  if (pathname.startsWith("/binders")) return "binders";
  return "list";
}

export const exploreTabOf = (pathname: string): ExploreTab =>
  pathname.startsWith("/explore/picks") ? "picks" : "live";

export const explorePath = (tab: ExploreTab) => (tab === "picks" ? "/explore/picks" : "/explore");

/**
 * Opening the app at its home address lands on the tab used last, the way the earlier version did.
 * Runs once before the router reads the address.
 */
export function restoreLastSection(base: string): void {
  const root = base.endsWith("/") ? base : base + "/";
  if (location.pathname !== root || location.search || location.hash) return;
  const section = prefs.section.get();
  if (section === "list") return;
  const path = section === "binders" ? "binders" : explorePath(prefs.exploreTab.get()).slice(1);
  history.replaceState(history.state, "", root + path);
}

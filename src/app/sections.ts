import { defaultStringifySearch } from "@tanstack/react-router";
import { tabSearch } from "~/features/explore/state";
import { prefs, type ExploreTab, type Section } from "./prefs";

/** The read-only want list page that's shared with family. It sits outside the tabs. */
export const isSharePath = (pathname: string): boolean =>
  pathname === "/share" || pathname.startsWith("/share/");

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
 * Opening the app at its home address lands on the tab used last, the way the earlier version did, and on
 * Explore with the search or collection it last showed. An installed app the phone closed in the background
 * reopens at its home address, so this is what brings it back to where it was. Runs once before the router
 * reads the address.
 */
export function restoreLastSection(base: string): void {
  const root = base.endsWith("/") ? base : base + "/";
  if (location.pathname !== root || location.search || location.hash) return;
  const section = prefs.section.get();
  if (section === "list") return;
  if (section === "binders") {
    history.replaceState(history.state, "", root + "binders");
    return;
  }
  const tab = prefs.exploreTab.get();
  const search = defaultStringifySearch({ ...tabSearch.get()[tab] });
  history.replaceState(history.state, "", root + explorePath(tab).slice(1) + search);
}

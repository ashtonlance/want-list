import { useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { prefs } from "./prefs";
import { exploreTabOf, sectionOf } from "./sections";

/** Remembers the tab in use, so reopening the app lands there. */
export function useSectionMemory(): void {
  const pathname = useLocation({ select: (l) => l.pathname });
  useEffect(() => {
    const section = sectionOf(pathname);
    prefs.section.set(section);
    if (section === "explore") prefs.exploreTab.set(exploreTabOf(pathname));
  }, [pathname]);
}

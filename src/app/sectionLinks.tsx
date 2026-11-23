import { useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import type { MouseEvent, ReactNode } from "react";
import { prefersReducedMotion } from "~/lib/motion";
import { tabSearch } from "~/features/explore/state";
import { BinderIcon, CompassIcon, ListIcon } from "~/ui/icons";
import { prefs, type Section } from "./prefs";
import { explorePath, sectionOf } from "./sections";

const SECTIONS: { section: Section; label: string; icon: ReactNode }[] = [
  { section: "list", label: "My list", icon: <ListIcon /> },
  { section: "explore", label: "Explore", icon: <CompassIcon /> },
  { section: "binders", label: "Binders", icon: <BinderIcon /> },
];

/** Where a section's link goes. Explore returns to the search or collection it was showing. */
function targetOf(section: Section): { to: string; search?: Record<string, string | undefined> } {
  if (section === "list") return { to: "/" };
  if (section === "binders") return { to: "/binders" };
  const tab = prefs.exploreTab.get();
  return { to: explorePath(tab), search: { ...tabSearch.get()[tab] } };
}

/** A click the browser should handle itself: a new tab or window, or a download. */
const opensElsewhere = (e: MouseEvent) => e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

export interface SectionLink {
  section: Section;
  label: string;
  icon: ReactNode;
  href: string;
  current: boolean;
  onClick: (e: MouseEvent) => void;
}

/** The three sections, as links for the phone's tab bar and the desktop side bar. */
export function useSectionLinks(): SectionLink[] {
  const current = sectionOf(useLocation({ select: (l) => l.pathname }));
  const navigate = useNavigate();
  const router = useRouter();
  return SECTIONS.map((s) => ({
    ...s,
    // A real address, so a section can open in a new window; a plain click is handled in onClick.
    href: router.history.createHref(router.buildLocation(targetOf(s.section)).publicHref),
    current: current === s.section,
    onClick: (e) => {
      if (opensElsewhere(e)) return;
      e.preventDefault();
      // Picking the section you're on goes back to the top, like any phone app.
      if (current === s.section)
        window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
      else void navigate(targetOf(s.section));
    },
  }));
}

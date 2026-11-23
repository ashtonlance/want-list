import { useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import type { MouseEvent, ReactNode } from "react";
import { prefersReducedMotion } from "~/lib/motion";
import { tabSearch } from "~/features/explore/state";
import { BinderIcon, CompassIcon, ListIcon } from "~/ui/icons";
import { prefs, type Section } from "./prefs";
import { explorePath, sectionOf } from "./sections";

const TABS: { section: Section; label: string; icon: ReactNode }[] = [
  { section: "list", label: "My list", icon: <ListIcon /> },
  { section: "explore", label: "Explore", icon: <CompassIcon /> },
  { section: "binders", label: "Binders", icon: <BinderIcon /> },
];

/** Where a section's tab goes. Explore returns to the search or collection it was showing. */
function targetOf(section: Section): { to: string; search?: Record<string, string | undefined> } {
  if (section === "list") return { to: "/" };
  if (section === "binders") return { to: "/binders" };
  const tab = prefs.exploreTab.get();
  return { to: explorePath(tab), search: { ...tabSearch.get()[tab] } };
}

/** A click the browser should handle itself: a new tab or window, or a download. */
const opensElsewhere = (e: MouseEvent) => e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

export function TabBar() {
  const current = sectionOf(useLocation({ select: (l) => l.pathname }));
  const navigate = useNavigate();
  const router = useRouter();
  // A real address, so a tab can open in a new window; a plain tap is handled below.
  const hrefOf = (section: Section) =>
    router.history.createHref(router.buildLocation(targetOf(section)).publicHref);
  return (
    <nav className="tabbar" aria-label="Sections">
      <div className="tabs">
        {TABS.map((t) => (
          <a
            key={t.section}
            href={hrefOf(t.section)}
            aria-current={current === t.section ? "page" : undefined}
            onClick={(e) => {
              if (opensElsewhere(e)) return;
              e.preventDefault();
              // Tapping the tab you're on goes back to the top, like any phone app.
              if (current === t.section)
                window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
              else void navigate(targetOf(t.section));
            }}
          >
            {t.icon}
            {t.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

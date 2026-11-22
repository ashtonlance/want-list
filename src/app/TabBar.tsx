import { useLocation, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BinderIcon, CompassIcon, ListIcon } from "~/ui/icons";
import { prefs, type Section } from "./prefs";
import { explorePath, sectionOf } from "./sections";

const TABS: { section: Section; label: string; icon: ReactNode }[] = [
  { section: "list", label: "My list", icon: <ListIcon /> },
  { section: "explore", label: "Explore", icon: <CompassIcon /> },
  { section: "binders", label: "Binders", icon: <BinderIcon /> },
];

const pathOf = (section: Section): string =>
  section === "list" ? "/" : section === "binders" ? "/binders" : explorePath(prefs.exploreTab.get());

export function TabBar() {
  const current = sectionOf(useLocation({ select: (l) => l.pathname }));
  const navigate = useNavigate();
  return (
    <nav className="tabbar" aria-label="Sections">
      <div className="tabs" role="group" aria-label="Mode">
        {TABS.map((t) => (
          <button
            key={t.section}
            type="button"
            aria-pressed={current === t.section}
            onClick={() => {
              // Tapping the tab you're on goes back to the top, like any phone app.
              if (current === t.section) window.scrollTo({ top: 0, behavior: "smooth" });
              else void navigate({ to: pathOf(t.section) });
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

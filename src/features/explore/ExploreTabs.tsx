import { useLocation, useNavigate } from "@tanstack/react-router";
import type { ExploreTab } from "~/app/prefs";
import { exploreTabOf } from "~/app/sections";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { tabSearch } from "./state";

const TABS: readonly { value: ExploreTab; label: string }[] = [
  { value: "live", label: "Browse" },
  { value: "picks", label: "For you" },
];

/**
 * The Browse and For you switch. It sits in the top bar in place of the "Explore" title, so the cards
 * start higher; each tab comes back with its own search.
 */
export function ExploreTabs() {
  const navigate = useNavigate();
  const tab = exploreTabOf(useLocation({ select: (l) => l.pathname }));
  const switchTo = (next: ExploreTab) => {
    if (next === tab) return;
    const saved = tabSearch.get();
    void (next === "picks"
      ? navigate({ to: "/explore/picks", search: saved.picks })
      : navigate({ to: "/explore", search: saved.live }));
  };

  // A slimmer segmented control (shadcn/ui Toggle Group) than elsewhere, to fit the top bar.
  return (
    <ToggleGroup
      type="single"
      aria-label="Explore source"
      // ex-seg names its view transition (styles/motion.css).
      className="ex-seg flex w-full max-w-60"
      value={tab}
      // Tapping the chosen tab again would clear it; one is always chosen.
      onValueChange={(v) => {
        const hit = TABS.find((t) => t.value === v);
        if (hit) switchTo(hit.value);
      }}
    >
      {TABS.map((t) => (
        <ToggleGroupItem key={t.value} value={t.value} className="min-h-[30px] px-3 py-1">
          {t.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

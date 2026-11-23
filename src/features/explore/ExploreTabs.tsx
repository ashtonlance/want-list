import { useLocation, useNavigate } from "@tanstack/react-router";
import type { ExploreTab } from "~/app/prefs";
import { exploreTabOf } from "~/app/sections";
import { Seg } from "~/ui/Seg";
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

  return <Seg label="Explore source" className="ex-seg" value={tab} options={TABS} onChange={switchTo} />;
}

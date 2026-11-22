import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import type { ExploreTab } from "~/app/prefs";
import { exploreTabOf } from "~/app/sections";
import { Seg } from "~/ui/Seg";
import { validateLiveSearch, validatePicksSearch } from "./search";
import { tabSearch } from "./state";

const TABS: readonly { value: ExploreTab; label: string }[] = [
  { value: "live", label: "Live" },
  { value: "picks", label: "Picks for you" },
];

/** Explore: live card data or Claude's picks, each tab keeping its own search. */
export function ExploreLayout() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const tab = exploreTabOf(pathname);

  useEffect(() => {
    tabSearch.set((prev) =>
      tab === "picks"
        ? { ...prev, picks: validatePicksSearch(search) }
        : { ...prev, live: validateLiveSearch(search) },
    );
  }, [tab, search]);

  const switchTo = (next: ExploreTab) => {
    if (next === tab) return;
    const saved = tabSearch.get();
    void (next === "picks"
      ? navigate({ to: "/explore/picks", search: saved.picks })
      : navigate({ to: "/explore", search: saved.live }));
  };

  return (
    <>
      <Seg label="Explore source" className="ex-seg" value={tab} options={TABS} onChange={switchTo} />
      <Outlet />
    </>
  );
}

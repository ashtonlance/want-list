import { Outlet, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { exploreTabOf } from "~/app/sections";
import { validateLiveSearch, validatePicksSearch } from "./search";
import { tabSearch } from "./state";

/** Explore: Browse (every card, sets, search) and For you (picks), each tab keeping its own search. */
export function ExploreLayout() {
  const { pathname, search } = useLocation();
  const tab = exploreTabOf(pathname);

  useEffect(() => {
    tabSearch.set((prev) =>
      tab === "picks"
        ? { ...prev, picks: validatePicksSearch(search) }
        : { ...prev, live: validateLiveSearch(search) },
    );
  }, [tab, search]);

  return <Outlet />;
}

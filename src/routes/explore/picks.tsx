import { createFileRoute } from "@tanstack/react-router";
import { PicksView } from "~/features/explore/PicksView";
import { validatePicksSearch } from "~/features/explore/search";

export const Route = createFileRoute("/explore/picks")({
  validateSearch: validatePicksSearch,
  component: PicksView,
});

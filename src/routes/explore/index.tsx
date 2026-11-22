import { createFileRoute } from "@tanstack/react-router";
import { LiveView } from "~/features/explore/LiveView";
import { validateLiveSearch } from "~/features/explore/search";

export const Route = createFileRoute("/explore/")({
  validateSearch: validateLiveSearch,
  component: LiveView,
});

import { createFileRoute } from "@tanstack/react-router";
import { BindersView } from "~/features/binders/BindersView";
import { validateBindersSearch } from "~/features/binders/search";

export const Route = createFileRoute("/binders/")({
  validateSearch: validateBindersSearch,
  component: BindersView,
});

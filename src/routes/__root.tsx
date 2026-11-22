import { createRootRoute } from "@tanstack/react-router";
import { validateRootSearch } from "~/app/search";
import { Shell } from "~/app/Shell";

export const Route = createRootRoute({ validateSearch: validateRootSearch, component: Shell });

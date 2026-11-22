import { createFileRoute } from "@tanstack/react-router";
import { ExploreLayout } from "~/features/explore/ExploreLayout";

export const Route = createFileRoute("/explore")({ component: ExploreLayout });

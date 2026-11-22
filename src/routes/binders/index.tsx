import { createFileRoute } from "@tanstack/react-router";
import { BindersView } from "~/features/binders/BindersView";

export const Route = createFileRoute("/binders/")({ component: BindersView });

import { createFileRoute } from "@tanstack/react-router";
import { ListView } from "~/features/list/ListView";

export const Route = createFileRoute("/")({ component: ListView });

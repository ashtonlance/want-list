import { createFileRoute } from "@tanstack/react-router";
import { ShareView } from "~/features/share/ShareView";
import { str } from "~/lib/json";

export const Route = createFileRoute("/share")({
  validateSearch: (s: Record<string, unknown>): { c?: string } => ({ c: str(s.c) || undefined }),
  component: function SharePage() {
    const { c } = Route.useSearch();
    return <ShareView coll={c ?? null} />;
  },
});

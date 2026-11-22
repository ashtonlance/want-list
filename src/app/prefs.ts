import type { ListSort } from "~/features/cards/filters";
import { LIST_SORTS } from "~/features/cards/filters";
import { createPersistedStore } from "~/lib/store";

/** Choices the app remembers between visits, saved under the same keys the earlier version used. */

const nullable = (raw: string | null): string | null => raw || null;
const fromNullable = (v: string | null): string => v ?? "";

export type Section = "list" | "explore" | "binders";
export type ExploreTab = "live" | "picks";
export type Pockets = 4 | 9 | 12;
export type ListLayout = "grid" | "rows";
export type CollView = "list" | "binder";

export const POCKETS: readonly Pockets[] = [4, 9, 12];
export const asPockets = (n: number): Pockets | null => POCKETS.find((p) => p === n) ?? null;

export const prefs = {
  coll: createPersistedStore("wl-coll", nullable, fromNullable),
  view: createPersistedStore<CollView>("wl-view", (r) => (r === "binder" ? "binder" : "list")),
  pockets: createPersistedStore<Pockets>("wl-pockets", (r) => asPockets(Number(r)) ?? 9),
  sort: createPersistedStore<ListSort>("wl-sort", (r) => LIST_SORTS.find((s) => s.value === r)?.value ?? "list"),
  layout: createPersistedStore<ListLayout>("wl-layout", (r) => (r === "rows" ? "rows" : "grid")),
  section: createPersistedStore<Section>("wl-mode", (r) => (r === "explore" || r === "binders" ? r : "list")),
  exploreTab: createPersistedStore<ExploreTab>("wl-extab", (r) => (r === "picks" ? "picks" : "live")),
  binder: createPersistedStore("wl-binder", nullable, fromNullable),
};

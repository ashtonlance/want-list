import { useEffect } from "react";
import { useCollections } from "~/features/cards/useCollections";
import { patchLiveUi, useLiveUi } from "./state";

/**
 * The saved "Quick add goes to" collection, when it still exists. A collection deleted or renamed since,
 * maybe on another device, gives "", so quick adds never land in a collection no screen shows. Until the
 * collections have loaded there's nothing to check against, so the saved choice stands.
 */
export function quickAddTarget(addTo: string, names: readonly string[], loaded: boolean): string {
  return !loaded || names.includes(addTo) ? addTo : "";
}

/** Explore's quick add collection, checked against the current collections; a stale one is cleared. */
export function useQuickAddTo(): string {
  const { addTo } = useLiveUi();
  const { collections, loaded } = useCollections();
  const names = collections.map((c) => c.name);
  const target = quickAddTarget(addTo, names, loaded);
  const stale = loaded && addTo !== "" && target === "";
  useEffect(() => {
    if (stale) patchLiveUi({ addTo: "" });
  }, [stale]);
  return target;
}

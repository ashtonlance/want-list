import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { Query } from "@tanstack/react-query";
import { del, get, set } from "idb-keyval";

/** How long a saved copy of the list is good for: a week of opening the app offline. */
export const PERSIST_MAX_AGE = 7 * 24 * 60 * 60_000;

/** Bump when a saved query's data changes shape, so old copies are dropped instead of misread. */
export const PERSIST_BUSTER = "1";

/**
 * Queries saved between visits, so the list, binders and picks show at once and work offline. The catalog is
 * left out: it's 2.4 MB and the service worker already keeps the file.
 */
const SAVED = new Set(["cards", "discover", "layouts", "prices", "editor", "tcgdex"]);

export const shouldPersistQuery = (q: Pick<Query, "state" | "queryKey">): boolean =>
  q.state.status === "success" && SAVED.has(String(q.queryKey[0]));

/** Saved in IndexedDB, which holds far more than localStorage and doesn't block the page while writing. */
export const queryPersister = createAsyncStoragePersister({
  storage: { getItem: (key) => get<string>(key), setItem: set, removeItem: del },
  key: "poke-cards:queries",
  throttleTime: 1000,
});

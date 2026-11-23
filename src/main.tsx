import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { defaultViewTransition } from "./app/pageTransition";
import { restoreLastSection } from "./app/sections";
import { PERSIST_BUSTER, PERSIST_MAX_AGE, queryPersister, shouldPersistQuery } from "./data/persist";
import { routeTree } from "./routeTree.gen";
import "./styles/index.css";

// The app keeps its own scroll positions per view (see lib/scroll.ts), so the browser shouldn't.
history.scrollRestoration = "manual";
restoreLastSection(import.meta.env.BASE_URL);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // Kept as long as the saved copy, so what was loaded can be written back for the next visit.
      gcTime: PERSIST_MAX_AGE,
      retry: 2,
      refetchOnWindowFocus: true,
      // Offline, still ask once: the service worker answers from its cache (the catalog, prices, card data).
      // Only a request that then fails waits for the connection to come back.
      networkMode: "offlineFirst",
    },
  },
});

const router = createRouter({
  routeTree,
  basepath: import.meta.env.BASE_URL,
  defaultPreload: "intent",
  // Views restore their own scroll position once their content is on screen.
  scrollRestoration: () => false,
  // Screens slide the way the tab bar reads, and sheets slide away as they close (app/pageTransition.ts).
  defaultViewTransition,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const root = document.getElementById("root");
if (!root) throw new Error("index.html needs a #root element");

createRoot(root).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: PERSIST_MAX_AGE,
        buster: PERSIST_BUSTER,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
      }}
    >
      <RouterProvider router={router} />
    </PersistQueryClientProvider>
  </StrictMode>,
);

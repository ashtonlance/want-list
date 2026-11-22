import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { restoreLastSection } from "./app/sections";
import { routeTree } from "./routeTree.gen";
import "./styles/index.css";

// The app keeps its own scroll positions per view (see lib/scroll.ts), so the browser shouldn't.
history.scrollRestoration = "manual";
restoreLastSection(import.meta.env.BASE_URL);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 2, refetchOnWindowFocus: true },
  },
});

const router = createRouter({
  routeTree,
  basepath: import.meta.env.BASE_URL,
  defaultPreload: "intent",
  // Views restore their own scroll position once their content is on screen.
  scrollRestoration: () => false,
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
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);

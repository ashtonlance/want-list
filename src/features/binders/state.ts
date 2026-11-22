import { createStore, useStore } from "~/lib/store";

/** The page each binder is open to. Kept outside the screen so it survives a trip to another tab. */
const pages = createStore<Readonly<Record<string, number>>>({});

export const useBinderPage = (id: string | undefined): number => {
  const all = useStore(pages);
  return id ? (all[id] ?? 0) : 0;
};

export const setBinderPage = (id: string, page: number): void =>
  pages.set((prev) => ({ ...prev, [id]: page }));

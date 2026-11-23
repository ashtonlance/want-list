import { createContext, useContext } from "react";

/**
 * Where a screen's collections, sets or binders go on a desktop: a place in the side bar (app/SideNav).
 * Null on a phone, where the same choices stay a row of chips above the cards (ui/Rail).
 */
export const SideSlot = createContext<HTMLElement | null>(null);

/** Whether rails show in the side bar, for a screen that lists its choices differently there. */
export const useInSideBar = () => useContext(SideSlot) !== null;

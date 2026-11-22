import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";
import type { SheetState } from "./BinderSheet";
import { searchOf, sheetOf } from "./search";

const NO_SHEET = { sheet: undefined, pocket: undefined };

/**
 * The binder sheet kept in the address. Opening one over another replaces it, so a single back step
 * closes whichever sheet is showing.
 */
export function useBinderSheet() {
  const search = useSearch({ from: "/binders/" });
  const navigate = useNavigate({ from: "/binders/" });
  const router = useRouter();
  const sheet = sheetOf(search);
  const isOpen = sheet !== null;

  const open = useCallback(
    (next: SheetState) =>
      void navigate({
        search: (prev) => ({ ...prev, ...searchOf(next) }),
        state: (prev) => ({ ...prev, overlay: true }),
        replace: isOpen,
        resetScroll: false,
      }),
    [navigate, isOpen],
  );

  const close = useCallback(() => {
    if (router.state.location.state.overlay) {
      router.history.back();
      return;
    }
    void navigate({ search: (prev) => ({ ...prev, ...NO_SHEET }), replace: true, resetScroll: false });
  }, [navigate, router]);

  return { sheet, open, close };
}

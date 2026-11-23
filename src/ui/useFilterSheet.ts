import { useCallback, useState } from "react";
import { closeSheet } from "~/lib/motion";

/** Open state for a filter sheet (ui/Filters.tsx); closing slides it down like the sheets kept in the address. */
export function useFilterSheet(): { open: boolean; show: () => void; hide: () => void } {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => closeSheet(() => setOpen(false)), []);
  return { open, show, hide };
}

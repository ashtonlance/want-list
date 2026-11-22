import { useCallback } from "react";
import { useToast } from "~/ui/Toast";
import type { Slots } from "./slots";
import type { Binder } from "./types";
import type { BindersApi } from "./useBinders";

/** Saves new slots for a binder and offers Undo, which puts the binder's slots back as they were. */
export function useSlotChange(save: BindersApi["save"]) {
  const { toastUndo } = useToast();
  return useCallback(
    (b: Binder, slots: Slots, message: string) => {
      void save({ ...b, slots });
      toastUndo(message, () => void save(b, "Undone"));
    },
    [save, toastUndo],
  );
}

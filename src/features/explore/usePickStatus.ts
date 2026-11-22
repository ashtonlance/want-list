import { useCallback } from "react";
import { useDocWrite } from "~/data/useDocs";
import { useToast } from "~/ui/Toast";
import { statusPatch, type PickCard, type PickStatus } from "./picks";

/**
 * Passes on a pick or brings it back, saving the whole pick the first time for a refill pick.
 * From a tile the toast offers Undo, since the tile goes away.
 */
export function usePickStatus(): (p: PickCard, status: PickStatus, withUndo?: boolean) => Promise<void> {
  const discover = useDocWrite("discover");
  const { toast, toastUndo } = useToast();
  const { mutateAsync } = discover;
  const write = useCallback(
    async (p: PickCard, status: PickStatus): Promise<boolean> => {
      try {
        await mutateAsync({ kind: "merge", id: p.id, patch: statusPatch(p, status) });
        return true;
      } catch {
        toast("Couldn't save that. Try again.");
        return false;
      }
    },
    [mutateAsync, toast],
  );
  const save = useCallback(
    async (p: PickCard, status: PickStatus, withUndo = false): Promise<void> => {
      if (!(await write(p, status))) return;
      const message = status === "passed" ? `Passed on ${p.name}` : `Brought back ${p.name}`;
      if (withUndo && status === "passed")
        // The pick is saved by now, so bringing it back is a plain status change.
        toastUndo(message, () => {
          void write({ ...p, auto: false }, "new").then((ok) => {
            if (ok) toast(`Brought back ${p.name}`);
          });
        });
      else toast(message);
    },
    [write, toast, toastUndo],
  );
  return save;
}

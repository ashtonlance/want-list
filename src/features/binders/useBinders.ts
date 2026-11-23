import { useCallback, useEffect, useMemo } from "react";
import { WriteError, writeFailure } from "~/data/docs";
import { useDocsQuery, useDocWrite } from "~/data/useDocs";
import { useAuth } from "~/features/auth/AuthProvider";
import { isMetaDoc } from "~/features/cards/useCollections";
import { isRecord } from "~/lib/json";
import { createPersistedStore, useStore } from "~/lib/store";
import { useToast } from "~/ui/Toast";
import { binderData, byCreated, parseBinder } from "./parse";
import type { Binder } from "./types";

/**
 * People who can view but not edit the shared binders still get to lay pages out, on this device, starting from
 * copies of the shared ones. Set by an editor's write the database refused (the account lost access).
 */
const viewOnly = createPersistedStore<boolean>(
  "wl-viewonly",
  (r) => r === "1",
  (v) => (v ? "1" : ""),
);

function parseLocal(raw: string | null): Binder[] {
  try {
    const v: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(v)
      ? v.flatMap((b) => (isRecord(b) && typeof b.id === "string" ? [parseBinder(b.id, b)] : []))
      : [];
  } catch {
    return [];
  }
}

const localBinders = createPersistedStore<Binder[]>("wl-binders-local", parseLocal, (list) =>
  JSON.stringify(list.map((b) => ({ id: b.id, ...binderData(b) }))),
);

/** The shared binders, with this device's copies laid over them. */
const merged = (shared: readonly Binder[], local: readonly Binder[]): Binder[] => {
  const mine = new Set(local.map((b) => b.id));
  return [...shared.filter((b) => !mine.has(b.id)), ...local].sort(byCreated);
};

export interface BindersApi {
  binders: Binder[];
  loaded: boolean;
  /** The shared binders couldn't be loaded; `retry` asks again. */
  failed: boolean;
  retry: () => void;
  /** True when changes save on this device only. */
  local: boolean;
  /** Saves a binder (new or changed). Resolves false if it didn't save anywhere. */
  save: (b: Binder, message?: string) => Promise<boolean>;
  remove: (b: Binder) => Promise<void>;
  /** Binders made or changed on this device that the shared binders don't have, for an editor to move over. */
  deviceOnly: Binder[];
  moveDeviceBinders: () => Promise<void>;
  discardDeviceBinders: () => void;
}

export function useBinders(): BindersApi {
  const docs = useDocsQuery("layouts");
  const write = useDocWrite("layouts");
  const { canWrite, ready } = useAuth();
  const flagged = useStore(viewOnly);
  const mine = useStore(localBinders);
  const { toast, toastUndo } = useToast();
  // Anyone who can't edit works on this device from the start, so they know before their first change.
  const local = !canWrite && (ready || flagged);

  // A confirmed editor edits the shared binders again.
  useEffect(() => {
    if (canWrite && flagged) viewOnly.set(false);
  }, [canWrite, flagged]);

  const shared = useMemo(
    () =>
      (docs.data ?? [])
        .filter((d) => !isMetaDoc(d.id))
        .map((d) => parseBinder(d.id, d.data))
        .sort(byCreated),
    [docs.data],
  );
  const binders = useMemo(() => (local ? merged(shared, mine) : shared), [local, shared, mine]);

  const saveLocally = useCallback(
    (b: Binder) => {
      const base = merged(shared, localBinders.get());
      localBinders.set(
        base.some((x) => x.id === b.id) ? base.map((x) => (x.id === b.id ? b : x)) : [...base, b],
      );
    },
    [shared],
  );

  const save = useCallback<BindersApi["save"]>(
    async (b, message) => {
      const next = { ...b, updatedAt: new Date().toISOString() };
      if (local) {
        saveLocally(next);
        if (message) toast(message);
        return true;
      }
      try {
        await write.mutateAsync({ kind: "set", id: next.id, data: binderData(next) });
        if (message) toast(message);
      } catch (e) {
        if (!(e instanceof WriteError && e.code === "denied")) {
          toast(writeFailure(e, "Couldn't save. Check your connection and try again."));
          return false;
        }
        viewOnly.set(true);
        saveLocally(next);
        toast("Saved on this device. Sign in to save to the shared binders.");
      }
      return true;
    },
    [local, saveLocally, write, toast],
  );

  const remove = useCallback<BindersApi["remove"]>(
    async (b) => {
      if (local) localBinders.set(merged(shared, localBinders.get()).filter((x) => x.id !== b.id));
      else
        try {
          await write.mutateAsync({ kind: "delete", id: b.id });
        } catch (e) {
          if (e instanceof WriteError && e.code === "denied")
            toast("You can view the shared binders but not delete them");
          else toast(writeFailure(e, "Couldn't delete it. Check your connection and try again."));
          return;
        }
      // Saving the same binder again brings it back as it was.
      toastUndo(`Deleted ${b.name}. Your cards are untouched.`, () => {
        void save(b, `Put ${b.name} back`);
      });
    },
    [local, shared, write, toast, toastUndo, save],
  );

  const deviceOnly = useMemo(() => {
    if (!canWrite) return [];
    const byId = new Map(shared.map((b) => [b.id, b]));
    return mine.filter((b) => {
      const s = byId.get(b.id);
      return !s || b.updatedAt > s.updatedAt;
    });
  }, [canWrite, shared, mine]);

  const moveDeviceBinders = useCallback(async () => {
    let moved = 0;
    for (const b of deviceOnly)
      try {
        await write.mutateAsync({ kind: "set", id: b.id, data: binderData(b) });
        moved++;
      } catch {
        // Counted below; the rest stay on this device to try again.
      }
    if (moved === deviceOnly.length) {
      localBinders.set([]);
      toast(`Moved ${moved === 1 ? "1 binder" : `${moved} binders`} to the shared binders`);
    } else toast(writeFailure(undefined, `Moved ${moved} of ${deviceOnly.length}. Try again for the rest.`));
  }, [deviceOnly, write, toast]);

  const discardDeviceBinders = useCallback(() => {
    const kept = localBinders.get();
    localBinders.set([]);
    toastUndo("Removed the binders saved on this device", () => localBinders.set(kept));
  }, [toastUndo]);

  const { refetch } = docs;
  const retry = useCallback(() => void refetch(), [refetch]);

  return {
    binders,
    loaded: docs.data !== undefined || local,
    failed: docs.isError && docs.data === undefined && !local,
    retry,
    local,
    save,
    remove,
    deviceOnly,
    moveDeviceBinders,
    discardDeviceBinders,
  };
}

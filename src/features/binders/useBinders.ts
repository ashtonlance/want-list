import { useCallback, useEffect, useMemo } from "react";
import { WriteError, writeFailure } from "~/data/docs";
import { useDocsQuery, useDocWrite } from "~/data/useDocs";
import { prefs } from "~/app/prefs";
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

/** Binders made or changed on this device. */
const localBinders = createPersistedStore<Binder[]>("wl-binders-local", parseLocal, (list) =>
  JSON.stringify(list.map((b) => ({ id: b.id, ...binderData(b) }))),
);

/** Shared binders deleted on this device, so they stay hidden here. */
const localDeleted = createPersistedStore<string[]>(
  "wl-binders-local-deleted",
  (raw) => {
    try {
      const v: unknown = JSON.parse(raw ?? "[]");
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  },
  (ids) => JSON.stringify(ids),
);

/** The shared binders, with this device's changes and deletions laid over them. */
const merged = (
  shared: readonly Binder[],
  local: readonly Binder[],
  deleted: readonly string[],
): Binder[] => {
  const hidden = new Set([...local.map((b) => b.id), ...deleted]);
  return [...shared.filter((b) => !hidden.has(b.id)), ...local].sort(byCreated);
};

/** A device copy worth moving to the shared binders: new there, or changed here since the shared copy. */
const isNewer = (b: Binder, shared: ReadonlyMap<string, Binder>): boolean => {
  const s = shared.get(b.id);
  return !s || b.updatedAt > s.updatedAt;
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
  const { canWrite, cantEdit, markReadOnly } = useAuth();
  const flagged = useStore(viewOnly);
  const mine = useStore(localBinders);
  const deleted = useStore(localDeleted);
  const { toast, toastUndo } = useToast();
  // Anyone known not to be an editor works on this device from the start, so they know before their first
  // change. An editor whose check failed keeps the shared binders, and a refused write still switches over.
  const local = !canWrite && (cantEdit || flagged);

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
  const binders = useMemo(
    () => (local ? merged(shared, mine, deleted) : shared),
    [local, shared, mine, deleted],
  );

  const saveLocally = useCallback((b: Binder) => {
    const list = localBinders.get();
    localBinders.set(
      list.some((x) => x.id === b.id) ? list.map((x) => (x.id === b.id ? b : x)) : [...list, b],
    );
    localDeleted.set(localDeleted.get().filter((id) => id !== b.id));
  }, []);

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
        // The account can't edit after all: switch to this device, and say where the change went.
        markReadOnly();
        viewOnly.set(true);
        saveLocally(next);
        toast("Saved on this device. Sign in to save to the shared binders.");
      }
      return true;
    },
    [local, saveLocally, write, toast, markReadOnly],
  );

  const remove = useCallback<BindersApi["remove"]>(
    async (b) => {
      if (local) {
        const keptLocal = localBinders.get();
        const keptDeleted = localDeleted.get();
        localBinders.set(keptLocal.filter((x) => x.id !== b.id));
        if (shared.some((x) => x.id === b.id)) localDeleted.set([...keptDeleted, b.id]);
        // On this device, undo is putting the lists back as they were.
        toastUndo(`Deleted ${b.name}. Your cards are untouched.`, () => {
          localBinders.set(keptLocal);
          localDeleted.set(keptDeleted);
          prefs.binder.set(b.id);
        });
        return;
      }
      try {
        await write.mutateAsync({ kind: "delete", id: b.id });
      } catch (e) {
        if (!(e instanceof WriteError && e.code === "denied")) {
          toast(writeFailure(e, "Couldn't delete it. Check your connection and try again."));
          return;
        }
        // A delete that touched nothing reads as refused; it may just be gone already (deleted elsewhere).
        const fresh = await docs.refetch();
        if (fresh.data?.some((d) => d.id === b.id) ?? true) {
          markReadOnly();
          toast("You can view the shared binders but not delete them");
          return;
        }
      }
      // Saving the same binder again brings it back as it was, and back on screen.
      toastUndo(`Deleted ${b.name}. Your cards are untouched.`, () => {
        prefs.binder.set(b.id);
        void save(b, `Put ${b.name} back`);
      });
    },
    [local, shared, write, docs, toast, toastUndo, save, markReadOnly],
  );

  const deviceOnly = useMemo(() => {
    // Only once the shared binders are known, so a slow or failed load never makes everything look device-only.
    if (!canWrite || !docs.data) return [];
    const byId = new Map(shared.map((b) => [b.id, b]));
    return mine.filter((b) => isNewer(b, byId));
  }, [canWrite, docs.data, shared, mine]);

  const moveDeviceBinders = useCallback(async () => {
    let moved = 0;
    let lastError: unknown;
    for (const b of deviceOnly)
      try {
        await write.mutateAsync({ kind: "set", id: b.id, data: binderData(b) });
        moved++;
      } catch (e) {
        lastError = e;
      }
    if (moved === deviceOnly.length) {
      localBinders.set([]);
      localDeleted.set([]);
      toast(`Moved ${moved === 1 ? "1 binder" : `${moved} binders`} to the shared binders`);
    } else if (lastError instanceof WriteError && lastError.code === "denied") {
      markReadOnly();
      toast("You can view the shared binders but not change them");
    } else toast(writeFailure(lastError, `Moved ${moved} of ${deviceOnly.length}. Try again for the rest.`));
  }, [deviceOnly, write, toast, markReadOnly]);

  const discardDeviceBinders = useCallback(() => {
    const kept = localBinders.get();
    const hidden = localDeleted.get();
    localBinders.set([]);
    localDeleted.set([]);
    toastUndo("Removed the binders saved on this device", () => {
      localBinders.set(kept);
      localDeleted.set(hidden);
    });
  }, [toastUndo]);

  const { refetch } = docs;
  const retry = useCallback(() => void refetch(), [refetch]);

  return {
    binders,
    // On this device, binders saved here show whether or not the shared ones loaded.
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

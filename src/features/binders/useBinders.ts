import { useCallback, useEffect, useMemo } from "react";
import { WriteError } from "~/data/docs";
import { useDocsQuery, useDocWrite } from "~/data/useDocs";
import { useAuth } from "~/features/auth/AuthProvider";
import { isRecord } from "~/lib/json";
import { createPersistedStore, useStore } from "~/lib/store";
import { useToast } from "~/ui/Toast";
import { binderData, byCreated, parseBinder } from "./parse";
import type { Binder } from "./types";

/**
 * People who can view but not edit the shared binders still get to lay pages out: their first refused
 * change switches binders to this device, starting from copies of the shared ones.
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
  /** True when changes save on this device only. */
  local: boolean;
  /** Saves a binder (new or changed). Always resolves true: a refused write saves on this device instead. */
  save: (b: Binder, message?: string) => Promise<boolean>;
  remove: (b: Binder) => Promise<void>;
}

export function useBinders(): BindersApi {
  const docs = useDocsQuery("layouts");
  const write = useDocWrite("layouts");
  const { canWrite } = useAuth();
  const flagged = useStore(viewOnly);
  const mine = useStore(localBinders);
  const { toast } = useToast();
  const local = flagged && !canWrite;

  // A confirmed editor edits the shared binders again.
  useEffect(() => {
    if (canWrite && flagged) viewOnly.set(false);
  }, [canWrite, flagged]);

  const shared = useMemo(
    () => (docs.data ?? []).map((d) => parseBinder(d.id, d.data)).sort(byCreated),
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
        if (!(e instanceof WriteError && e.code === "denied") && canWrite) {
          toast("Couldn't save. Check your connection and try again.");
          return false;
        }
        viewOnly.set(true);
        saveLocally(next);
        toast("Saved on this device. Sign in to save to the shared binders.");
      }
      return true;
    },
    [local, saveLocally, write, toast, canWrite],
  );

  const remove = useCallback<BindersApi["remove"]>(
    async (b) => {
      const done = () => toast("Deleted. Your cards are untouched.");
      if (local) {
        localBinders.set(merged(shared, localBinders.get()).filter((x) => x.id !== b.id));
        done();
        return;
      }
      try {
        await write.mutateAsync({ kind: "delete", id: b.id });
        done();
      } catch {
        viewOnly.set(true);
        localBinders.set(merged(shared, localBinders.get()).filter((x) => x.id !== b.id));
        done();
      }
    },
    [local, shared, write, toast],
  );

  return { binders, loaded: docs.data !== undefined || local, local, save, remove };
}

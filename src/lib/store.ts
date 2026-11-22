import { useSyncExternalStore } from "react";
import { storage } from "./storage";

/** A tiny observable value for UI state that outlives a screen (filters, chosen tabs). */
export interface Store<T> {
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createStore<T>(initial: T, onChange?: (value: T) => void): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      const v = typeof next === "function" ? (next as (prev: T) => T)(value) : next;
      if (Object.is(v, value)) return;
      value = v;
      onChange?.(v);
      for (const l of listeners) l();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** A store saved to localStorage under `key`. `parse` turns the saved text back into a value. */
export function createPersistedStore<T>(
  key: string,
  parse: (raw: string | null) => T,
  serialize: (value: T) => string = String,
): Store<T> {
  return createStore(parse(storage.get(key)), (v) => storage.set(key, serialize(v)));
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

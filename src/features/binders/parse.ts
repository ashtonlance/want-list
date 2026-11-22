import { asPockets } from "~/app/prefs";
import { bool, isRecord, num, str, strish, type JsonRecord } from "~/lib/json";
import type { Binder, Slot } from "./types";

function parseSlot(v: unknown): Slot | null {
  if (!isRecord(v)) return null;
  if (v.k === "c") {
    const id = str(v.id);
    return id ? { k: "c", id } : null;
  }
  if (v.k === "w") {
    const pid = num(v.pid);
    if (pid === undefined) return null;
    return {
      k: "w",
      pid,
      n: str(v.n) ?? "",
      s: str(v.s) ?? "",
      no: strish(v.no) ?? "",
      r: str(v.r) ?? "",
      m: num(v.m) ?? null,
      jp: bool(v.jp) ?? false,
    };
  }
  return null;
}

export function parseBinder(id: string, d: JsonRecord): Binder {
  return {
    id,
    name: str(d.name) || "Binder",
    pockets: asPockets(num(d.pockets) ?? 9) ?? 9,
    slots: Array.isArray(d.slots) ? d.slots.map(parseSlot) : [],
    createdAt: str(d.createdAt) ?? "",
    updatedAt: str(d.updatedAt) ?? "",
  };
}

/** What gets stored for a binder: everything but its id. */
export function binderData(b: Binder): JsonRecord {
  return { name: b.name, pockets: b.pockets, slots: b.slots, createdAt: b.createdAt, updatedAt: b.updatedAt };
}

export const newBinderId = (): string =>
  "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const byCreated = (a: Binder, b: Binder): number => a.createdAt.localeCompare(b.createdAt);

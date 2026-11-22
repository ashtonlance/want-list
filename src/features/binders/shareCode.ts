import { asPockets } from "~/app/prefs";
import { cleanName } from "~/lib/format";
import { isRecord, num, str } from "~/lib/json";
import { newBinderId, parseBinder } from "./parse";
import type { Binder } from "./types";

const PREFIX = "BINDER:";

/** Base64 of the UTF-8 bytes, the same encoding the earlier version's btoa(unescape(encodeURIComponent())) made. */
function toBase64(text: string): string {
  let bin = "";
  for (const byte of new TextEncoder().encode(text)) bin += String.fromCharCode(byte);
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

/** A code someone can paste into Import a shared code to get a copy of this binder's layout. */
export function shareCode(b: Binder): string {
  return PREFIX + toBase64(JSON.stringify({ name: b.name, pockets: b.pockets, slots: b.slots }));
}

/** A new binder from a pasted share code, or null when the code is incomplete or isn't one. */
export function binderFromCode(code: string): Binder | null {
  let d: unknown;
  try {
    d = JSON.parse(fromBase64(code.trim().replace(/^BINDER:/, "")));
  } catch {
    return null;
  }
  if (!isRecord(d) || !Array.isArray(d.slots) || asPockets(num(d.pockets) ?? 0) === null) return null;
  return parseBinder(newBinderId(), {
    ...d,
    name: cleanName(str(d.name)) || "Shared binder",
    createdAt: new Date().toISOString(),
    updatedAt: "",
  });
}

import type { PostgrestError } from "@supabase/supabase-js";
import { isRecord, type JsonRecord } from "~/lib/json";
import { supabase, type Json } from "~/lib/supabase";

export type DocTableName = "cards" | "discover" | "layouts";

/** One row of a list table: its id and the JSON document it holds. */
export interface Doc {
  id: string;
  data: JsonRecord;
}

/**
 * Why a write failed. "denied" means the database refused it (signed out or not an editor);
 * "offline" means the request never reached it; "failed" covers everything else.
 */
export class WriteError extends Error {
  constructor(
    readonly code: "denied" | "offline" | "failed",
    message: string,
  ) {
    super(message);
    this.name = "WriteError";
  }
}

const PAGE = 1000;

/** A request that never got an answer: no connection, or the browser gave up on it. */
const isNetworkError = (message: string): boolean =>
  (typeof navigator !== "undefined" && !navigator.onLine) ||
  /failed to fetch|networkerror|load failed|network request failed/i.test(message);

function writeError(error: PostgrestError | null, fallback: string): WriteError {
  if (!error) return new WriteError("denied", fallback);
  if (isNetworkError(error.message)) return new WriteError("offline", error.message);
  const denied = error.code === "42501" || /row-level security|permission denied|JWT/i.test(error.message);
  return new WriteError(denied ? "denied" : "failed", error.message);
}

/** What to tell someone when a change didn't save: being offline gets its own words. */
export function writeFailure(e: unknown, fallback: string): string {
  const offline = e instanceof WriteError ? e.code === "offline" : isNetworkError(String(e));
  return offline ? "You're offline, so that didn't save. Try again once you're back." : fallback;
}

const isExpiredSession = (error: PostgrestError): boolean =>
  /JWT/i.test(error.message) || error.code === "PGRST301" || error.code === "PGRST303";

/**
 * Runs a request, and if the saved sign-in had expired (the phone slept past the token's hour), refreshes it
 * and tries once more, so a stale token never reads as "not allowed".
 */
async function withSession<R extends { error: PostgrestError | null }>(
  run: () => PromiseLike<R>,
): Promise<R> {
  const first = await run();
  if (!first.error || !isExpiredSession(first.error)) return first;
  const { error } = await supabase.auth.refreshSession();
  return error ? first : run();
}

/** Documents are plain JSON by construction; this is the one place they cross into Supabase's Json type. */
const asJson = (data: JsonRecord): Json => data as Json;

export async function fetchDocs(table: DocTableName): Promise<Doc[]> {
  const all: Doc[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await withSession(() =>
      supabase
        .from(table)
        .select("id,data")
        .order("id")
        .range(from, from + PAGE - 1),
    );
    if (error) throw new Error(error.message);
    for (const row of data) all.push({ id: row.id, data: isRecord(row.data) ? row.data : {} });
    if (data.length < PAGE) return all;
  }
}

export async function setDoc(table: DocTableName, id: string, data: JsonRecord): Promise<void> {
  const { error } = await withSession(() =>
    supabase.from(table).upsert({ id, data: asJson(data), updated_at: new Date().toISOString() }),
  );
  if (error) throw writeError(error, "write refused");
}

/** Merges `patch` into the stored document, reading the latest copy first so other fields survive. */
export async function mergeDoc(table: DocTableName, id: string, patch: JsonRecord): Promise<void> {
  const { data: row, error } = await withSession(() =>
    supabase.from(table).select("data").eq("id", id).maybeSingle(),
  );
  if (error) throw writeError(error, "read refused");
  const base = row && isRecord(row.data) ? row.data : {};
  await setDoc(table, id, { ...base, ...patch });
}

/**
 * Merges `patch` into a document that already exists, and does nothing when it's gone (so a card
 * deleted meanwhile isn't brought back). Resolves false when there was nothing to change.
 */
export async function patchExistingDoc(table: DocTableName, id: string, patch: JsonRecord): Promise<boolean> {
  const { data: row, error } = await supabase.from(table).select("data").eq("id", id).maybeSingle();
  if (error) throw writeError(error, "read refused");
  if (!row || !isRecord(row.data)) return false;
  const { error: upd, count } = await supabase
    .from(table)
    .update(
      { data: asJson({ ...row.data, ...patch }), updated_at: new Date().toISOString() },
      { count: "exact" },
    )
    .eq("id", id);
  if (upd || count === 0) throw writeError(upd, "write refused");
  return true;
}

export async function deleteDoc(table: DocTableName, id: string): Promise<void> {
  const { error, count } = await withSession(() =>
    supabase.from(table).delete({ count: "exact" }).eq("id", id),
  );
  if (error || count === 0) throw writeError(error, "delete refused");
}

const MAX_PHOTO = 20 * 1024 * 1024;
const PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export class UploadError extends Error {
  constructor(readonly code: "too_large" | "unsupported_type" | "failed") {
    super(code);
    this.name = "UploadError";
  }
}

/** Uploads a card photo to the public "photos" bucket and returns its URL. */
export async function uploadPhoto(file: File): Promise<string> {
  if (file.size > MAX_PHOTO) throw new UploadError("too_large");
  if (file.type && !PHOTO_TYPES.includes(file.type)) throw new UploadError("unsupported_type");
  const path = `${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
  const bucket = supabase.storage.from("photos");
  const { error } = await bucket.upload(path, file, { contentType: file.type });
  if (error) throw new UploadError("failed");
  return bucket.getPublicUrl(path).data.publicUrl;
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteDoc, fetchDocs, mergeDoc, setDoc, updateDoc, type Doc, type DocTableName } from "./docs";
import { docKeys } from "./keys";
import type { JsonRecord } from "~/lib/json";

export function useDocsQuery(table: DocTableName) {
  return useQuery({ queryKey: docKeys[table], queryFn: () => fetchDocs(table) });
}

type DocWrite =
  | { kind: "set"; id: string; data: JsonRecord }
  | { kind: "merge"; id: string; patch: JsonRecord }
  /** Changes the document only if it is still there; `build` must be pure, it runs on the cache too. */
  | { kind: "update"; id: string; build: (data: JsonRecord) => JsonRecord | null }
  | { kind: "delete"; id: string };

/**
 * Writes one document. The cached table updates straight away and rolls back if the write fails,
 * so the screen never waits on the network. Offline, the write is tried anyway and fails at once,
 * rather than waiting silently for a connection and getting lost if the app closes first.
 */
export function useDocWrite(table: DocTableName) {
  const qc = useQueryClient();
  const key = docKeys[table];
  return useMutation({
    networkMode: "always",
    mutationFn: async (w: DocWrite): Promise<JsonRecord | null> => {
      if (w.kind === "update") return updateDoc(table, w.id, w.build);
      if (w.kind === "set") await setDoc(table, w.id, w.data);
      else if (w.kind === "merge") await mergeDoc(table, w.id, w.patch);
      else await deleteDoc(table, w.id);
      return null;
    },
    onMutate: async (w) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Doc[]>(key);
      qc.setQueryData<Doc[]>(key, (docs = []) => applyWrite(docs, w));
      return { prev };
    },
    onSuccess: (stored, w, ctx) => {
      if (w.kind !== "update") return;
      // An update was built from the server's copy, which may differ from the cache's guess; when the
      // server's copy called for no change, the guess is taken back.
      const data = stored ?? ctx.prev?.find((d) => d.id === w.id)?.data;
      if (data)
        qc.setQueryData<Doc[]>(key, (docs = []) => docs.map((d) => (d.id === w.id ? { id: d.id, data } : d)));
    },
    onError: (_e, _w, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
  });
}

function applyWrite(docs: Doc[], w: DocWrite): Doc[] {
  if (w.kind === "delete") return docs.filter((d) => d.id !== w.id);
  const i = docs.findIndex((d) => d.id === w.id);
  const old = i >= 0 ? docs[i] : undefined;
  if (w.kind === "update") {
    const patch = old && w.build(old.data);
    if (!old || !patch) return docs;
    const next = docs.slice();
    next[i] = { id: w.id, data: { ...old.data, ...patch } };
    return next;
  }
  const data = w.kind === "set" ? w.data : { ...(old?.data ?? {}), ...w.patch };
  if (!old) return [...docs, { id: w.id, data }];
  const next = docs.slice();
  next[i] = { id: w.id, data };
  return next;
}

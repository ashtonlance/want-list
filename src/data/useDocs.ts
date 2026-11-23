import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteDoc, fetchDocs, mergeDoc, setDoc, type Doc, type DocTableName } from "./docs";
import { docKeys } from "./keys";
import type { JsonRecord } from "~/lib/json";

export function useDocsQuery(table: DocTableName) {
  return useQuery({ queryKey: docKeys[table], queryFn: () => fetchDocs(table) });
}

type DocWrite =
  | { kind: "set"; id: string; data: JsonRecord }
  | { kind: "merge"; id: string; patch: JsonRecord }
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
    mutationFn: (w: DocWrite) =>
      w.kind === "set"
        ? setDoc(table, w.id, w.data)
        : w.kind === "merge"
          ? mergeDoc(table, w.id, w.patch)
          : deleteDoc(table, w.id),
    onMutate: async (w) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Doc[]>(key);
      qc.setQueryData<Doc[]>(key, (docs = []) => applyWrite(docs, w));
      return { prev };
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
  const data = w.kind === "set" ? w.data : { ...(old?.data ?? {}), ...w.patch };
  if (!old) return [...docs, { id: w.id, data }];
  const next = docs.slice();
  next[i] = { id: w.id, data };
  return next;
}

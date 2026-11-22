import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "~/lib/supabase";
import type { DocTableName } from "./docs";
import { docKeys } from "./keys";

const TABLES: DocTableName[] = ["cards", "discover", "layouts"];

/** Refetches a table whenever anyone changes it, so every open copy of the app stays current. */
export function useRealtimeSync(): void {
  const qc = useQueryClient();
  useEffect(() => {
    const timers = new Map<DocTableName, ReturnType<typeof setTimeout>>();
    const channels = TABLES.map((table) =>
      supabase
        .channel(`rt-${table}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => {
          clearTimeout(timers.get(table));
          timers.set(
            table,
            setTimeout(() => void qc.invalidateQueries({ queryKey: docKeys[table] }), 150),
          );
        })
        .subscribe(),
    );
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      for (const ch of channels) void supabase.removeChannel(ch);
    };
  }, [qc]);
}

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { queryKeys } from "~/data/keys";
import { whenIdle } from "~/lib/idle";
import { parseArt, type ArtIndex } from "./art";

/** art.bin, or null when it isn't there yet (before the first fingerprint run) or can't be read. */
async function fetchArt(): Promise<ArtIndex | null> {
  const r = await fetch(import.meta.env.BASE_URL + "art.bin");
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`art.bin: HTTP ${r.status}`);
  const index = parseArt(await r.arrayBuffer());
  if (import.meta.env.DEV) console.debug(`art.bin: ${String(index.pids.length)} cards`);
  return index;
}

/** True once the browser is idle after the first paint, so the art file never competes with what's on screen. */
function useIdle(): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => whenIdle(() => setIdle(true), 2000), []);
  return idle;
}

/**
 * Art fingerprints for picks. Picks never wait on them: they load in the background after first paint
 * (the service worker keeps the file), and until then, or if the file is missing, this is null.
 */
export function useArtIndex(): ArtIndex | null {
  const idle = useIdle();
  const q = useQuery({
    queryKey: queryKeys.art,
    queryFn: fetchArt,
    enabled: idle,
    // Read once per app start; the service worker fetches the day's new file for the next start.
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
  return q.data ?? null;
}

/**
 * The art index once the work it needs up front is done, one step per idle moment, so the fingerprints
 * arriving never freeze the page. Until then, the previous file, or null. plan lists that work for an
 * input (null while the input is loading); when the input changes before the work is done, the work starts
 * over (steps already done are remembered, so they cost nothing again).
 */
export function useWarmedArt<I>(
  index: ArtIndex | null,
  input: I | null,
  plan: (input: I, index: ArtIndex) => (() => void)[],
): ArtIndex | null {
  const [ready, setReady] = useState<ArtIndex | null>(null);
  const done = ready === index;
  useEffect(() => {
    if (!index || input === null || done) return;
    const steps = plan(input, index);
    let i = 0;
    let cancel: (() => void) | undefined;
    const next = () => {
      const step = steps[i++];
      if (!step) {
        setReady(index);
        return;
      }
      step();
      cancel = whenIdle(next, 1000);
    };
    cancel = whenIdle(next, 1000);
    return () => cancel?.();
  }, [index, input, plan, done]);
  // Until a new file is ready, the last one keeps serving.
  return done ? index : ready;
}

/* One scan's state and the work that reads the pages. */
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { prefs, type Pockets } from "~/app/prefs";
import { useBinders } from "~/features/binders/useBinders";
import { useCards } from "~/features/cards/api";
import { catalogQuery } from "~/features/catalog/catalog";
import { useStore } from "~/lib/store";
import { useToast } from "~/ui/Toast";
import { canvas, context, fileToImage, rectify, release, turned, type Quad } from "./engine/image";
import type { Match } from "./engine/match";
import { getWorker } from "./engine/ocr";
import { indexFor, readPocket } from "./read";
import {
  GRID,
  MARGIN_CORNERS,
  initialState,
  scanReducer,
  type CellState,
  type Photo,
  type ScanCell,
} from "./session";

/** A small picture of the straightened pocket, for review. */
function pocketPhoto(cell: HTMLCanvasElement): string {
  const t = canvas(240, 335);
  context(t).drawImage(cell, 0, 0, 240, 335);
  const url = t.toDataURL("image/jpeg", 0.75);
  release(t);
  return url;
}

function cellOf(photo: string, m: Match): ScanCell {
  const pick = m.conf === "empty" || m.conf === "none" ? null : (m.alts[0] ?? null);
  const state: CellState =
    m.conf === "empty" ? "empty" : !pick ? "none" : m.conf === "high" ? "sure" : "check";
  return { photo, m, pick, state };
}

const scaled = (q: Quad, w: number, h: number): Quad => [
  [q[0][0] * w, q[0][1] * h],
  [q[1][0] * w, q[1][1] * h],
  [q[2][0] * w, q[2][1] * h],
  [q[3][0] * w, q[3][1] * h],
];

const paint = () => new Promise((r) => setTimeout(r, 30));

export function useScan() {
  const qc = useQueryClient();
  const { cards } = useCards();
  const { binders } = useBinders();
  const curBinder = useStore(prefs.binder);
  const { toast } = useToast();
  // The page size starts as the binder that was open, as most scans fill the binder in hand.
  const [state, dispatch] = useReducer(
    scanReducer,
    binders.find((b) => b.id === curBinder)?.pockets ?? 9,
    (pockets: Pockets) => initialState(pockets),
  );
  // Decoded photos, kept per file while the scan needs them.
  const [images] = useState(() => new Map<File, Promise<HTMLImageElement>>());
  // The read in progress. Stopping or leaving clears it, and a read that finds it isn't current any more stops.
  const run = useRef<symbol | null>(null);

  useEffect(
    () => () => {
      run.current = null;
    },
    [],
  );

  const imageOf = useCallback(
    (file: File): Promise<HTMLImageElement> => {
      let p = images.get(file);
      if (!p) {
        p = fileToImage(file);
        images.set(file, p);
        // Forget a failure so the next look tries again.
        p.catch(() => images.delete(file));
      }
      return p;
    },
    [images],
  );

  async function read(photos: readonly Photo[]) {
    const token = Symbol("read");
    run.current = token;
    const stopped = () => run.current !== token;
    const todo = photos.filter((p) => !p.skip);
    const [cols, rows] = GRID[state.pockets];
    dispatch({ type: "reading", pages: todo.length });
    try {
      const catalog = await qc.query(catalogQuery);
      const index = indexFor(catalog, cards);
      dispatch({ type: "index", index, asOf: catalog.asOf });
      await getWorker();
      for (const [n, p] of todo.entries()) {
        if (stopped()) return;
        dispatch({ type: "progress", prog: { page: n + 1, cell: 0, msg: `Straightening page ${n + 1}` } });
        // Straightening blocks the main thread for a moment; let the message paint first.
        await paint();
        const src = turned(await imageOf(p.file), p.rot, 3000);
        const cells = rectify(src, scaled(p.corners ?? MARGIN_CORNERS, src.width, src.height), cols, rows);
        release(src);
        images.delete(p.file);
        dispatch({ type: "page" });
        for (const [i, cell] of cells.entries()) {
          if (stopped()) {
            cells.forEach(release);
            return;
          }
          dispatch({
            type: "progress",
            prog: { cell: i + 1, msg: `Reading pocket ${i + 1} of ${cells.length}` },
          });
          const photo = pocketPhoto(cell);
          dispatch({ type: "cell", cell: cellOf(photo, await readPocket(index, cell)) });
          release(cell);
        }
      }
      if (!stopped()) dispatch({ type: "review" });
    } catch {
      if (stopped()) return;
      dispatch({ type: "stop" });
      toast("Couldn't load the card reader. Check your connection and try again.");
    }
  }

  /** Done with the photo on screen: on to the next, or read them all after the last. */
  function next(skip: boolean) {
    dispatch({ type: "skip", skip });
    if (state.cur < state.photos.length - 1) {
      dispatch({ type: "advance" });
      return;
    }
    const photos = state.photos.map((p, i) => (i === state.cur ? { ...p, skip } : p));
    if (!photos.some((p) => !p.skip)) {
      dispatch({ type: "noPhotos" });
      toast("No photos left to read");
      return;
    }
    void read(photos);
  }

  function stop() {
    run.current = null;
    dispatch({ type: "stop" });
  }

  return { state, dispatch, imageOf, next, stop };
}

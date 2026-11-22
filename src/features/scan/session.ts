/* The state of one scan, from choosing photos to saving. It lives only while the scan screen is open:
   nothing here is stored until the person taps Save. */
import type { Pockets } from "~/app/prefs";
import type { Quad } from "./engine/image";
import type { Entry, Match, ScanIndex } from "./engine/match";

/** Columns and rows of pockets for each page size. */
export const GRID: Record<Pockets, readonly [cols: number, rows: number]> = {
  4: [2, 2],
  9: [3, 3],
  12: [4, 3],
};

/** At most this many photos per scan; phones run short of memory beyond it. */
export const MAX_PHOTOS = 12;

export const DEFAULT_NAME = "Scanned binder";

/** Where the corner dots start when the page can't be found: just inside the photo's edge. */
const M = 0.04;
export const MARGIN_CORNERS: Quad = [
  [M, M],
  [1 - M, M],
  [1 - M, 1 - M],
  [M, 1 - M],
];

export interface Photo {
  file: File;
  /** Quarter turns clockwise. */
  rot: number;
  /** The page's corners as fractions of the turned photo, or null until they've been placed. */
  corners: Quad | null;
  skip: boolean;
}

/**
 * sure: matched with high confidence. check: matched, but the person should look.
 * none: no match, so the pocket stays empty unless they pick one. empty: an empty sleeve.
 */
export type CellState = "sure" | "check" | "none" | "empty";

export interface ScanCell {
  /** A small JPEG of the straightened pocket. */
  photo: string;
  m: Match;
  pick: Entry | null;
  state: CellState;
}

export interface Progress {
  page: number;
  pages: number;
  cell: number;
  cells: number;
  msg: string;
}

export type Step = "setup" | "crop" | "read" | "review" | "fix" | "saving";

export interface ScanState {
  step: Step;
  pockets: Pockets;
  /** "new", or the id of the binder the pages go into. */
  dest: string;
  name: string;
  photos: Photo[];
  /** The photo being lined up. */
  cur: number;
  pages: ScanCell[][];
  /** The pocket being fixed, counted across all pages. */
  fix: number;
  prog: Progress;
  index: ScanIndex | null;
  /** The catalog's date, for the market price on cards the scan adds. */
  asOf: string;
  saved: number;
}

export const initialState = (pockets: Pockets): ScanState => ({
  step: "setup",
  pockets,
  dest: "new",
  name: "",
  photos: [],
  cur: 0,
  pages: [],
  fix: -1,
  prog: { page: 0, pages: 0, cell: 0, cells: 0, msg: "" },
  index: null,
  asOf: "",
  saved: 0,
});

export type ScanAction =
  | { type: "pockets"; pockets: Pockets; keepDest: boolean }
  | { type: "dest"; dest: string }
  | { type: "name"; name: string }
  | { type: "photos"; files: File[] }
  | { type: "corners"; corners: Quad }
  /** The page found automatically; ignored if the dots were placed meanwhile. */
  | { type: "guess"; file: File; corners: Quad }
  | { type: "rotate" }
  | { type: "back" }
  | { type: "skip"; skip: boolean }
  | { type: "advance" }
  | { type: "noPhotos" }
  | { type: "reading"; pages: number }
  | { type: "index"; index: ScanIndex; asOf: string }
  | { type: "progress"; prog: Partial<Progress> }
  | { type: "page" }
  | { type: "cell"; cell: ScanCell }
  | { type: "review" }
  | { type: "stop" }
  | { type: "fix"; fix: number }
  | { type: "choose"; pick: Entry | null }
  | { type: "closeFix" }
  | { type: "startOver" }
  | { type: "saving" }
  | { type: "saved" };

const withPhoto = (s: ScanState, change: (p: Photo) => Photo): Photo[] =>
  s.photos.map((p, i) => (i === s.cur ? change(p) : p));

export function scanReducer(s: ScanState, a: ScanAction): ScanState {
  switch (a.type) {
    case "pockets":
      return { ...s, pockets: a.pockets, dest: a.keepDest ? s.dest : "new" };
    case "dest":
      return { ...s, dest: a.dest };
    case "name":
      return { ...s, name: a.name };
    case "photos":
      return {
        ...s,
        photos: a.files.slice(0, MAX_PHOTOS).map((file) => ({ file, rot: 0, corners: null, skip: false })),
        name: s.dest === "new" && !s.name.trim() ? DEFAULT_NAME : s.name,
        cur: 0,
        step: "crop",
      };
    case "corners":
      return { ...s, photos: withPhoto(s, (p) => ({ ...p, corners: a.corners })) };
    case "guess":
      return {
        ...s,
        photos: s.photos.map((p) => (p.file === a.file && !p.corners ? { ...p, corners: a.corners } : p)),
      };
    case "rotate":
      return { ...s, photos: withPhoto(s, (p) => ({ ...p, rot: (p.rot + 1) % 4, corners: null })) };
    case "back":
      return { ...s, cur: Math.max(0, s.cur - 1) };
    case "skip":
      return { ...s, photos: withPhoto(s, (p) => ({ ...p, skip: a.skip })) };
    case "advance":
      return { ...s, cur: Math.min(s.photos.length - 1, s.cur + 1) };
    case "noPhotos":
      return { ...s, photos: [], step: "setup" };
    case "reading":
      return {
        ...s,
        step: "read",
        pages: [],
        prog: {
          page: 0,
          pages: a.pages,
          cell: 0,
          cells: s.pockets,
          msg: "Getting the card reader ready. The first time takes a moment.",
        },
      };
    case "index":
      return { ...s, index: a.index, asOf: a.asOf };
    case "progress":
      return { ...s, prog: { ...s.prog, ...a.prog } };
    case "page":
      return { ...s, pages: [...s.pages, []] };
    case "cell":
      return { ...s, pages: s.pages.map((pg, i) => (i === s.pages.length - 1 ? [...pg, a.cell] : pg)) };
    case "review":
      return { ...s, step: "review" };
    case "stop":
      return { ...s, step: "setup", pages: [] };
    case "fix":
      return { ...s, fix: a.fix, step: "fix" };
    case "choose": {
      // Choosing a card confirms it; choosing none marks the pocket empty.
      const state: CellState = a.pick ? "sure" : "empty";
      let k = 0;
      const pages = s.pages.map((pg) => pg.map((c) => (k++ === s.fix ? { ...c, pick: a.pick, state } : c)));
      return { ...s, pages, step: "review" };
    }
    case "closeFix":
      return { ...s, step: "review" };
    case "startOver":
      return { ...s, pages: [], photos: [], step: "setup" };
    case "saving":
      return { ...s, step: "saving", saved: 0 };
    case "saved":
      return { ...s, saved: s.saved + 1 };
  }
}

/** A pocket that will be saved: it has a card and isn't marked empty or unread. */
export const willSave = (c: ScanCell): c is ScanCell & { pick: Entry } =>
  c.pick !== null && c.state !== "empty" && c.state !== "none";

/** Something would be lost by leaving: photos chosen or pockets read, and not already saving. */
export const hasWork = (s: ScanState): boolean =>
  (s.photos.length > 0 || s.pages.length > 0) && s.step !== "saving";

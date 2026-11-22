import { num, oneOf } from "~/lib/json";
import type { SheetState } from "./BinderSheet";

const SHEETS = ["new", "import", "options", "pocket", "pick"] as const;

/** The open binder sheet lives in the address, so the back button and swipe-back close it. */
export interface BindersSearch {
  sheet?: (typeof SHEETS)[number];
  /** The pocket a pocket or pick sheet is for. */
  pocket?: number;
}

export function validateBindersSearch(s: Record<string, unknown>): BindersSearch {
  const pocket = num(s.pocket);
  return {
    sheet: oneOf(s.sheet, SHEETS),
    pocket: pocket !== undefined && Number.isInteger(pocket) && pocket >= 0 ? pocket : undefined,
  };
}

export function sheetOf({ sheet, pocket }: BindersSearch): SheetState | null {
  if (sheet === "pocket" || sheet === "pick")
    return pocket === undefined ? null : { kind: sheet, idx: pocket };
  return sheet ? { kind: sheet } : null;
}

export const searchOf = (sheet: SheetState): BindersSearch => ({
  sheet: sheet.kind,
  pocket: "idx" in sheet ? sheet.idx : undefined,
});

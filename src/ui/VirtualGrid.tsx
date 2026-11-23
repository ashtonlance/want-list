import { useWindowVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { memo, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { findRowsWith } from "~/lib/scroll";

/**
 * A grid of card tiles where only the rows near the screen exist. A feed of thousands of cards costs
 * the same as a screenful: the page keeps a few dozen tiles however far it's scrolled, so scrolling
 * stays smooth and a new tile never re-renders the ones already drawn.
 *
 * The grid's CSS class (like `.ex-grid`) still lays out each row, so columns and gaps follow the
 * stylesheet at every width. Rows are measured as they're drawn, and the sizes are kept per list for
 * the visit, so coming back lands exactly where it left (the anchor in lib/scroll.ts does the rest).
 */

interface VirtualGridProps<T> {
  items: readonly T[];
  /** Draws one tile. Keep it stable (useCallback), so rows that didn't change aren't drawn again. */
  renderItem: (item: T, index: number) => ReactNode;
  /** The grid's layout class, like "ex-grid". */
  className: string;
  /** The list's scroll key (lib/scroll.ts), which also names its remembered row sizes. */
  scrollKey: string;
  /** The outer box, for an entrance animation. */
  ref?: Ref<HTMLDivElement>;
}

/** Rows drawn beyond the screen each way: about two screens on a phone, so a fling rarely outruns them. */
const OVERSCAN = 6;
/** Row sizes measured this visit, per list and column count; only the last few lists are kept. */
const measured = new Map<string, VirtualItem[]>();
const LISTS_KEPT = 8;

function remember(key: string, sizes: VirtualItem[]): void {
  measured.delete(key);
  if (!sizes.length) return;
  measured.set(key, sizes);
  if (measured.size > LISTS_KEPT) measured.delete(measured.keys().next().value ?? "");
}

interface Layout {
  cols: number;
  rowGap: number;
  /** A row's likely height before it's measured: a tile's picture plus its lines of text. */
  estimate: number;
  /** Where the grid starts on the page, since the window is what scrolls. */
  top: number;
}

/** The column count, gap and offset the stylesheet gives this grid right now. */
function readLayout(probe: HTMLElement): Layout {
  const css = getComputedStyle(probe);
  const tracks = css.gridTemplateColumns.split(" ").filter((t) => t.endsWith("px"));
  const cols = Math.max(1, tracks.length);
  const colWidth = parseFloat(tracks[0] ?? "") || probe.clientWidth / cols;
  return {
    cols,
    rowGap: parseFloat(css.rowGap) || 0,
    estimate: Math.round(colWidth * (88 / 63) + 72),
    top: Math.round(probe.getBoundingClientRect().top + window.scrollY),
  };
}

const sameLayout = (a: Layout, b: Layout) =>
  a.cols === b.cols && a.rowGap === b.rowGap && a.estimate === b.estimate && a.top === b.top;

export function VirtualGrid<T>({ items, renderItem, className, scrollKey, ref }: VirtualGridProps<T>) {
  const probe = useRef<HTMLDivElement>(null);
  // Read from the stylesheet before any row is drawn (a layout effect, so before the first paint).
  const [layout, setLayout] = useState<Layout | null>(null);

  // Columns follow the width; the grid's place on the page follows whatever sits above it.
  useLayoutEffect(() => {
    const el = probe.current;
    if (!el) return;
    const update = () => {
      const next = readLayout(el);
      setLayout((prev) => (prev && sameLayout(prev, next) ? prev : next));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.parentElement?.parentElement) ro.observe(el.parentElement.parentElement);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {/* An empty copy of the grid, only to read its columns and gap from the stylesheet. */}
      <div ref={probe} className={className} aria-hidden="true" style={{ height: 0, overflow: "hidden" }} />
      {layout ? (
        // Another list, or a new column count that regroups every row, starts afresh with its own sizes.
        <Rows
          key={`${String(layout.cols)}|${scrollKey}`}
          layout={layout}
          items={items}
          renderItem={renderItem}
          className={className}
          scrollKey={scrollKey}
        />
      ) : null}
    </div>
  );
}

interface RowsProps<T> {
  layout: Layout;
  items: readonly T[];
  renderItem: (item: T, index: number) => ReactNode;
  className: string;
  scrollKey: string;
}

function Rows<T>({ layout, items, renderItem, className, scrollKey }: RowsProps<T>) {
  const { cols } = layout;
  const sizesKey = `${scrollKey}|${String(cols)}`;
  const v = useWindowVirtualizer({
    count: Math.ceil(items.length / cols),
    estimateSize: () => layout.estimate,
    gap: layout.rowGap,
    overscan: OVERSCAN,
    scrollMargin: layout.top,
    initialMeasurementsCache: measured.get(sizesKey),
    indexAttribute: "data-row",
    // New rows are drawn in React's next pass rather than inside the scroll event, so a fling never
    // waits on them; the rows drawn ahead (OVERSCAN) are already on screen by the time they're needed.
    useFlushSync: false,
  });

  // Keep this visit's sizes for coming back.
  useLayoutEffect(() => () => remember(sizesKey, v.takeSnapshot()), [v, sizesKey]);

  // Restoring a position can ask where an item's row starts on the page, to reach an anchor not yet
  // drawn (as after the app was closed, or at another column count).
  useEffect(
    () => findRowsWith(scrollKey, (item) => v.getOffsetForIndex(Math.floor(item / cols), "start")?.[0]),
    [v, scrollKey, cols],
  );

  return (
    <div style={{ position: "relative", height: v.getTotalSize() }}>
      {v.getVirtualItems().map((row) => (
        <Row
          key={row.key}
          index={row.index}
          y={row.start - layout.top}
          items={items}
          cols={cols}
          renderItem={renderItem}
          className={className}
          measure={v.measureElement}
        />
      ))}
    </div>
  );
}

interface RowProps<T> {
  index: number;
  /** Where the row sits in the grid. */
  y: number;
  items: readonly T[];
  cols: number;
  renderItem: (item: T, index: number) => ReactNode;
  className: string;
  measure: (el: HTMLDivElement | null) => void;
}

/** One row of tiles, laid out by the grid's own class and placed by the virtualizer. */
function RowImpl<T>({ index, y, items, cols, renderItem, className, measure }: RowProps<T>) {
  const start = index * cols;
  const tiles: ReactNode[] = [];
  for (let i = start; i < Math.min(start + cols, items.length); i++) {
    const item = items[i];
    // Every place gets a cell, even an empty one, so tiles keep their columns (and lib/scroll.ts can
    // tell an anchor's place from its cell).
    tiles.push((item === undefined ? null : renderItem(item, i)) ?? <div key={`empty-${String(i)}`} />);
  }
  return (
    <div
      ref={measure}
      data-row={index}
      data-item={start}
      className={className}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        transform: `translateY(${String(y)}px)`,
      }}
    >
      {tiles}
    </div>
  );
}

const Row = memo(RowImpl) as typeof RowImpl;

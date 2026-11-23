import { useWindowVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { memo, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react";

/**
 * A grid of card tiles where only the rows near the screen exist. A feed of thousands of cards costs
 * the same as a screenful: the page keeps a few dozen tiles however far it's scrolled, so scrolling
 * stays smooth and a new tile never re-renders the ones already drawn.
 *
 * The grid's CSS class (like `.ex-grid`) still lays out each row, so columns and gaps follow the
 * stylesheet at every width. Rows are measured as they're drawn, and the sizes are kept per `cacheKey`
 * for the visit, so coming back lands exactly where it left (the anchor in lib/scroll.ts does the rest).
 */

interface VirtualGridProps<T> {
  items: readonly T[];
  /** Draws one tile. Keep it stable (useCallback), so rows that didn't change aren't drawn again. */
  renderItem: (item: T, index: number) => ReactNode;
  /** The grid's layout class, like "ex-grid". */
  className: string;
  /** Names this list (its scroll key), so its row sizes are remembered between visits. */
  cacheKey: string;
  /** The outer box, for an entrance animation. */
  ref?: Ref<HTMLDivElement>;
}

/** Rows drawn beyond the screen each way: about two screens on a phone, so a fling rarely outruns them. */
const OVERSCAN = 6;
/** Row sizes measured per list this visit. */
const measured = new Map<string, VirtualItem[]>();

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

export function VirtualGrid<T>({ items, renderItem, className, cacheKey, ref }: VirtualGridProps<T>) {
  const probe = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout>({ cols: 2, rowGap: 18, estimate: 320, top: 0 });

  // Columns follow the width; the grid's place on the page follows whatever sits above it.
  useLayoutEffect(() => {
    const el = probe.current;
    if (!el) return;
    const update = () => {
      const next = readLayout(el);
      setLayout((prev) => (sameLayout(prev, next) ? prev : next));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.parentElement?.parentElement) ro.observe(el.parentElement.parentElement);
    return () => ro.disconnect();
  }, []);

  const { cols } = layout;
  const rowCount = Math.ceil(items.length / cols);
  const v = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => layout.estimate,
    gap: layout.rowGap,
    overscan: OVERSCAN,
    scrollMargin: layout.top,
    initialMeasurementsCache: measured.get(`${cacheKey}|${cols}`),
    // New rows are drawn in React's next pass rather than inside the scroll event, so a fling never
    // waits on them; the rows drawn ahead (OVERSCAN) are already on screen by the time they're needed.
    useFlushSync: false,
  });

  // Keep this visit's sizes for coming back (the cache is per column count, since rows regroup).
  const snapKey = `${cacheKey}|${cols}`;
  useLayoutEffect(() => () => void measured.set(snapKey, v.takeSnapshot()), [v, snapKey]);

  return (
    <div ref={ref}>
      {/* An empty copy of the grid, only to read its columns and gap from the stylesheet. */}
      <div ref={probe} className={className} aria-hidden="true" style={{ height: 0, overflow: "hidden" }} />
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
    if (item !== undefined) tiles.push(renderItem(item, i));
  }
  return (
    <div
      ref={measure}
      data-index={index}
      className={className}
      style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${y}px)` }}
    >
      {tiles}
    </div>
  );
}

const Row = memo(RowImpl) as typeof RowImpl;

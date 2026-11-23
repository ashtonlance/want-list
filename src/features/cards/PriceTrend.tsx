import { formatMoney } from "~/lib/format";
import { pricePoints, priceTrend, sharePct, usePriceDrop, usePriceHistory, type PricePoint } from "./history";
import type { Card } from "./types";

const W = 300;
const H = 64;
const PAD = 4;

const dayFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
/** "Aug 25". */
const shortDay = (d: string) => dayFormat.format(new Date(d + "T12:00:00"));

const dayNum = (d: string) => Date.parse(d + "T00:00:00Z") / 86_400_000;

/** The line's points in the SVG's own units: days across (gaps kept), price up. */
function linePoints(points: readonly PricePoint[], low: number, high: number): [number, number][] {
  const x0 = dayNum(points[0]?.day ?? "");
  const span = Math.max(1, dayNum(points.at(-1)?.day ?? "") - x0);
  // A flat price sits mid-height rather than on the floor.
  const range = high - low || 1;
  const yOf = (p: number) => (high === low ? H / 2 : PAD + (1 - (p - low) / range) * (H - 2 * PAD));
  return points.map((p) => [PAD + ((dayNum(p.day) - x0) / span) * (W - 2 * PAD), yOf(p.price)]);
}

/** The card's market price over the days the history covers, with its low, high and any drop. */
export function PriceTrend({ card: c }: { card: Card }) {
  const { data: hist } = usePriceHistory();
  const points = pricePoints(hist, c);
  const trend = priceTrend(points);
  const drop = usePriceDrop(c);
  if (!hist || !trend) return null;
  const pct = Math.round(Math.abs(trend.change) * 100);
  const since = shortDay(trend.first.day);
  const change =
    pct === 0 ? `No change since ${since}` : `${trend.change > 0 ? "Up" : "Down"} ${pct}% since ${since}`;
  const line = linePoints(trend.points, trend.low, trend.high);
  const end = line.at(-1) ?? [0, 0];

  return (
    <div className="sec">
      <h4 className="sec-title">Price trend</h4>
      <div className="trend">
        <svg
          className="spark"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`TCGplayer market price. ${change}, from ${formatMoney(trend.first.price)} to ${formatMoney(trend.last.price)}.`}
        >
          <polyline points={line.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")} />
          <circle cx={end[0]} cy={end[1]} r="3" />
        </svg>
        <div className="trend-nums">
          <span>{change}</span>
          <span className="num">
            Low {formatMoney(trend.low)} · High {formatMoney(trend.high)}
          </span>
        </div>
        {drop ? (
          <p className="trend-drop">
            ↓ {sharePct(drop.share)} under its usual {formatMoney(drop.from)} lately
          </p>
        ) : null}
      </div>
    </div>
  );
}

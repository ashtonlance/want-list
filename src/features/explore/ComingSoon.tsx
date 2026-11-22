import { useMemo } from "react";
import type { Catalog } from "~/features/catalog/catalog";
import type { FeedLang } from "~/features/catalog/feed";
import { formatDate, plural, today } from "~/lib/format";
import { patchLiveUi } from "./state";

interface Props {
  cat: Catalog;
  /** The feed's rows, to count the cards each upcoming set has so far. */
  rows: readonly number[];
  lang: FeedLang;
  /** True while the feed shows only sets that aren't out yet. */
  showing: boolean;
}

/** Sets announced but not out yet: a line above the feed, or the list itself under "Not out yet". */
export function ComingSoon({ cat, rows, lang, showing }: Props) {
  const sets = useMemo(() => {
    const now = today();
    const counts = new Map<string, number>();
    for (const i of rows) {
      const c = cat.cards[i];
      const s = c ? cat.sets[c.set] : undefined;
      if (s && s.date > now) {
        const k = `${s.jp ? 1 : 0}|${s.name.toLowerCase()}`;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    return cat.upcoming
      .filter((s) => s.date > now && (lang === "both" || s.jp === (lang === "jp")))
      .map((s) => ({ ...s, cards: counts.get(`${s.jp ? 1 : 0}|${s.name.toLowerCase()}`) ?? 0 }));
  }, [cat, rows, lang]);

  // "Nov 27" this year, "Feb 6, 2027" after that.
  const year = today().slice(0, 4);
  const when = (date: string) =>
    date.startsWith(year) ? formatDate(date).replace(`, ${year}`, "") : formatDate(date);

  if (!showing) {
    if (!sets.length) return null;
    return (
      <button className="soon-line" type="button" onClick={() => patchLiveUi({ era: "soon" })}>
        <b>{plural(sets.length, "set")} coming soon:</b>{" "}
        {sets
          .slice(0, 3)
          .map((s) => `${s.name} (${when(s.date)})`)
          .join(", ")}
        {sets.length > 3 ? "…" : ""}
      </button>
    );
  }

  return (
    <div className="panel soon">
      <h3>Coming soon</h3>
      {sets.length ? (
        <ul>
          {sets.map((s) => (
            <li key={`${s.jp ? "jp" : "en"}:${s.name}`}>
              <b>{s.name}</b>
              {lang === "both" || s.jp ? <span className="soon-tag">{s.jp ? "JP" : "EN"}</span> : null}
              <small>
                Out {when(s.date)} ·{" "}
                {s.cards ? plural(s.cards, "card") + " listed so far" : "card list not out yet"}
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">No announced sets in this language right now.</p>
      )}
      <p className="hint">
        Cards show up below as TCGplayer lists them, usually in the weeks before release. Names and rarities
        can still change until then.
      </p>
    </div>
  );
}

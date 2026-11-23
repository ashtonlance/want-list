import { useMemo } from "react";
import type { Catalog } from "~/features/catalog/catalog";
import type { FeedLang } from "~/features/catalog/feed";
import { formatDate, plural, today } from "~/lib/format";

interface Props {
  cat: Catalog;
  /** The feed's rows, to count the cards each upcoming set has so far. */
  rows: readonly number[];
  lang: FeedLang;
}

const upcoming = (cat: Catalog, lang: FeedLang) => {
  const now = today();
  return cat.upcoming.filter((s) => s.date > now && (lang === "both" || s.jp === (lang === "jp")));
};

// "Nov 27" this year, "Feb 6, 2027" after that.
const when = (date: string) => {
  const year = today().slice(0, 4);
  return date.startsWith(year) ? formatDate(date).replace(`, ${year}`, "") : formatDate(date);
};

/**
 * Sets announced but not out yet, as a chip beside Every card: one set by name and date, more by count.
 * Tapping it shows only those sets' cards, with the list above them.
 */
export function SoonChip({
  cat,
  lang,
  on,
  onClick,
}: {
  cat: Catalog;
  lang: FeedLang;
  on: boolean;
  onClick: () => void;
}) {
  const sets = useMemo(() => upcoming(cat, lang), [cat, lang]);
  const first = sets[0];
  // Still shown while it's the filter in use, so there's always a pressed chip to tap back out of.
  if (!first && !on) return null;
  return (
    <button className="colltab soon-chip" type="button" aria-pressed={on} onClick={onClick}>
      {!first ? (
        <b>Coming soon</b>
      ) : (
        <>
          <b>{sets.length === 1 ? first.name : `${plural(sets.length, "set")} coming`}</b>
          <span>{sets.length === 1 ? `out ${when(first.date)}` : `next ${when(first.date)}`}</span>
        </>
      )}
    </button>
  );
}

/** The sets that aren't out yet, above their cards while the feed shows only those. */
export function ComingSoon({ cat, rows, lang }: Props) {
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
    return upcoming(cat, lang).map((s) => ({
      ...s,
      cards: counts.get(`${s.jp ? 1 : 0}|${s.name.toLowerCase()}`) ?? 0,
    }));
  }, [cat, rows, lang]);

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

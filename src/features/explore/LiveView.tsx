import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOverlayNav } from "~/app/overlayNav";
import { useAuth } from "~/features/auth/AuthProvider";
import { useCatalog } from "~/features/catalog/catalog";
import { FEED_ERA_OPTIONS } from "~/features/catalog/era";
import {
  FEED_PRICE_OPTIONS,
  feedRows,
  priceBand,
  type FeedLang,
  type FeedSort,
} from "~/features/catalog/feed";
import { LOOK_OPTIONS, lookCards } from "~/features/catalog/looks";
import { Select } from "~/ui/Select";
import { SkeletonGrid } from "~/ui/Skeleton";
import { ComingSoon } from "./ComingSoon";
import { EveryCardFeed } from "./EveryCardFeed";
import { LoadError } from "./ExCard";
import { useTdSets } from "./live";
import { LiveResults } from "./LiveResults";
import { CAP_OPTIONS, patchLiveUi, useLiveUi, type LiveSort } from "./state";
import { useCollections } from "~/features/cards/useCollections";

const DEBOUNCE_MS = 650;
/** How many of the newest sets get a chip. */
const SET_CHIPS = 10;

const LANG_WORD: Record<FeedLang, string> = { en: "English", jp: "Japanese", both: "English and Japanese" };

const LANG_OPTIONS: readonly { value: FeedLang; label: string }[] = [
  { value: "en", label: "English" },
  { value: "jp", label: "Japanese" },
  { value: "both", label: "English and Japanese" },
];

const FEED_SORTS: readonly { value: FeedSort; label: string }[] = [
  { value: "new", label: "Newest first" },
  { value: "old", label: "Oldest first" },
  { value: "rare", label: "Rarest first" },
  { value: "high", label: "Price: high to low" },
  { value: "low", label: "Price: low to high" },
  { value: "name", label: "Name: A to Z" },
];

const liveSorts = (searching: boolean): readonly { value: LiveSort; label: string }[] => [
  { value: "num", label: searching ? "Newest first" : "Chase cards first" },
  { value: "high", label: "Price: high to low" },
  { value: "low", label: "Price: low to high" },
];

/** Explore's live tab: search any card, browse the newest sets, or scroll every card ever made. */
export function LiveView() {
  const { q = "", set = "" } = useSearch({ from: "/explore/" });
  const navigate = useNavigate({ from: "/explore/" });
  const all = !q && !set;
  const ui = useLiveUi();
  const { canWrite } = useAuth();
  const { open } = useOverlayNav();
  const sets = useTdSets();
  const catalog = useCatalog(all);
  const rows = useMemo(
    () =>
      all && catalog.data
        ? feedRows(catalog.data, {
            lang: ui.lang,
            sort: ui.feedSort,
            ...priceBand(ui.feedPrice),
            rarity: ui.rarity,
            look: ui.look,
            era: ui.era,
          })
        : null,
    [all, catalog.data, ui.lang, ui.feedSort, ui.feedPrice, ui.rarity, ui.look, ui.era],
  );
  // How many cards in the chosen language each look has, for its chip.
  const lookCounts = useMemo(() => {
    const cat = catalog.data;
    if (!all || !cat) return null;
    const want = ui.lang === "en" ? false : ui.lang === "jp" ? true : null;
    const inLang = (jp: boolean) => want === null || jp === want;
    return new Map(
      LOOK_OPTIONS.map(({ value }) => {
        const set = lookCards(cat, value);
        let n = 0;
        for (const c of set ?? cat.cards) if (inLang(cat.sets[c.set]?.jp ?? false)) n++;
        return [value, n] as const;
      }),
    );
  }, [all, catalog.data, ui.lang]);
  const filtered = ui.look !== "any" || ui.rarity !== "" || ui.feedPrice !== "any" || ui.era !== "any";
  const rarityOptions = useMemo(() => {
    const cat = catalog.data;
    if (!cat) return [{ value: "", label: "Any rarity" }];
    const counts = new Map<number, number>();
    for (const c of cat.cards) counts.set(c.rarity, (counts.get(c.rarity) ?? 0) + 1);
    const names = [...counts.entries()]
      .map(([i, n]) => [cat.rarities[i] ?? "", n] as const)
      .filter(([name]) => name)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name]) => ({ value: name, label: name }));
    return [{ value: "", label: "Any rarity" }, ...names];
  }, [catalog.data]);

  // What's typed follows the address when it changes elsewhere (a chip, the back button), but a search
  // that has just gone through keeps exactly what was typed.
  const [typed, setTyped] = useState(q);
  const [seenQ, setSeenQ] = useState(q);
  if (q !== seenQ) {
    setSeenQ(q);
    if (typed.trim() !== q) setTyped(q);
  }

  const commit = useCallback(
    (v: string) => {
      if (v === q || (v && v.length < 2)) return;
      void navigate({ search: (prev) => ({ ...prev, q: v || undefined }), replace: true });
    },
    [q, navigate],
  );

  // Searches as you type once there are three letters, or when the box is cleared.
  useEffect(() => {
    const v = typed.trim();
    if (v && v.length < 3) return;
    const t = setTimeout(() => commit(v), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [typed, commit]);

  const input = useRef<HTMLInputElement>(null);
  const showSet = (id: string) => {
    setTyped("");
    void navigate({ search: id ? { set: id } : {}, replace: true });
  };

  const setName = sets.data?.sets.find((s) => s.id === set)?.name;
  // The newest sets get chips; an older set picked from All sets gets one too while it's showing.
  const chipSets = useMemo(() => {
    const list = sets.data?.sets ?? [];
    const newest = list.slice(0, SET_CHIPS);
    const picked = set && !newest.some((s) => s.id === set) ? list.find((s) => s.id === set) : undefined;
    return picked ? [...newest, picked] : newest;
  }, [sets.data, set]);
  const langWord = LANG_WORD[ui.lang];
  const title = q ? `Results for “${q}”` : all ? "Every card" : setName || "Newest cards";
  const intro = q
    ? "Every printing, newest sets first. Prices are today's TCGplayer market."
    : all
      ? rows
        ? `${filtered ? "" : "All "}${rows.length.toLocaleString()} ${langWord} ${rows.length === 1 ? "card" : "cards"}${filtered ? " match" : " ever made"}. Keep scrolling.`
        : `Every ${langWord} card ever made. Keep scrolling.`
      : "Straight from the latest card data, chase cards first. Prices are today's TCGplayer market.";

  const toFeedTop = () => window.scrollTo({ top: 0 });
  const { collections } = useCollections();

  return (
    <>
      <div className="ex-intro">
        <h2>{title}</h2>
        <p>{intro}</p>
      </div>
      <div className="ex-tools">
        <form
          className="lv-search"
          role="search"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            input.current?.blur();
            commit(typed.trim());
          }}
        >
          <input
            ref={input}
            type="search"
            placeholder="Search any card, like Gengar"
            aria-label="Search live cards"
            enterKeyHint="search"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          <button className="btn small" type="submit">
            Search
          </button>
        </form>
        <div className="colltabs">
          <button className="colltab" type="button" aria-pressed={all} onClick={() => showSet("")}>
            <b>Every card</b>
          </button>
          {chipSets.map((s) => (
            <button
              key={s.id}
              className="colltab"
              type="button"
              aria-pressed={!q && set === s.id}
              onClick={() => showSet(s.id)}
            >
              <b>{s.name}</b>
            </button>
          ))}
          <button className="colltab new" type="button" onClick={() => open({ panel: "sets" })}>
            <b>All sets</b>
          </button>
        </div>
        {all ? (
          <div className="colltabs" role="group" aria-label="Card looks">
            {LOOK_OPTIONS.map((l) => (
              <button
                key={l.value}
                className="colltab"
                type="button"
                aria-pressed={ui.look === l.value}
                onClick={() => {
                  patchLiveUi({ look: l.value });
                  toFeedTop();
                }}
              >
                <b>{l.label}</b>
                {lookCounts ? <span>{(lookCounts.get(l.value) ?? 0).toLocaleString()}</span> : null}
              </button>
            ))}
          </div>
        ) : null}
        <div className="scroller">
          {all ? (
            <Select
              aria-label="Card language"
              value={ui.lang}
              options={LANG_OPTIONS}
              onChange={(lang) => {
                patchLiveUi({ lang });
                toFeedTop();
              }}
            />
          ) : null}
          {all ? (
            <Select
              aria-label="Sort live cards"
              value={ui.feedSort}
              options={FEED_SORTS}
              onChange={(feedSort) => {
                patchLiveUi({ feedSort });
                toFeedTop();
              }}
            />
          ) : (
            <Select
              aria-label="Sort live cards"
              value={ui.sort}
              options={liveSorts(Boolean(q))}
              onChange={(sort) => patchLiveUi({ sort })}
            />
          )}
          {all ? (
            <Select
              aria-label="Price"
              value={ui.feedPrice}
              options={FEED_PRICE_OPTIONS}
              onChange={(feedPrice) => {
                patchLiveUi({ feedPrice });
                toFeedTop();
              }}
            />
          ) : (
            <Select
              aria-label="Price limit"
              value={ui.cap}
              options={CAP_OPTIONS}
              onChange={(cap) => patchLiveUi({ cap })}
            />
          )}
          {all ? (
            <>
              <Select
                aria-label="Rarity"
                value={ui.rarity}
                options={rarityOptions}
                onChange={(rarity) => {
                  patchLiveUi({ rarity });
                  toFeedTop();
                }}
              />
              <Select
                aria-label="Set released"
                value={ui.era}
                options={FEED_ERA_OPTIONS}
                onChange={(era) => {
                  patchLiveUi({ era });
                  toFeedTop();
                }}
              />
              {filtered ? (
                <button
                  className="chip-toggle"
                  type="button"
                  onClick={() => {
                    patchLiveUi({ look: "any", rarity: "", feedPrice: "any", era: "any" });
                    toFeedTop();
                  }}
                >
                  Clear filters
                </button>
              ) : null}
            </>
          ) : null}
          {canWrite ? (
            <Select
              aria-label="Collection for added cards"
              value={ui.addTo}
              options={[
                { value: "", label: "Add with no collection" },
                ...collections.map((c) => ({ value: c.name, label: `Add to ${c.name}` })),
              ]}
              onChange={(addTo) => patchLiveUi({ addTo })}
            />
          ) : null}
        </div>
      </div>
      {!all ? (
        <LiveResults key={q ? `q:${q}` : `set:${set}`} q={q} set={set} />
      ) : catalog.isError && !catalog.data ? (
        <LoadError
          text="Couldn't load every card. Check your connection and try again."
          onRetry={() => void catalog.refetch()}
        />
      ) : rows && catalog.data ? (
        <>
          <ComingSoon cat={catalog.data} rows={rows} lang={ui.lang} showing={ui.era === "soon"} />
          <EveryCardFeed cat={catalog.data} rows={rows} lang={ui.lang} />
        </>
      ) : (
        <SkeletonGrid className="ex-grid" count={6} />
      )}
    </>
  );
}

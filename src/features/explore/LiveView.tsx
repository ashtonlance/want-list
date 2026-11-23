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
import { sameName } from "~/features/catalog/names";
import { Button } from "~/components/ui/button";
import { Toggle } from "~/components/ui/toggle";
import {
  ActiveFilters,
  Choices,
  FilterButton,
  FilterSection,
  FilterSheet,
  type ActiveFilter,
} from "~/ui/Filters";
import { Select } from "~/ui/Select";
import { useFilterSheet } from "~/ui/useFilterSheet";
import { SkeletonGrid } from "~/ui/Skeleton";
import { ComingSoon, SoonChip } from "./ComingSoon";
import { forgetScroll } from "~/lib/scroll";
import { EveryCardFeed } from "./EveryCardFeed";
import { LoadError } from "~/ui/LoadError";
import { useTdSets } from "./live";
import { LiveResults } from "./LiveResults";
import { SearchInput } from "~/ui/SearchInput";
import { CAP_OPTIONS, DEFAULT_LIVE_UI, patchLiveUi, useLiveUi, type LiveSort, type LiveUi } from "./state";
import { useCollections } from "~/features/cards/useCollections";

// Searches run on the phone, so they can follow typing closely.
const DEBOUNCE_MS = 300;
/** How many of the newest sets get a chip. */
const SET_CHIPS = 10;

const LANG_WORD: Record<FeedLang, string> = { en: "English", jp: "Japanese", both: "English and Japanese" };

/** Settings that change the Every card feed. */
type FeedKey = "feedSort" | "look" | "feedPrice" | "era" | "rarity" | "lang";

const LANG_OPTIONS: readonly { value: FeedLang; label: string }[] = [
  { value: "en", label: "English" },
  { value: "jp", label: "Japanese" },
  { value: "both", label: "Both" },
];

const FEED_SORTS: readonly { value: FeedSort; label: string }[] = [
  { value: "new", label: "Newest first" },
  { value: "old", label: "Oldest first" },
  { value: "rare", label: "Rarest first" },
  { value: "high", label: "Price: high to low" },
  { value: "low", label: "Price: low to high" },
  { value: "name", label: "Name: A to Z" },
];

const SET_SORTS: readonly { value: LiveSort; label: string }[] = [
  { value: "num", label: "Chase cards first" },
  { value: "high", label: "Price: high to low" },
  { value: "low", label: "Price: low to high" },
];

/** The start of the Every card feed's scroll keys; the rest names the language, order and filters. */
const FEED_SCROLL = "live:all:";

/** Explore's live tab: search any card, browse the newest sets, or scroll every card ever made. */
export function LiveView() {
  const { q = "", set = "" } = useSearch({ from: "/explore/" });
  const navigate = useNavigate({ from: "/explore/" });
  const all = !q && !set;
  // Every card and searches both run over the daily catalog, with the same filters and sorts; a set
  // chip lists that set live from TCGdex.
  const feedMode = !set;
  const ui = useLiveUi();
  const { canWrite } = useAuth();
  const { open } = useOverlayNav();
  const sets = useTdSets();
  const catalog = useCatalog(feedMode);
  const rows = useMemo(
    () =>
      feedMode && catalog.data
        ? feedRows(catalog.data, {
            lang: ui.lang,
            sort: ui.feedSort,
            ...priceBand(ui.feedPrice),
            rarity: ui.rarity,
            look: ui.look,
            era: ui.era,
            q,
          })
        : null,
    [feedMode, catalog.data, ui.lang, ui.feedSort, ui.feedPrice, ui.rarity, ui.look, ui.era, q],
  );
  // How many cards in the chosen language each look has, for its chip.
  const lookCounts = useMemo(() => {
    const cat = catalog.data;
    if (!feedMode || !cat) return null;
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
  }, [feedMode, catalog.data, ui.lang]);
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
  // A saved rarity the catalog no longer lists would show an empty feed: drop it.
  const rarity = (ui.rarity && catalog.data?.rarities.find((r) => sameName(r, ui.rarity))) || "";
  const staleRarity = Boolean(catalog.data && ui.rarity && !rarity);
  useEffect(() => {
    if (staleRarity) patchLiveUi({ rarity: "" });
  }, [staleRarity]);

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
      // A search covers every card, so it leaves the set being shown.
      void navigate({
        search: (prev) => ({ ...prev, q: v || undefined, set: v ? undefined : prev.set }),
        replace: true,
      });
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

  // The newest sets get chips; an older set picked from All sets gets one too while it's showing.
  const chipSets = useMemo(() => {
    const list = sets.data?.sets ?? [];
    const newest = list.slice(0, SET_CHIPS);
    const picked = set && !newest.some((s) => s.id === set) ? list.find((s) => s.id === set) : undefined;
    return picked ? [...newest, picked] : newest;
  }, [sets.data, set]);
  const langWord = LANG_WORD[ui.lang];
  // The count rides in the search box, and a search's result count gets one quiet line, so the cards
  // start right under the tools.
  const placeholder =
    all && rows
      ? `Search ${rows.length.toLocaleString()} ${filtered ? "matching" : langWord} cards`
      : "Search any card, like Gengar";
  const resultLine =
    q && rows
      ? `${rows.length.toLocaleString()} ${langWord} ${rows.length === 1 ? "card matches" : "cards match"} “${q}”, newest sets first`
      : "";
  const soon = all && ui.era === "soon";

  // A changed feed starts from the top, so no other feed's position is kept to come back to.
  const toFeedTop = () => {
    forgetScroll(FEED_SCROLL);
    window.scrollTo({ top: 0 });
  };
  const { collections } = useCollections();
  const sheet = useFilterSheet();
  /** A change to the Every card feed, which starts it again from the top. */
  const feed =
    <K extends FeedKey>(key: K) =>
    (value: LiveUi[K]) => {
      patchLiveUi({ [key]: value });
      toFeedTop();
    };

  const label = <T,>(options: readonly { value: T; label: string }[], v: T) =>
    options.find((o) => o.value === v)?.label ?? String(v);
  const active: ActiveFilter[] = feedMode
    ? [
        ...(ui.look !== "any"
          ? [{ key: "look", label: label(LOOK_OPTIONS, ui.look), clear: () => feed("look")("any") }]
          : []),
        ...(ui.feedPrice !== "any"
          ? [
              {
                key: "price",
                label: label(FEED_PRICE_OPTIONS, ui.feedPrice),
                clear: () => feed("feedPrice")("any"),
              },
            ]
          : []),
        ...(ui.era !== "any"
          ? [{ key: "era", label: label(FEED_ERA_OPTIONS, ui.era), clear: () => feed("era")("any") }]
          : []),
        ...(rarity ? [{ key: "rarity", label: rarity, clear: () => feed("rarity")("") }] : []),
        ...(ui.lang !== "en"
          ? [{ key: "lang", label: LANG_WORD[ui.lang], clear: () => feed("lang")("en") }]
          : []),
      ]
    : ui.cap
      ? [{ key: "cap", label: label(CAP_OPTIONS, ui.cap), clear: () => patchLiveUi({ cap: 0 }) }]
      : [];
  const sorted = feedMode ? ui.feedSort !== DEFAULT_LIVE_UI.feedSort : ui.sort !== DEFAULT_LIVE_UI.sort;
  const clearFilters = () => {
    patchLiveUi(
      feedMode
        ? { look: "any", rarity: "", feedPrice: "any", era: "any", lang: "en" }
        : { cap: DEFAULT_LIVE_UI.cap },
    );
    if (feedMode) toFeedTop();
  };
  const resetAll = () => {
    clearFilters();
    patchLiveUi(feedMode ? { feedSort: DEFAULT_LIVE_UI.feedSort } : { sort: DEFAULT_LIVE_UI.sort });
  };

  return (
    <>
      <div className="ex-tools">
        <div className="ex-bar">
          <form
            className="flex min-w-0 flex-1"
            role="search"
            autoComplete="off"
            onSubmit={(e) => {
              e.preventDefault();
              input.current?.blur();
              commit(typed.trim());
            }}
          >
            <SearchInput
              ref={input}
              wrapClassName="flex-1"
              placeholder={placeholder}
              aria-label="Search live cards"
              enterKeyHint="search"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </form>
          <FilterButton on={active.length > 0 || sorted} onClick={sheet.show} />
        </div>
        <div className="colltabs">
          <Toggle
            pressed={all && !soon}
            onPressedChange={() => {
              showSet("");
              if (soon) feed("era")("any");
            }}
          >
            <b>Every card</b>
          </Toggle>
          {catalog.data ? (
            <SoonChip
              cat={catalog.data}
              lang={ui.lang}
              on={soon}
              onClick={() => {
                showSet("");
                feed("era")(soon ? "any" : "soon");
              }}
            />
          ) : null}
          {chipSets.map((s) => (
            <Toggle key={s.id} pressed={!q && set === s.id} onPressedChange={() => showSet(s.id)}>
              <b>{s.name}</b>
            </Toggle>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => open({ panel: "sets" })}
          >
            All sets
          </Button>
        </div>
        <ActiveFilters items={active} onClearAll={clearFilters} />
        {resultLine ? <p className="ex-meta">{resultLine}</p> : null}
      </div>
      {sheet.open ? (
        <FilterSheet
          onClose={sheet.hide}
          onReset={resetAll}
          changed={active.length > 0 || sorted}
          showLabel={
            feedMode && rows
              ? `Show ${rows.length.toLocaleString()} ${rows.length === 1 ? "card" : "cards"}`
              : "Done"
          }
        >
          {feedMode ? (
            <>
              <Choices label="Sort" value={ui.feedSort} options={FEED_SORTS} onChange={feed("feedSort")} />
              <Choices
                label="Card look"
                value={ui.look}
                options={LOOK_OPTIONS.map((l) => ({ ...l, count: lookCounts?.get(l.value) }))}
                onChange={feed("look")}
              />
              <Choices
                label="Price"
                value={ui.feedPrice}
                options={FEED_PRICE_OPTIONS}
                onChange={feed("feedPrice")}
              />
              <Choices
                label="Set released"
                value={ui.era}
                options={FEED_ERA_OPTIONS}
                onChange={feed("era")}
              />
              <FilterSection label="Rarity">
                <Select
                  aria-label="Rarity"
                  value={rarity}
                  options={rarityOptions}
                  onChange={feed("rarity")}
                />
              </FilterSection>
              <Choices label="Language" value={ui.lang} options={LANG_OPTIONS} onChange={feed("lang")} />
            </>
          ) : (
            <>
              <Choices
                label="Sort"
                value={ui.sort}
                options={SET_SORTS}
                onChange={(sort) => patchLiveUi({ sort })}
              />
              <Choices
                label="Price"
                value={ui.cap}
                options={CAP_OPTIONS}
                onChange={(cap) => patchLiveUi({ cap })}
              />
            </>
          )}
          {canWrite ? (
            <FilterSection label="Quick add goes to">
              <Select
                aria-label="Collection for added cards"
                value={ui.addTo}
                options={[
                  { value: "", label: "No collection" },
                  ...collections.map((c) => ({ value: c.name, label: c.name })),
                ]}
                onChange={(addTo) => patchLiveUi({ addTo })}
              />
            </FilterSection>
          ) : null}
        </FilterSheet>
      ) : null}
      {set ? (
        <LiveResults key={set} set={set} />
      ) : catalog.isError && !catalog.data ? (
        <LoadError
          text="Couldn't load every card. Check your connection and try again."
          onRetry={() => void catalog.refetch()}
        />
      ) : rows && catalog.data ? (
        <>
          {!q && ui.era === "soon" ? <ComingSoon cat={catalog.data} rows={rows} lang={ui.lang} /> : null}
          <EveryCardFeed
            key={q}
            cat={catalog.data}
            rows={rows}
            lang={ui.lang}
            q={q}
            filtered={filtered}
            scrollKey={`${FEED_SCROLL}${q ? `q:${q}:` : ""}${ui.lang}:${ui.feedSort}:${ui.feedPrice}:${ui.look}:${ui.era}:${ui.rarity}`}
          />
        </>
      ) : (
        <SkeletonGrid className="ex-grid" count={6} />
      )}
    </>
  );
}

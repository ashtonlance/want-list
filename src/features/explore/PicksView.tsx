import { useNavigate, useSearch } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useMemo, useRef } from "react";
import { useOverlayNav } from "~/app/overlayNav";
import { useAuth } from "~/features/auth/AuthProvider";
import { useCards } from "~/features/cards/api";
import { useAddCards } from "~/features/cards/create";
import type { Card } from "~/features/cards/types";
import { useActiveCollection } from "~/features/list/useActiveCollection";
import { formatDate, formatMoney } from "~/lib/format";
import { glide, useEnterAnimation } from "~/lib/motion";
import { useScrollRestoration } from "~/lib/scroll";
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
import { AddedMark, ExCard, PassButton, PriceTag, QuickWant } from "./ExCard";
import { useLiveCards } from "./live";
import { useCatalog } from "~/features/catalog/catalog";
import { sanitizedDates } from "~/features/catalog/feed";
import { fullArtCards, isFullArt } from "~/features/catalog/rarity";
import { usePhotoGrid } from "~/ui/Lightbox";
import { exploreLightbox } from "./display";
import { isPickAdded, pickImage, pickOnList, WILDCARDS, withLive, type PickCard } from "./picks";
import { ALL_PICKS } from "./search";
import { byRecentUse, noteCollectionUse, useRecentCollections } from "~/features/cards/recentCollections";
import {
  CAP_OPTIONS,
  DEFAULT_PICKS_UI,
  ERA_OPTIONS,
  inEra,
  patchPicksUi,
  usePicksUi,
  type PicksSort,
} from "./state";
import { usePickStatus } from "./usePickStatus";
import { usePicks } from "./usePicks";
import { rememberShown } from "./recs/shown";
import { useCollections } from "~/features/cards/useCollections";

const SORTS: readonly { value: PicksSort; label: string }[] = [
  { value: "rec", label: "Best match" },
  { value: "new", label: "Newest sets first" },
  { value: "old", label: "Oldest sets first" },
  { value: "low", label: "Price: low to high" },
  { value: "high", label: "Price: high to low" },
  { value: "name", label: "Name: A to Z" },
];

const LOOKS = [
  { value: "any", label: "Any look" },
  { value: "full", label: "Full art only" },
] as const;

interface CollTab {
  name: string;
  /** Picks still waiting for an answer. */
  open: number;
}

const isOpen = (cards: readonly Card[], p: PickCard) => p.status === "new" && !pickOnList(cards, p);

/** One tab per collection with picks: Wildcards first, then the list's collections, then the rest by name. Recently used ones go first on screen. */
function collTabs(picks: readonly PickCard[], cards: readonly Card[], order: readonly string[]): CollTab[] {
  const m = new Map<string, CollTab>();
  for (const p of picks) {
    const t = m.get(p.coll) ?? { name: p.coll, open: 0 };
    if (isOpen(cards, p)) t.open++;
    m.set(p.coll, t);
  }
  const rank = (n: string) => (n === WILDCARDS ? -1 : order.includes(n) ? order.indexOf(n) : 999);
  return [...m.values()].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
}

const pickKey = (p: PickCard) => p.tcgdexId ?? (p.tcgProduct ? `pid:${p.tcgProduct}` : p.id);

/** Rarities in the picks, most common first, for the rarity filter. */
function rarityOptions(picks: readonly PickCard[], chosen: string): { value: string; label: string }[] {
  const counts = new Map<string, number>();
  for (const p of picks) if (p.rarity) counts.set(p.rarity, (counts.get(p.rarity) ?? 0) + 1);
  if (chosen && !counts.has(chosen)) counts.set(chosen, 0);
  const names = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([n]) => n);
  return [{ value: "", label: "Any rarity" }, ...names.map((n) => ({ value: n, label: n }))];
}

/** Explore's picks: cards Claude suggested for each collection. */
export function PicksView() {
  const { coll, artist = "" } = useSearch({ from: "/explore/picks" });
  const navigate = useNavigate({ from: "/explore/picks" });
  const { picks, loaded, refilled, day } = usePicks();
  // Refill picks on screen stay put for the day, whatever loads or changes next.
  useEffect(() => {
    if (refilled) rememberShown(picks, day);
  }, [picks, refilled, day]);
  const { cards } = useCards();
  const active = useActiveCollection();
  const ui = usePicksUi();
  const { canWrite } = useAuth();
  const { fromPick } = useAddCards();
  const { open } = useOverlayNav();
  const catalog = useCatalog();
  const setDates = useMemo(() => {
    const cat = catalog.data;
    if (!cat) return new Map<string, string>();
    const dates = sanitizedDates(cat);
    const m = new Map<string, string>();
    cat.sets.forEach((s, i) => {
      const k = s.name.toLowerCase();
      if (!m.get(k)) m.set(k, dates[i] ?? "");
    });
    return m;
  }, [catalog.data]);
  const passOn = usePickStatus();
  const sheet = useFilterSheet();

  const { collections } = useCollections();
  const order = useMemo(() => collections.map((c) => c.name), [collections]);
  const used = useRecentCollections();
  const tabs = useMemo(
    () => byRecentUse(collTabs(picks, cards, order), (t) => t.name, used),
    [picks, cards, order, used],
  );
  const openAll = useMemo(
    () => new Set(picks.filter((p) => isOpen(cards, p)).map(pickKey)).size,
    [picks, cards],
  );
  // The tab in the address, else the collection the list is showing, else the first.
  const tab = !tabs.length
    ? undefined
    : coll === ALL_PICKS || tabs.some((t) => t.name === coll)
      ? (coll ?? ALL_PICKS)
      : (tabs.find((t) => t.name === active) ?? tabs[0])?.name;
  const isAll = tab === ALL_PICKS;

  // The tab's picks, newest batch first, each card once across collections.
  const base = useMemo(() => {
    const sorted = picks
      .filter((p) => isAll || p.coll === tab)
      .sort((a, b) => b.batch - a.batch || a.rank - b.rank);
    if (!isAll) return sorted;
    const seen = new Set<string>();
    return sorted.filter((p) => {
      const k = pickKey(p);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [picks, tab, isAll]);

  // Live prices and artists only for picks that can show, not every pick ever made.
  const liveIds = useMemo(
    () => [
      ...new Set(
        base
          .filter((p) => (ui.showPassed || p.status !== "passed") && !(ui.hideAdded && isPickAdded(cards, p)))
          .flatMap((p) => (p.tcgdexId ? [p.tcgdexId] : [])),
      ),
    ],
    [base, cards, ui.showPassed, ui.hideAdded],
  );
  const live = useLiveCards(liveIds);
  const all = useMemo(
    () => base.map((p) => withLive(p, p.tcgdexId ? live.map.get(p.tcgdexId) : undefined)),
    [base, live.map],
  );

  const q = ui.q.trim().toLowerCase();
  const shown = useMemo(() => {
    const dateOf = (p: PickCard) => setDates.get(p.set.toLowerCase()) ?? "";
    const cat = catalog.data;
    const art = ui.fullArt && cat ? fullArtCards(cat) : null;
    const isArt = (p: PickCard) => {
      const c = p.tcgProduct != null ? cat?.byPid.get(p.tcgProduct) : undefined;
      return c && art ? art.has(c) : isFullArt(p.rarity, p.number, { name: p.name });
    };
    const out = all.filter(
      (p) =>
        (ui.showPassed || p.status !== "passed") &&
        !(ui.hideAdded && isPickAdded(cards, p)) &&
        (!ui.cap || (p.market != null && p.market <= ui.cap)) &&
        (!ui.rarity || p.rarity === ui.rarity) &&
        (!ui.fullArt || isArt(p)) &&
        inEra(ui.era === "any" ? "" : dateOf(p), ui.era) &&
        (!artist || p.illustrator === artist) &&
        (!q ||
          [p.name, p.set, p.number, p.illustrator, p.rarity, p.coll].join(" ").toLowerCase().includes(q)),
    );
    if (ui.sort === "low") out.sort((a, b) => (a.market ?? Infinity) - (b.market ?? Infinity));
    if (ui.sort === "high") out.sort((a, b) => (b.market ?? -1) - (a.market ?? -1));
    if (ui.sort === "new") out.sort((a, b) => dateOf(b).localeCompare(dateOf(a)));
    if (ui.sort === "old") out.sort((a, b) => (dateOf(a) || "9").localeCompare(dateOf(b) || "9"));
    if (ui.sort === "name") out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, [
    all,
    cards,
    setDates,
    catalog.data,
    ui.showPassed,
    ui.hideAdded,
    ui.cap,
    ui.rarity,
    ui.fullArt,
    ui.era,
    ui.sort,
    artist,
    q,
  ]);

  const toPhoto = useCallback(
    (p: PickCard) => {
      const src = pickImage(p, p.tcgdexId ? live.map.get(p.tcgdexId) : undefined);
      return src ? { ...exploreLightbox(p, src), onDetails: () => open({ pick: p.id }) } : null;
    },
    [live.map, open],
  );
  const photoOf = usePhotoGrid(shown, toPhoto);

  // A new tab or filter fades the picks in; passing on one lets the rest glide into its place.
  const grid = useRef<HTMLDivElement>(null);
  useEnterAnimation(
    grid,
    [tab, artist, ui.sort, ui.cap, ui.rarity, ui.fullArt, ui.era, ui.showPassed, ui.hideAdded].join("|"),
  );
  const pass = (p: PickCard) => {
    const tile = document.querySelector(`[data-sr="${CSS.escape(p.id)}"]`);
    glide(
      () => passOn(p, "passed", true),
      () => !tile?.isConnected || tile.classList.contains("dim"),
    );
  };

  useScrollRestoration(`picks:${tab ?? ""}:${artist}`, loaded);

  if (!loaded) return <SkeletonGrid className="ex-grid" count={6} />;
  if (!tab)
    return (
      <div className="empty-state">
        No suggestions yet. Ask Claude in chat to find cards for your collections.
      </div>
    );

  const showTab = (next: string) => {
    if (next !== ALL_PICKS) noteCollectionUse(next);
    void navigate({ search: (prev) => ({ ...prev, coll: next }), replace: true });
  };
  const clearArtist = () =>
    void navigate({ search: (prev) => ({ ...prev, artist: undefined }), replace: true });

  const filtered = Boolean(q || ui.cap || ui.rarity || ui.fullArt || ui.era !== "any" || artist);
  const passed = all.filter((p) => p.status === "passed").length;
  const added = all.filter((p) => isPickAdded(cards, p)).length;
  const label = <T,>(options: readonly { value: T; label: string }[], v: T) =>
    options.find((o) => o.value === v)?.label ?? String(v);
  const onFilters: ActiveFilter[] = [
    ...(artist ? [{ key: "artist", label: `Art by ${artist}`, clear: clearArtist }] : []),
    ...(ui.fullArt ? [{ key: "art", label: "Full art", clear: () => patchPicksUi({ fullArt: false }) }] : []),
    ...(ui.cap
      ? [{ key: "cap", label: label(CAP_OPTIONS, ui.cap), clear: () => patchPicksUi({ cap: 0 }) }]
      : []),
    ...(ui.era !== "any"
      ? [{ key: "era", label: label(ERA_OPTIONS, ui.era), clear: () => patchPicksUi({ era: "any" }) }]
      : []),
    ...(ui.rarity ? [{ key: "rarity", label: ui.rarity, clear: () => patchPicksUi({ rarity: "" }) }] : []),
    ...(!ui.hideAdded && added
      ? [{ key: "added", label: "Showing added", clear: () => patchPicksUi({ hideAdded: true }) }]
      : []),
    ...(ui.showPassed && passed
      ? [{ key: "passed", label: "Showing passed", clear: () => patchPicksUi({ showPassed: false }) }]
      : []),
  ];
  const clearFilters = () => {
    const { cap, rarity, era, fullArt, showPassed, hideAdded } = DEFAULT_PICKS_UI;
    patchPicksUi({ cap, rarity, era, fullArt, showPassed, hideAdded });
    if (artist) clearArtist();
  };
  const latest = all.find((p) => !p.auto)?.batch ?? 1;
  const asOf = all
    .map((p) => p.priceAsOf)
    .filter(Boolean)
    .sort()
    .pop();
  const about = isAll
    ? "Every suggestion across your collections."
    : tab === WILDCARDS
      ? "Fun cards under $50 that don't belong in any of your binders. Add them loose, or start a new collection."
      : "Cards that aren't on your list yet, picked to match this collection.";
  // In best-match order, label where older hand-picked batches start and where refill picks start.
  const byMatch = !isAll && ui.sort === "rec";
  const earlierAt = byMatch && latest > 1 ? shown.findIndex((p) => !p.auto && p.batch < latest) : -1;
  const refillAt = byMatch ? shown.findIndex((p) => p.auto) : -1;

  return (
    <>
      <div className="colltabs">
        <button className="colltab" type="button" aria-pressed={isAll} onClick={() => showTab(ALL_PICKS)}>
          <b>All picks</b>
          <span>{openAll} open</span>
        </button>
        {tabs.map((t) => (
          <button
            key={t.name}
            className="colltab"
            type="button"
            aria-pressed={tab === t.name}
            onClick={() => showTab(t.name)}
          >
            <b>{t.name}</b>
            <span>{t.open === 1 ? "1 new pick" : `${t.open} new picks`}</span>
          </button>
        ))}
      </div>
      <div className="ex-intro">
        <h2>{isAll ? "All picks" : tab}</h2>
        <p>
          {about} Prices are TCGplayer market before shipping{asOf ? `, as of ${formatDate(asOf)}` : ""}.
        </p>
      </div>
      <div className="ex-tools">
        <div className="ex-bar">
          <input
            type="search"
            placeholder="Search picks, sets or artists"
            aria-label="Search picks"
            value={ui.q}
            onChange={(e) => patchPicksUi({ q: e.target.value })}
          />
          <FilterButton on={onFilters.length > 0 || ui.sort !== DEFAULT_PICKS_UI.sort} onClick={sheet.show} />
        </div>
        <ActiveFilters items={onFilters} onClearAll={clearFilters} />
      </div>
      {sheet.open ? (
        <FilterSheet
          onClose={sheet.hide}
          onReset={() => {
            clearFilters();
            patchPicksUi({ sort: DEFAULT_PICKS_UI.sort });
          }}
          changed={onFilters.length > 0 || ui.sort !== DEFAULT_PICKS_UI.sort}
          showLabel={`Show ${shown.length.toLocaleString()} ${shown.length === 1 ? "pick" : "picks"}`}
        >
          <Choices label="Sort" value={ui.sort} options={SORTS} onChange={(sort) => patchPicksUi({ sort })} />
          <Choices
            label="Card look"
            value={ui.fullArt ? "full" : "any"}
            options={LOOKS}
            onChange={(v) => patchPicksUi({ fullArt: v === "full" })}
          />
          <Choices
            label="Price"
            value={ui.cap}
            options={CAP_OPTIONS}
            onChange={(cap) => patchPicksUi({ cap })}
          />
          <Choices
            label="Set released"
            value={ui.era}
            options={ERA_OPTIONS}
            onChange={(era) => patchPicksUi({ era })}
          />
          <FilterSection label="Rarity">
            <Select
              aria-label="Rarity"
              value={ui.rarity}
              options={rarityOptions(all, ui.rarity)}
              onChange={(rarity) => patchPicksUi({ rarity })}
            />
          </FilterSection>
          {added || passed ? (
            <FilterSection label="Also show">
              <div className="choice-wrap">
                {added ? (
                  <button
                    className="chip-toggle"
                    type="button"
                    aria-pressed={!ui.hideAdded}
                    onClick={() => patchPicksUi({ hideAdded: !ui.hideAdded })}
                  >
                    Already added <span className="choice-n">{added}</span>
                  </button>
                ) : null}
                {passed ? (
                  <button
                    className="chip-toggle"
                    type="button"
                    aria-pressed={ui.showPassed}
                    onClick={() => patchPicksUi({ showPassed: !ui.showPassed })}
                  >
                    Passed <span className="choice-n">{passed}</span>
                  </button>
                ) : null}
              </div>
            </FilterSection>
          ) : null}
        </FilterSheet>
      ) : null}
      <div className="ex-grid" ref={grid}>
        {shown.map((p, i) => {
          const already = isPickAdded(cards, p);
          const quickColl = p.coll === WILDCARDS ? "" : p.coll;
          return (
            <Fragment key={p.id}>
              {i === earlierAt ? <div className="ex-sep">Earlier picks</div> : null}
              {i === refillAt && i > 0 ? <div className="ex-sep">More like this</div> : null}
              <ExCard
                sr={p.id}
                className={p.status === "passed" ? "dim" : undefined}
                label={`${p.name}, ${p.set}${p.market != null ? `, about ${formatMoney(p.market)}` : ""}`}
                img={pickImage(p, p.tcgdexId ? live.map.get(p.tcgdexId) : undefined)}
                name={p.name}
                meta={`${p.set} · #${p.number}`}
                coll={isAll ? p.coll : undefined}
                onOpen={() => open({ pick: p.id }, p.id)}
                onPhoto={photoOf(p)}
                line={
                  <>
                    <PriceTag market={p.market} prefix="~" />
                    {already ? (
                      <AddedMark have={p.status === "owned"} />
                    ) : canWrite && p.status !== "passed" ? (
                      <span className="ex-acts">
                        <PassButton name={p.name} onPass={() => pass(p)} />
                        <QuickWant
                          name={p.name}
                          coll={quickColl}
                          onWant={() => fromPick(p, "want", quickColl)}
                        />
                      </span>
                    ) : null}
                  </>
                }
              />
            </Fragment>
          );
        })}
        {shown.length ? null : (
          <div className="empty-state">
            {filtered ? "No picks match these filters." : "No more cards like these right now."}
          </div>
        )}
      </div>
      <p className="hint">
        Picks refill on their own as you add cards or pass on them. Ask Claude in chat for hand-picked ones.
      </p>
    </>
  );
}

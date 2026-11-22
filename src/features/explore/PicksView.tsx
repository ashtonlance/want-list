import { useNavigate, useSearch } from "@tanstack/react-router";
import { Fragment, useMemo } from "react";
import { useOverlayNav } from "~/app/overlayNav";
import { useAuth } from "~/features/auth/AuthProvider";
import { useCards } from "~/features/cards/api";
import { allCollections } from "~/features/cards/collections";
import { useAddCards } from "~/features/cards/create";
import type { Card } from "~/features/cards/types";
import { useActiveCollection } from "~/features/list/useActiveCollection";
import { formatDate, formatMoney } from "~/lib/format";
import { useScrollRestoration } from "~/lib/scroll";
import { Select } from "~/ui/Select";
import { SkeletonGrid } from "~/ui/Skeleton";
import { AddedMark, ExCard, PriceTag, QuickWant } from "./ExCard";
import { useLiveCards } from "./live";
import { isPickAdded, pickImage, pickOnList, usePicks, WILDCARDS, withLive, type PickCard } from "./picks";
import { ALL_PICKS } from "./search";
import { CAP_OPTIONS, patchPicksUi, usePicksUi, type PicksSort } from "./state";

const SORTS: readonly { value: PicksSort; label: string }[] = [
  { value: "rec", label: "Best match" },
  { value: "low", label: "Price: low to high" },
  { value: "high", label: "Price: high to low" },
];

interface CollTab {
  name: string;
  /** Picks still waiting for an answer. */
  open: number;
}

const isOpen = (cards: readonly Card[], p: PickCard) => p.status === "new" && !pickOnList(cards, p);

/** One tab per collection with picks: Wildcards first, then the list's collections, then the rest by name. */
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

const pickKey = (p: PickCard) => p.tcgdexId ?? p.id;

/** Explore's picks: cards Claude suggested for each collection. */
export function PicksView() {
  const { coll, artist = "" } = useSearch({ from: "/explore/picks" });
  const navigate = useNavigate({ from: "/explore/picks" });
  const { picks, loaded } = usePicks();
  const { cards } = useCards();
  const active = useActiveCollection();
  const ui = usePicksUi();
  const { canWrite } = useAuth();
  const { fromPick } = useAddCards();
  const { open } = useOverlayNav();

  const order = useMemo(() => allCollections(cards).map((c) => c.name), [cards]);
  const tabs = useMemo(() => collTabs(picks, cards, order), [picks, cards, order]);
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
    const out = all.filter(
      (p) =>
        (ui.showPassed || p.status !== "passed") &&
        !(ui.hideAdded && isPickAdded(cards, p)) &&
        (!ui.cap || (p.market != null && p.market <= ui.cap)) &&
        (!artist || p.illustrator === artist) &&
        (!q ||
          [p.name, p.set, p.number, p.illustrator, p.rarity, p.coll].join(" ").toLowerCase().includes(q)),
    );
    if (ui.sort === "low") out.sort((a, b) => (a.market ?? Infinity) - (b.market ?? Infinity));
    if (ui.sort === "high") out.sort((a, b) => (b.market ?? -1) - (a.market ?? -1));
    return out;
  }, [all, cards, ui.showPassed, ui.hideAdded, ui.cap, ui.sort, artist, q]);

  useScrollRestoration(`picks:${tab ?? ""}:${artist}`, loaded);

  if (!loaded) return <SkeletonGrid className="ex-grid" count={6} />;
  if (!tab)
    return (
      <div className="empty-state">
        No suggestions yet. Ask Claude in chat to find cards for your collections.
      </div>
    );

  const showTab = (next: string) =>
    void navigate({ search: (prev) => ({ ...prev, coll: next }), replace: true });
  const clearArtist = () =>
    void navigate({ search: (prev) => ({ ...prev, artist: undefined }), replace: true });

  const passed = all.filter((p) => p.status === "passed").length;
  const added = all.filter((p) => isPickAdded(cards, p)).length;
  const latest = all[0]?.batch ?? 1;
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
  const sepAt = !isAll && ui.sort === "rec" && latest > 1 ? shown.findIndex((p) => p.batch < latest) : -1;

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
        <input
          type="search"
          placeholder="Search picks, sets or artists"
          aria-label="Search picks"
          value={ui.q}
          onChange={(e) => patchPicksUi({ q: e.target.value })}
        />
        <div className="scroller">
          <Select
            aria-label="Price limit"
            value={ui.cap}
            options={CAP_OPTIONS}
            onChange={(cap) => patchPicksUi({ cap })}
          />
          <Select
            aria-label="Sort picks"
            value={ui.sort}
            options={SORTS}
            onChange={(sort) => patchPicksUi({ sort })}
          />
          {added ? (
            <button
              className="chip-toggle"
              type="button"
              aria-pressed={!ui.hideAdded}
              onClick={() => patchPicksUi({ hideAdded: !ui.hideAdded })}
            >
              {ui.hideAdded ? `Show ${added} already added` : "Hide added"}
            </button>
          ) : null}
          {passed ? (
            <button
              className="chip-toggle"
              type="button"
              aria-pressed={ui.showPassed}
              onClick={() => patchPicksUi({ showPassed: !ui.showPassed })}
            >
              {ui.showPassed ? "Hide passed" : `Show ${passed} passed`}
            </button>
          ) : null}
          {artist ? (
            <button
              className="chip-toggle"
              type="button"
              aria-pressed="true"
              title="Clear artist filter"
              onClick={clearArtist}
            >
              Art by {artist} ×
            </button>
          ) : null}
        </div>
      </div>
      <div className="ex-grid">
        {shown.map((p, i) => {
          const already = isPickAdded(cards, p);
          const quickColl = p.coll === WILDCARDS ? "" : p.coll;
          return (
            <Fragment key={p.id}>
              {i === sepAt ? <div className="ex-sep">Earlier picks</div> : null}
              <ExCard
                sr={p.id}
                className={p.status === "passed" ? "dim" : undefined}
                label={`${p.name}, ${p.set}${p.market != null ? `, about ${formatMoney(p.market)}` : ""}`}
                img={pickImage(p, p.tcgdexId ? live.map.get(p.tcgdexId) : undefined)}
                name={p.name}
                meta={`${p.set} · #${p.number}`}
                coll={isAll ? p.coll : undefined}
                onOpen={() => open({ pick: p.id })}
                line={
                  <>
                    <PriceTag market={p.market} prefix="~" />
                    {already ? (
                      <AddedMark have={p.status === "owned"} />
                    ) : canWrite && p.status !== "passed" ? (
                      <QuickWant
                        name={p.name}
                        coll={quickColl}
                        onWant={() => fromPick(p, "want", quickColl)}
                      />
                    ) : null}
                  </>
                }
              />
            </Fragment>
          );
        })}
        {shown.length ? null : (
          <div className="empty-state">
            {q || ui.cap || artist
              ? "No picks match these filters."
              : "You've been through every pick here. Ask Claude in chat for more."}
          </div>
        )}
      </div>
      <p className="hint">
        Want fresh picks, or picks for a new collection? Ask Claude in chat to refresh Explore.
      </p>
    </>
  );
}

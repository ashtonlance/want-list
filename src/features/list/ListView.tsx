import { useCallback, useEffect, useMemo } from "react";
import { prefs } from "~/app/prefs";
import { useOverlayNav } from "~/app/overlayNav";
import { useAuth } from "~/features/auth/AuthProvider";
import { useCards } from "~/features/cards/api";
import { allCollections } from "~/features/cards/collections";
import { visibleCards } from "~/features/cards/filters";
import type { Card } from "~/features/cards/types";
import { useScrollRestoration } from "~/lib/scroll";
import { useStore } from "~/lib/store";
import { SkeletonGrid } from "~/ui/Skeleton";
import { BulkBar } from "./BulkBar";
import { CardRow, CardTile } from "./CardItem";
import { CollectionBinder } from "./CollectionBinder";
import { CollectionHead } from "./CollectionHead";
import { CollectionTabs } from "./CollectionTabs";
import { Filters } from "./Filters";
import { Stats } from "./Stats";
import { toggleSelected, useListUi } from "./state";
import { useActiveCollection } from "./useActiveCollection";

function emptyText(hasCards: boolean, coll: string | null, canWrite: boolean): string {
  if (hasCards)
    return coll ? `No cards in ${coll} match these filters. Try All.` : "No cards match these filters.";
  return canWrite ? "No cards yet. Tap + to add your first one." : "No cards on the list yet.";
}

/** Hides the tab bar while picking cards, so the selection bar has the bottom of the screen. */
function useSelectingClass(selecting: boolean): void {
  useEffect(() => {
    document.body.classList.toggle("selecting", selecting);
    return () => document.body.classList.remove("selecting");
  }, [selecting]);
}

export function ListView() {
  const { cards, loaded, failed } = useCards();
  const { canWrite, ready } = useAuth();
  const ui = useListUi();
  const coll = useActiveCollection();
  const view = useStore(prefs.view);
  const pockets = useStore(prefs.pockets);
  const layout = useStore(prefs.layout);
  const sort = useStore(prefs.sort);
  const { open } = useOverlayNav();

  const colls = useMemo(() => allCollections(cards), [cards]);
  const binder = coll !== null && view === "binder" && !ui.selecting;
  // While picking cards for the collection on screen, show the whole list so others can be added.
  const filterColl = ui.selecting && ui.bulkColl.trim() === coll ? null : coll;
  const rows = useMemo(
    () => visibleCards(cards, { status: ui.status, coll: filterColl, prio: ui.prio, q: ui.q, sort }),
    [cards, ui.status, filterColl, ui.prio, ui.q, sort],
  );

  useSelectingClass(ui.selecting);
  useScrollRestoration(`list:${coll ?? ""}:${binder ? "binder" : "list"}`, loaded);

  const activate = useCallback(
    (c: Card) => (ui.selecting ? toggleSelected(c.id) : open({ card: c.id })),
    [ui.selecting, open],
  );

  const Item = layout === "rows" ? CardRow : CardTile;
  let body;
  if (binder) body = <CollectionBinder cards={cards} coll={coll} pockets={pockets} canWrite={canWrite} />;
  else if (!loaded && !failed) body = <SkeletonGrid className="list grid" count={9} />;
  else if (!rows.length)
    body = <div className="empty-state">{emptyText(cards.length > 0, coll, canWrite)}</div>;
  else
    body = (
      <div className={"list " + layout}>
        {rows.map((c) => (
          <Item
            key={c.id}
            card={c}
            selecting={ui.selecting}
            selected={ui.selected.has(c.id)}
            canWrite={canWrite}
            onActivate={activate}
          />
        ))}
      </div>
    );

  return (
    <div className="view">
      <Stats cards={cards} loaded={loaded} />
      {failed ? (
        <div className="banner">Couldn&apos;t load the list. Check your connection and try again.</div>
      ) : null}
      {ready && !canWrite ? (
        <div
          className="banner tap"
          role="button"
          tabIndex={0}
          onClick={() => open({ panel: "account" })}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") open({ panel: "account" });
          }}
        >
          You&apos;re viewing Ashton&apos;s list. Tap Sign in to make changes.
        </div>
      ) : null}
      <section className="collbar" aria-label="Collections">
        <CollectionTabs colls={colls} current={coll} cardCount={cards.length} canWrite={canWrite} />
        <CollectionHead cards={cards} coll={coll} canWrite={canWrite} />
      </section>
      {binder ? null : <Filters count={rows.length} />}
      {body}
      {ui.selecting ? <BulkBar cards={cards} visible={rows} coll={coll} /> : null}
    </div>
  );
}

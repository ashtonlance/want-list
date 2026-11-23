import { useCallback, useEffect, useMemo, useRef } from "react";
import { prefs } from "~/app/prefs";
import { useOverlayNav } from "~/app/overlayNav";
import { useAuth } from "~/features/auth/AuthProvider";
import { SignInHint } from "~/features/auth/SignInHint";
import { useCards, useCardWrites } from "~/features/cards/api";
import { visibleCards } from "~/features/cards/filters";
import type { Card } from "~/features/cards/types";
import { useEnterAnimation } from "~/lib/motion";
import { useScrollRestoration } from "~/lib/scroll";
import { useStore } from "~/lib/store";
import { cardImageSrc } from "~/features/cards/image";
import { lightboxItem } from "~/features/cards/lightboxItem";
import { isGot } from "~/features/cards/pricing";
import { usePhotoGrid } from "~/ui/Lightbox";
import { LoadError } from "~/ui/LoadError";
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
import { useCollections } from "~/features/cards/useCollections";

const NO_CARDS: readonly Card[] = [];

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
  const { cards, loaded, failed, retry } = useCards();
  const { canWrite } = useAuth();
  const ui = useListUi();
  const coll = useActiveCollection();
  const view = useStore(prefs.view);
  const pockets = useStore(prefs.pockets);
  const layout = useStore(prefs.layout);
  const sort = useStore(prefs.sort);
  const { open } = useOverlayNav();

  const colls = useCollections().collections;
  const binder = coll !== null && view === "binder" && !ui.selecting;
  // While picking cards for the collection on screen, show the whole list so others can be added.
  const filterColl = ui.selecting && ui.bulkColl.trim() === coll ? null : coll;
  const rows = useMemo(
    () => visibleCards(cards, { status: ui.status, coll: filterColl, prio: ui.prio, q: ui.q, sort }),
    [cards, ui.status, filterColl, ui.prio, ui.q, sort],
  );

  useSelectingClass(ui.selecting);
  useScrollRestoration(`list:${coll ?? ""}:${binder ? "binder" : "list"}`, loaded);
  // A new collection, filter, sort or layout fades the cards in rather than swapping them.
  const grid = useRef<HTMLDivElement>(null);
  useEnterAnimation(grid, `${coll ?? ""}|${ui.status}|${String(ui.prio)}|${sort}|${layout}`);

  const activate = useCallback(
    (c: Card) => (ui.selecting ? toggleSelected(c.id) : open({ card: c.id }, c.id)),
    [ui.selecting, open],
  );

  const { save } = useCardWrites();
  const toPhoto = useCallback(
    (c: Card) => {
      const src = cardImageSrc(c);
      if (!src) return null;
      const item = { ...lightboxItem(c, src), onDetails: () => open({ card: c.id }) };
      if (!canWrite || isGot(c)) return item;
      return {
        ...item,
        action: {
          key: c.id,
          label: "Got it",
          doneLabel: "Got it ✓",
          run: () => save(c, { status: "got" }, "Marked as got"),
        },
      };
    },
    [open, canWrite, save],
  );
  const photoOf = usePhotoGrid(binder ? NO_CARDS : rows, toPhoto);

  const Item = layout === "rows" ? CardRow : CardTile;
  let body;
  if (binder) body = <CollectionBinder cards={cards} coll={coll} pockets={pockets} canWrite={canWrite} />;
  else if (failed)
    body = <LoadError text="Couldn't load the list. Check your connection and try again." onRetry={retry} />;
  else if (!loaded) body = <SkeletonGrid className="list grid" count={9} />;
  else if (!rows.length)
    body = <div className="empty-state">{emptyText(cards.length > 0, coll, canWrite)}</div>;
  else
    body = (
      <div className={"list " + layout} ref={grid}>
        {rows.map((c) => (
          <Item
            key={c.id}
            card={c}
            selecting={ui.selecting}
            selected={ui.selected.has(c.id)}
            canWrite={canWrite}
            onActivate={activate}
            onPhoto={photoOf(c)}
          />
        ))}
      </div>
    );

  return (
    <div className="view">
      <Stats cards={cards} loaded={loaded} status={ui.status} coll={coll} />
      <SignInHint />
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

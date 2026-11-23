import { useNavigate } from "@tanstack/react-router";
import { useOverlayNav } from "~/app/overlayNav";
import { useMemo, useState } from "react";
import { prefs } from "~/app/prefs";
import { useAuth } from "~/features/auth/AuthProvider";
import { useCards } from "~/features/cards/api";
import { collectionCards } from "~/features/cards/collections";
import { formatMoney, plural } from "~/lib/format";
import { useScrollRestoration } from "~/lib/scroll";
import { useStore } from "~/lib/store";
import { LoadError } from "~/ui/LoadError";
import { SkeletonGrid } from "~/ui/Skeleton";
import { BinderPages } from "./BinderPages";
import { BinderSheet, type BinderSheetActions } from "./BinderSheet";
import { newBinderId } from "./parse";
import { emptySlots, pageCount, startingSlots, slotInfo, swapSlots, withSlot, type SlotInfo } from "./slots";
import type { Binder } from "./types";
import { useAddToList } from "./useAddToList";
import { setBinderPage, useBinderPage } from "./state";
import { useBinderSheet } from "./useBinderSheet";
import { useBinders } from "./useBinders";
import { useMediaQuery } from "./useMediaQuery";
import { useSlotChange } from "./useSlotChange";

/** Binders: lay out pages from cards on the list or any card in the catalog. */
export function BindersView() {
  const {
    binders,
    loaded,
    failed,
    retry,
    local,
    save,
    remove,
    deviceOnly,
    moveDeviceBinders,
    discardDeviceBinders,
  } = useBinders();
  const { cards } = useCards();
  const { canWrite, email } = useAuth();
  const navigate = useNavigate();
  const { open } = useOverlayNav();
  const addToList = useAddToList();
  const changeSlots = useSlotChange(save);
  const curId = useStore(prefs.binder);
  const binder = binders.find((b) => b.id === curId) ?? binders[0] ?? null;
  const wantedPage = useBinderPage(binder?.id);
  const setPage = (page: number) => {
    if (binder) setBinderPage(binder.id, page);
  };
  const [moving, setMoving] = useState<number | null>(null);
  const { sheet, open: openSheet, close: closeSheet } = useBinderSheet();
  const per = useMediaQuery("(max-width:620px)") ? 1 : 2;
  useScrollRestoration(`binders:${binder?.id ?? ""}`, loaded);

  const cardsById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const infos = useMemo(
    () => (binder ? binder.slots.map((s) => slotInfo(s, cardsById)) : []),
    [binder, cardsById],
  );
  const canScan = canWrite && !local;
  const scan = () => void navigate({ to: "/binders/scan" });

  const choose = (id: string | null) => {
    prefs.binder.set(id);
    setMoving(null);
  };

  const actions: BinderSheetActions = {
    open: openSheet,
    close: closeSheet,
    scan,
    make(name, pockets, from) {
      const ids = from ? collectionCards(cards, from).map((c) => c.id) : [];
      const b: Binder = {
        id: newBinderId(),
        name,
        pockets,
        slots: startingSlots(pockets, ids),
        createdAt: new Date().toISOString(),
        updatedAt: "",
      };
      closeSheet();
      choose(b.id);
      void save(b, ids.length ? `Made ${name} with ${plural(ids.length, "card")}` : `Made ${name}`);
    },
    importBinder(b) {
      closeSheet();
      choose(b.id);
      void save(b, `Imported ${b.name}`);
    },
    saveOptions(b) {
      closeSheet();
      void save(b, "Saved");
    },
    changeSlots(slots, message) {
      if (!binder) return;
      closeSheet();
      changeSlots(binder, slots, message);
    },
    deleteBinder() {
      if (!binder) return;
      closeSheet();
      choose(binders.find((b) => b.id !== binder.id)?.id ?? null);
      void remove(binder);
    },
    startMove(idx) {
      closeSheet();
      setMoving(idx);
    },
    async addToList(idx, s) {
      if (!binder) return;
      const id = await addToList(s);
      if (!id) return;
      closeSheet();
      void save(
        { ...binder, slots: withSlot(binder.slots, idx, { k: "c", id }) },
        `Added ${s.n} to your want list`,
      );
    },
  };

  const onPocket = (i: number) => {
    if (!binder) return;
    if (moving === null) {
      openSheet({ kind: infos[i] ? "pocket" : "pick", idx: i });
      return;
    }
    setMoving(null);
    if (moving === i) return;
    const slots = swapSlots(binder.slots, moving, i);
    changeSlots(binder, slots, slots[moving] ? "Swapped" : "Moved");
  };

  const pages = binder ? pageCount(binder) : 1;
  const clamped = Math.min(wantedPage, pages - 1);
  const page = clamped - (clamped % per);

  return (
    <section className="view">
      {local ? (
        <div className="banner">
          {email
            ? `You're signed in as ${email}, which can't edit the shared binders, so binder changes save on this device. To send one to Ashton, open Binder options and tap Text it.`
            : "You're not signed in, so binder changes save on this device. To send one to Ashton, open Binder options and tap Text it."}{" "}
          <button className="link-btn" type="button" onClick={() => open({ panel: "account" })}>
            {email ? "Account" : "Sign in"}
          </button>
        </div>
      ) : null}
      {deviceOnly.length ? (
        <div className="banner">
          {deviceOnly.length === 1
            ? `${deviceOnly[0]?.name ?? "A binder"} is saved only on this device.`
            : `${deviceOnly.length} binders are saved only on this device.`}{" "}
          Move {deviceOnly.length === 1 ? "it" : "them"} to the shared binders?
          <div className="row-btns" style={{ marginTop: 10 }}>
            <button className="btn small primary" type="button" onClick={() => void moveDeviceBinders()}>
              Move to shared
            </button>
            <button className="btn small" type="button" onClick={discardDeviceBinders}>
              Remove from this device
            </button>
          </div>
        </div>
      ) : null}
      <div className="colltabs" role="tablist" aria-label="Binders">
        {binders.map((b) => (
          <button
            key={b.id}
            className="colltab"
            type="button"
            aria-pressed={b.id === binder?.id}
            onClick={() => choose(b.id)}
          >
            <b>{b.name}</b>
            <span>
              {b.slots.filter(Boolean).length} of {b.slots.length} pockets
            </span>
          </button>
        ))}
        <button className="colltab new" type="button" onClick={() => openSheet({ kind: "new" })}>
          + New binder
        </button>
        {canScan ? (
          <button className="colltab new" type="button" onClick={scan}>
            Scan pages
          </button>
        ) : null}
      </div>
      {binder ? (
        <>
          <BinderHead binder={binder} infos={infos} onOptions={() => openSheet({ kind: "options" })} />
          {moving !== null ? (
            <div className="movebar" role="status">
              <span>Tap the pocket where it should go.</span>
              <button className="btn small" type="button" onClick={() => setMoving(null)}>
                Cancel
              </button>
            </div>
          ) : null}
          <BinderPages
            binder={binder}
            infos={infos}
            page={page}
            per={per}
            moving={moving}
            onPage={setPage}
            onPocket={onPocket}
          />
          <div className="binder-tools">
            <button
              className="btn small"
              type="button"
              onClick={() => {
                const next = { ...binder, slots: [...binder.slots, ...emptySlots(binder.pockets)] };
                setPage(pageCount(next) - 1);
                void save(next, `Added page ${pageCount(next)}`);
              }}
            >
              + Add a page
            </button>
            <span className="hint" style={{ margin: 0 }}>
              Tap an empty pocket to add a card. Tap a card to move, swap or remove it.
            </span>
          </div>
        </>
      ) : loaded ? (
        <div className="empty-state">
          <p style={{ margin: "0 0 12px" }}>
            Lay out binder pages before you buy. Tap a pocket, pick a card from your list or any card that
            exists, and move things around until the page looks right.
          </p>
          <div className="row-btns" style={{ justifyContent: "center" }}>
            <button className="btn primary" type="button" onClick={() => openSheet({ kind: "new" })}>
              Make your first binder
            </button>
            {canScan ? (
              <button className="btn" type="button" onClick={scan}>
                Scan binder pages
              </button>
            ) : null}
          </div>
        </div>
      ) : failed ? (
        <LoadError text="Couldn't load the binders. Check your connection and try again." onRetry={retry} />
      ) : (
        <SkeletonGrid className="ex-grid" count={4} />
      )}
      {sheet ? (
        <BinderSheet
          sheet={sheet}
          binder={binder}
          infos={infos}
          cards={cards}
          local={local}
          canScan={canScan}
          canAddToList={canWrite}
          actions={actions}
        />
      ) : null}
    </section>
  );
}

interface BinderHeadProps {
  binder: Binder;
  infos: readonly (SlotInfo | null)[];
  onOptions: () => void;
}

function BinderHead({ binder, infos, onOptions }: BinderHeadProps) {
  const filled = infos.flatMap((i) => (i ? [i] : []));
  const owned = filled.filter((i) => i.got).length;
  const cost = filled.reduce((sum, i) => sum + (i.got ? 0 : (i.price ?? 0)), 0);
  return (
    <div className="bhead">
      <p className="bsum">
        {filled.length} of {binder.slots.length} pockets filled · {owned} owned · {formatMoney(cost)} to
        finish
      </p>
      <button className="btn small" type="button" onClick={onOptions}>
        Binder options
      </button>
    </div>
  );
}

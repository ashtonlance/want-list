import { PlusIcon } from "lucide-react";
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
import { Alert } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Rail, RailAction, RailItem } from "~/ui/Rail";
import { Empty, EmptyDescription } from "~/components/ui/empty";
import { SignInLink } from "~/features/auth/SignInHint";
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
import { useMediaQuery } from "~/lib/useMediaQuery";
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
  const mouse = useMediaQuery("(hover: hover) and (pointer: fine)");
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
    onMove(moving, i);
  };

  /** Moves the card in pocket `from` to pocket `to`, swapping it with any card there. */
  const onMove = (from: number, to: number) => {
    if (!binder || from === to) return;
    const slots = swapSlots(binder.slots, from, to);
    changeSlots(binder, slots, slots[from] ? "Swapped" : "Moved");
  };

  const pages = binder ? pageCount(binder) : 1;
  const clamped = Math.min(wantedPage, pages - 1);
  const page = clamped - (clamped % per);

  return (
    <section className="view">
      {local ? (
        <Alert>
          {email
            ? `You're signed in as ${email}, which can't edit the shared binders, so binder changes save on this device. To send one to Ashton, open Binder options and tap Text it.`
            : "You're not signed in, so binder changes save on this device. To send one to Ashton, open Binder options and tap Text it."}{" "}
          <SignInLink signedIn={!!email} onClick={() => open({ panel: "account" })} />
        </Alert>
      ) : null}
      {deviceOnly.length ? (
        <Alert>
          {deviceOnly.length === 1
            ? `${deviceOnly[0]?.name ?? "A binder"} is saved only on this device.`
            : `${deviceOnly.length} binders are saved only on this device.`}{" "}
          Move {deviceOnly.length === 1 ? "it" : "them"} to the shared binders?
          <div className="row-btns mt-2.5">
            <Button variant="default" size="sm" onClick={() => void moveDeviceBinders()}>
              Move to shared
            </Button>
            <Button size="sm" onClick={discardDeviceBinders}>
              Remove from this device
            </Button>
          </div>
        </Alert>
      ) : null}
      <Rail label="Binders">
        {binders.map((b) => {
          const filled = b.slots.filter(Boolean).length;
          return (
            <RailItem
              key={b.id}
              label={b.name}
              sub={`${filled} of ${b.slots.length} pockets`}
              progress={b.slots.length ? filled / b.slots.length : 0}
              pressed={b.id === binder?.id}
              onPick={() => choose(b.id)}
            />
          );
        })}
        <RailAction onClick={() => openSheet({ kind: "new" })}>
          <PlusIcon />
          New binder
        </RailAction>
        {canScan ? <RailAction onClick={scan}>Scan pages</RailAction> : null}
      </Rail>
      {binder ? (
        <>
          <BinderHead binder={binder} infos={infos} onOptions={() => openSheet({ kind: "options" })} />
          {moving !== null ? (
            <div className="movebar" role="status">
              <span>Tap the pocket where it should go.</span>
              <Button size="sm" className="bg-background text-foreground" onClick={() => setMoving(null)}>
                Cancel
              </Button>
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
            onMove={mouse ? onMove : undefined}
          />
          <div className="binder-tools">
            <Button
              size="sm"
              onClick={() => {
                const next = { ...binder, slots: [...binder.slots, ...emptySlots(binder.pockets)] };
                setPage(pageCount(next) - 1);
                void save(next, `Added page ${pageCount(next)}`);
              }}
            >
              <PlusIcon />
              Add a page
            </Button>
            <span className="hint m-0">
              {mouse
                ? "Click an empty pocket to add a card. Drag a card to move or swap it, or click it for more."
                : "Tap an empty pocket to add a card. Tap a card to move, swap or remove it."}
            </span>
          </div>
        </>
      ) : loaded ? (
        <Empty>
          <EmptyDescription>
            Lay out binder pages before you buy. Tap a pocket, pick a card from your list or any card that
            exists, and move things around until the page looks right.
          </EmptyDescription>
          <div className="row-btns mt-3 justify-center">
            <Button variant="default" onClick={() => openSheet({ kind: "new" })}>
              Make your first binder
            </Button>
            {canScan ? <Button onClick={scan}>Scan binder pages</Button> : null}
          </div>
        </Empty>
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
      <Button size="sm" onClick={onOptions}>
        Binder options
      </Button>
    </div>
  );
}

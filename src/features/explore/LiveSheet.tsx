import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Skeleton } from "~/components/ui/skeleton";
import { useAuth } from "~/features/auth/AuthProvider";
import { SignInHint } from "~/features/auth/SignInHint";
import { useCards } from "~/features/cards/api";
import { findOnList, useAddCards, type WantOrGot } from "~/features/cards/create";
import { isGot } from "~/features/cards/pricing";
import { formatDate, formatMoney } from "~/lib/format";
import { HeroImage } from "~/ui/CardImage";
import { useLightbox } from "~/ui/Lightbox";
import { LoadError } from "~/ui/LoadError";
import { Sheet, SheetHead } from "~/ui/Sheet";
import { useCloseWhen } from "~/ui/useCloseWhen";
import { exploreLightbox, listMark } from "./display";
import { useLiveCard } from "./live";
import { ShopLinks } from "./ShopLinks";
import { useQuickAddTo } from "./quickAdd";
import type { LiveCard } from "./tcgdex";
import { useCollections } from "~/features/cards/useCollections";

/** A card from Explore's live data or the daily catalog: picture, today's price, and adding it. */
export function LiveSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { card, failed, missing, retry } = useLiveCard(id);
  useCloseWhen(missing, onClose);
  return (
    <Sheet label="Card details" onClose={onClose} contentKey={id} dock>
      <SheetHead title={id.startsWith("cat:") ? "Card" : "Live card"} />
      {card ? (
        <LiveDetail key={id} card={card} />
      ) : (
        <>
          <div className="detail-hero">
            <Skeleton className="detail-img rounded-[14px]" />
            <div className="detail-info">
              <Skeleton className="h-[11px] w-3/5" />
              <Skeleton className="h-[11px] w-2/5" />
            </div>
          </div>
          {failed ? <LoadError text="Couldn't load this card." onRetry={retry} /> : null}
        </>
      )}
    </Sheet>
  );
}

function LiveDetail({ card: d }: { card: LiveCard }) {
  const { cards } = useCards();
  const { canWrite } = useAuth();
  const showPhoto = useLightbox();
  const have = findOnList(cards, d);
  const img = d.img;

  return (
    <>
      <div className="detail-hero">
        {img ? (
          <button
            className="detail-img"
            type="button"
            aria-label={`Show ${d.name} full screen`}
            onClick={() => showPhoto(exploreLightbox(d, img, listMark(have)))}
          >
            <HeroImage key={img} src={img} name={d.name} />
          </button>
        ) : (
          <div className="detail-img empty">No photo</div>
        )}
        <div className="detail-info">
          <div className="name">{d.name}</div>
          <div className="meta">
            <span>{d.set}</span>
            <span className="num">#{d.number}</span>
          </div>
          <div className="meta">
            {d.rarity ? <span>{d.rarity}</span> : null}
            {d.illustrator ? <span>art by {d.illustrator}</span> : null}
          </div>
          {d.market != null ? (
            <div className="price">
              <div className="ask">{formatMoney(d.market)}</div>
              <div className="ask-label">
                TCGplayer market
                {d.low != null ? `, listings from ${formatMoney(d.low)}` : ""}
                {d.upd ? ` · ${formatDate(d.upd)}` : ""}
              </div>
            </div>
          ) : (
            <div className="none">No TCGplayer price yet</div>
          )}
        </div>
      </div>
      {have ? (
        <div className="detail-note" style={{ marginTop: 16 }}>
          {isGot(have) ? "✓ Got it" : "✓ On your list"}
        </div>
      ) : canWrite ? (
        <LiveActions card={d} />
      ) : (
        <SignInHint line action="add cards" />
      )}
      <ShopLinks name={d.name} set={d.set} number={d.number} pid={d.pid} />
    </>
  );
}

/** Add to a collection as wanted or owned. */
function LiveActions({ card: d }: { card: LiveCard }) {
  const { fromLive } = useAddCards();
  const quickAddTo = useQuickAddTo();
  // Explore's quick add collection until another is picked here.
  const [picked, setColl] = useState<string | null>(null);
  const coll = picked ?? quickAddTo;
  const [busy, setBusy] = useState(false);
  const names = useCollections().collections.map((c) => c.name);

  const add = async (want: WantOrGot) => {
    setBusy(true);
    // On success the card shows as on the list and these buttons go away.
    if (!(await fromLive(d, want, coll))) setBusy(false);
  };

  return (
    <div className="sec">
      <Label className="mb-2.5">
        <span>Add to</span>
        <NativeSelect
          aria-label={`Collection for ${d.name}`}
          value={coll}
          onChange={(e) => setColl(e.target.value)}
        >
          {["", ...names].map((n) => (
            <NativeSelectOption key={n} value={n}>
              {n || "No collection"}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Label>
      <div className="detail-acts" style={{ marginTop: 4 }}>
        <Button variant="default" disabled={busy} onClick={() => void add("want")}>
          Want it
        </Button>
        <Button disabled={busy} onClick={() => void add("got")}>
          Got it
        </Button>
      </div>
    </div>
  );
}

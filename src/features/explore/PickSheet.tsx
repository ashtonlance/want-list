import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "~/features/auth/AuthProvider";
import { SignInHint } from "~/features/auth/SignInHint";
import { useCards } from "~/features/cards/api";
import { useAddCards, type WantOrGot } from "~/features/cards/create";
import { formatDate, formatMoney } from "~/lib/format";
import { HeroImage } from "~/ui/CardImage";
import { useLightbox } from "~/ui/Lightbox";
import { Sheet, SheetHead } from "~/ui/Sheet";
import { useCloseWhen } from "~/ui/useCloseWhen";
import { exploreLightbox } from "./display";
import { useLiveCard } from "./live";
import { isPickAdded, pickImage, WILDCARDS, withLive, type PickCard, type PickStatus } from "./picks";
import { ALL_PICKS } from "./search";
import { ShopLinks } from "./ShopLinks";
import { usePickStatus } from "./usePickStatus";
import { usePicks } from "./usePicks";
import { useCollections } from "~/features/cards/useCollections";

/** A card Claude picked: why, today's price, and adding or passing on it. */
export function PickSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { picks, loaded } = usePicks();
  const pick = picks.find((p) => p.id === id);
  useCloseWhen(loaded && !pick, onClose);
  if (!pick) return null;
  return (
    <Sheet label="Card details" onClose={onClose} contentKey={id}>
      <PickDetail key={id} pick={pick} />
    </Sheet>
  );
}

function PickDetail({ pick }: { pick: PickCard }) {
  const { card: live } = useLiveCard(pick.tcgdexId);
  const p = withLive(pick, live ?? undefined);
  const { cards } = useCards();
  const { canWrite } = useAuth();
  const showPhoto = useLightbox();
  const navigate = useNavigate();
  const src = pickImage(p, live ?? undefined);
  const why = p.reason.replace(` · ${p.rarity}`, "");

  // Replacing the sheet's own history entry, so going back from the artist's picks skips the sheet.
  const showArtist = (artist: string) =>
    void navigate({ to: "/explore/picks", search: { coll: ALL_PICKS, artist }, replace: true });

  return (
    <>
      <SheetHead title={p.coll === WILDCARDS ? "Wildcard pick" : `Pick for ${p.coll}`} />
      <div className="detail-hero">
        {src ? (
          <button
            className="detail-img"
            type="button"
            aria-label={`Show ${p.name} full screen`}
            onClick={() => showPhoto(exploreLightbox(p, src))}
          >
            <HeroImage key={src} src={src} name={p.name} />
          </button>
        ) : (
          <div className="detail-img empty">No photo</div>
        )}
        <div className="detail-info">
          <div className="name">{p.name}</div>
          <div className="meta">
            <span>{p.set}</span>
            <span className="num">#{p.number}</span>
          </div>
          <div className="meta">
            {p.rarity ? <span>{p.rarity}</span> : null}
            {p.illustrator ? (
              <span>
                art by{" "}
                <button
                  className="artist"
                  type="button"
                  title={`More picks by ${p.illustrator}`}
                  onClick={() => showArtist(p.illustrator)}
                >
                  {p.illustrator}
                </button>
              </span>
            ) : null}
          </div>
          {p.market != null ? (
            <div className="price">
              <div className="ask">~{formatMoney(p.market)}</div>
              <div className="ask-label">
                {p.live ? "Live TCGplayer market" : "TCGplayer market"}, before shipping
                {p.priceAsOf ? ` · ${formatDate(p.priceAsOf)}` : ""}
              </div>
            </div>
          ) : (
            <div className="none">No market price yet</div>
          )}
        </div>
      </div>
      {why ? (
        <p className="detail-why" style={{ marginTop: 14 }}>
          {why}
        </p>
      ) : null}
      {isPickAdded(cards, p) ? (
        <div className="detail-note" style={{ marginTop: 16 }}>
          {p.status === "owned" ? "✓ You have it" : "✓ On your list"}
        </div>
      ) : canWrite ? (
        <PickActions pick={p} />
      ) : (
        <SignInHint line action="add cards" />
      )}
      <ShopLinks name={p.name} set={p.set} number={p.number} pid={p.tcgProduct} />
    </>
  );
}

/** Add to a collection as wanted or owned, or pass on it (and bring it back). */
function PickActions({ pick: p }: { pick: PickCard }) {
  const { fromPick } = useAddCards();
  const wild = p.coll === WILDCARDS;
  const names = useCollections().collections.map((c) => c.name);
  const choices = wild ? ["", ...names] : names.includes(p.coll) ? names : [p.coll, ...names];
  const [coll, setColl] = useState(wild ? "" : p.coll);
  const [busy, setBusy] = useState(false);

  const add = async (want: WantOrGot) => {
    setBusy(true);
    // On success the pick shows as added and these buttons go away.
    if (!(await fromPick(p, want, coll))) setBusy(false);
  };

  const saveStatus = usePickStatus();
  const setStatus = (status: PickStatus) => saveStatus(p, status);

  return (
    <div className="sec">
      <label className="ex-to">
        <span>Add to</span>
        <select
          aria-label={`Collection for ${p.name}`}
          value={coll}
          onChange={(e) => setColl(e.target.value)}
        >
          {choices.map((n) => (
            <option key={n} value={n}>
              {n || "No collection"}
            </option>
          ))}
        </select>
      </label>
      <div className="detail-acts" style={{ marginTop: 4 }}>
        <button className="btn primary wide" type="button" disabled={busy} onClick={() => void add("want")}>
          Want it
        </button>
        <button className="btn" type="button" disabled={busy} onClick={() => void add("got")}>
          I have it
        </button>
        {p.status === "passed" ? (
          <button className="btn" type="button" onClick={() => void setStatus("new")}>
            Bring back
          </button>
        ) : (
          <button className="btn" type="button" onClick={() => void setStatus("passed")}>
            Not for me
          </button>
        )}
      </div>
    </div>
  );
}

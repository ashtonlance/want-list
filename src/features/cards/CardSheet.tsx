import { useMemo, useState } from "react";
import { useAuth } from "~/features/auth/AuthProvider";
import { SignInHint } from "~/features/auth/SignInHint";
import { showCollection } from "~/features/list/state";
import { formatDate, formatMoney } from "~/lib/format";
import { HeroImage } from "~/ui/CardImage";
import { StarIcon } from "~/ui/icons";
import { useCloseWhen } from "~/ui/useCloseWhen";
import { useLightbox } from "~/ui/Lightbox";
import { Sheet, SheetHead } from "~/ui/Sheet";
import { useCardWrites, useCards } from "./api";
import { knownSets } from "./collections";
import { EditForm } from "./EditForm";
import { cardImageSrc } from "./image";
import { lightboxItem } from "./lightboxItem";
import { OwnedSection } from "./OwnedSection";
import { marketLinks } from "./links";
import { PriceBlock } from "./PriceBlock";
import { isGot } from "./pricing";
import { TagPicker } from "./TagPicker";
import type { Card } from "./types";
import { usePhotoUpload } from "./usePhotoUpload";

type Panel = "tags" | "edit" | "remove" | null;

/** A card on the list: photo, price, quick actions, shops and edits. */
export function CardSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { cards, loaded } = useCards();
  const card = cards.find((c) => c.id === id);
  // Removed, here or on another device, or opened from a link to a card that's gone.
  useCloseWhen(loaded && !card, onClose);
  if (!card) return null;
  return (
    <Sheet label="Card details" onClose={onClose} contentKey={id}>
      <CardDetail key={id} card={card} cards={cards} onClose={onClose} />
    </Sheet>
  );
}

function CardDetail({
  card: c,
  cards,
  onClose,
}: {
  card: Card;
  cards: readonly Card[];
  onClose: () => void;
}) {
  const { canWrite } = useAuth();
  const { save, remove } = useCardWrites();
  const showPhoto = useLightbox();
  const photo = usePhotoUpload(c);
  const sets = useMemo(() => knownSets(cards), [cards]);
  const [panel, setPanel] = useState<Panel>(null);
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));
  const got = isGot(c);
  const src = cardImageSrc(c);

  return (
    <>
      <SheetHead
        title={
          canWrite
            ? got
              ? "In your collection"
              : "On your want list"
            : got
              ? "In Ashton's collection"
              : "On Ashton's want list"
        }
      />
      {/* The actions come first, so they're in reach without scrolling past the big picture. */}
      {canWrite ? (
        <div className="detail-acts">
          <button
            className={"btn" + (got ? "" : " primary")}
            type="button"
            onClick={() =>
              void save(c, { status: got ? "want" : "got" }, got ? "Moved back to want" : "Marked as got")
            }
          >
            {got ? "Move back to want" : "Got it"}
          </button>
          <button
            className="btn"
            type="button"
            aria-pressed={c.priority}
            onClick={() => void save(c, { priority: !c.priority })}
          >
            <StarIcon filled={c.priority} style={{ width: 18, height: 18 }} />
            {c.priority ? "Priority" : "Mark priority"}
          </button>
          {got ? null : (
            <button
              className="btn wide"
              type="button"
              onClick={() =>
                void save(
                  c,
                  { checkRequested: !c.checkRequested },
                  c.checkRequested ? "Price check cancelled" : "Queued for a price check",
                )
              }
            >
              {c.checkRequested ? "Cancel price check" : "Check price"}
            </button>
          )}
        </div>
      ) : (
        <SignInHint line />
      )}
      <div className="detail-hero">
        {src ? (
          <button
            className="detail-img"
            type="button"
            aria-label={`Show ${c.name} full screen`}
            onClick={() => showPhoto(lightboxItem(c, src))}
          >
            <HeroImage key={src} src={src} name={c.name} />
          </button>
        ) : canWrite ? (
          <button className="detail-img empty can" type="button" onClick={photo.pick}>
            + Add photo
          </button>
        ) : (
          <div className="detail-img empty">No photo yet</div>
        )}
        <div className="detail-info">
          <div className="name">
            {c.name}
            {c.variant ? <span className="tag">{c.variant}</span> : null}
            {c.lang === "JP" ? <span className="tag">Japanese</span> : null}
          </div>
          <div className="meta">
            <span>{c.set || "Set unknown"}</span>
            {c.number ? <span className="num">#{c.number}</span> : <span>number not shown</span>}
          </div>
          <div className="meta">
            <span>Added {formatDate(c.addedAt)}</span>
          </div>
          {(c.checkRequested && !got) || c.priority || c.collections.length ? (
            <div className="flags">
              {c.checkRequested && !got ? <span className="flag">Price check queued</span> : null}
              {c.priority ? <span className="flag">★ Priority</span> : null}
              {c.collections.map((n) => (
                <button
                  key={n}
                  className="collchip"
                  type="button"
                  title={`Show ${n}`}
                  onClick={() => {
                    showCollection(n);
                    onClose();
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          ) : null}
          {got ? null : <PriceBlock card={c} />}
        </div>
      </div>
      {c.note ? (
        <div className="detail-note" style={{ marginTop: 14 }}>
          {c.note}
        </div>
      ) : null}

      {got ? <OwnedSection card={c} canWrite={canWrite} /> : null}

      <div className="sec">
        <h4 className="sec-title">Shop</h4>
        <div className="shop">
          {c.deal?.url ? (
            <a className="deal" href={c.deal.url} target="_blank" rel="noopener">
              Buy the deal<small>{formatMoney(c.deal.total)} shipped</small>
            </a>
          ) : null}
          {c.listing?.url ? (
            <a className="mine" href={c.listing.url} target="_blank" rel="noopener">
              Your {c.listing.site || "listing"} link
            </a>
          ) : null}
          {marketLinks(c).map((l) => (
            <a key={l.label} href={l.href} target="_blank" rel="noopener" title={l.title}>
              {l.label}
              {l.title ? (
                <small>{l.title.replace(/^Open this /, "").replace(/ on DoubleHolo$/, "")}</small>
              ) : null}
            </a>
          ))}
        </div>
      </div>

      {canWrite ? (
        <div className="sec">
          <h4 className="sec-title">Manage</h4>
          <div className="menu">
            <button type="button" aria-expanded={panel === "tags"} onClick={() => toggle("tags")}>
              Collections
            </button>
            {panel === "tags" ? (
              <div className="sub">
                <TagPicker card={c} cards={cards} />
              </div>
            ) : null}
            <button type="button" aria-expanded={panel === "edit"} onClick={() => toggle("edit")}>
              Edit details
            </button>
            {panel === "edit" ? (
              <div className="sub">
                <EditForm card={c} knownSets={sets} onPhoto={photo.pick} onSaved={() => setPanel(null)} />
              </div>
            ) : null}
            <button type="button" onClick={photo.pick}>
              {c.img && /^https?:/.test(c.img) ? "Replace photo" : "Add your own photo"}
            </button>
            {panel === "remove" ? (
              <div className="sub" style={{ paddingTop: 14 }}>
                <p className="hint" style={{ marginBottom: 10 }}>
                  Remove {c.name} from the list?
                </p>
                <div className="row-btns">
                  <button className="btn" type="button" onClick={() => setPanel(null)}>
                    Keep
                  </button>
                  <button className="btn danger" type="button" onClick={() => void remove(c)}>
                    Yes, remove
                  </button>
                </div>
              </div>
            ) : (
              <button className="danger" type="button" onClick={() => setPanel("remove")}>
                Remove from list
              </button>
            )}
          </div>
        </div>
      ) : null}
      {photo.fileInput}
    </>
  );
}

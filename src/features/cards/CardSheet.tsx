import { ChevronRightIcon } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  accordionRowClass,
} from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import { useAuth } from "~/features/auth/AuthProvider";
import { SignInHint } from "~/features/auth/SignInHint";
import { showCollection } from "~/features/list/state";
import { formatDate, formatMoney } from "~/lib/format";
import { cn } from "~/lib/utils";
import { HeroImage } from "~/ui/CardImage";
import { StarIcon } from "~/ui/icons";
import { useCloseWhen } from "~/ui/useCloseWhen";
import { useToast } from "~/ui/Toast";
import { useLightbox } from "~/ui/Lightbox";
import { Sheet, SheetHead } from "~/ui/Sheet";
import { useCardWrites, useCards } from "./api";
import { CollChip } from "./CollChip";
import { knownSets } from "./collections";
import { EditForm } from "./EditForm";
import { cardImageSrc } from "./image";
import { lightboxItem } from "./lightboxItem";
import { OwnedSection } from "./OwnedSection";
import { marketLinks } from "./links";
import { PriceBlock } from "./PriceBlock";
import { PriceTrend } from "./PriceTrend";
import { keepsAsk, usePriceCheck } from "./priceCheck";
import { isGot, isManual } from "./pricing";
import { TagPicker } from "./TagPicker";
import type { Card } from "./types";
import { usePhotoUpload } from "./usePhotoUpload";

type Panel = "tags" | "edit" | "remove" | null;

/** A Manage row that acts straight away instead of opening: drawn like the accordion's rows, divider included. */
const actionRow = "rounded-none border-t-[0.5px] border-input hover:bg-transparent active:scale-100";

/** A card on the list: photo, price, quick actions, shops and edits. */
export function CardSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { cards, loaded } = useCards();
  const card = cards.find((c) => c.id === id);
  // Removed, here or on another device, or opened from a link to a card that's gone.
  useCloseWhen(loaded && !card, onClose);
  if (!card) return null;
  return (
    <Sheet label="Card details" onClose={onClose} contentKey={id} dock>
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
  const got = isGot(c);
  const src = cardImageSrc(c);
  const checkPrice = usePriceCheck();
  const { toast } = useToast();
  const [checking, setChecking] = useState(false);
  const runCheck = async () => {
    setChecking(true);
    const check = await checkPrice(c)
      .catch(() => null)
      .finally(() => setChecking(false));
    if (!check || check.saved === "failed") {
      toast(`Couldn't ${check ? "save" : "check"} the price. Try again.`);
      return;
    }
    // A refused save was already reported; an unchanged card was edited or removed meanwhile.
    const { result: r, saved } = check;
    if (!r.found && r.transient) toast(r.reason);
    else if (saved !== "saved") return;
    else if (!r.found) toast(`No price found. ${r.reason}`);
    else if (r.ask.amount != null)
      toast(
        keepsAsk(c.ask)
          ? `Kept ${isManual(c.ask) ? "your price" : "the seller's ask"}. ${r.ask.source} is ${formatMoney(r.ask.amount)}`
          : `${formatMoney(r.ask.amount)} · ${r.ask.source}`,
      );
  };

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
          <Button
            variant={got ? "secondary" : "default"}

            onClick={() =>
              void save(c, { status: got ? "want" : "got" }, got ? "Moved back to want" : "Marked as got")
            }
          >
            {got ? "Move back to want" : "Got it"}
          </Button>
          <Button aria-pressed={c.priority} onClick={() => void save(c, { priority: !c.priority })}>
            <StarIcon filled={c.priority} />
            {c.priority ? "Priority" : "Mark priority"}
          </Button>
          {got ? null : (
            <Button className="col-span-full" disabled={checking} onClick={() => void runCheck()}>
              {checking ? "Checking price…" : "Check price"}
            </Button>
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
          {c.priority || c.collections.length ? (
            <div className="flags">
              {c.priority ? <span className="flag">★ Priority</span> : null}
              {c.collections.map((n) => (
                <CollChip
                  key={n}
                  name={n}
                  onClick={() => {
                    showCollection(n);
                    onClose();
                  }}
                />
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
      <PriceTrend card={c} />

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
          <Accordion
            type="single"
            collapsible
            value={panel === "tags" || panel === "edit" ? panel : ""}
            onValueChange={(v) => setPanel(v === "tags" || v === "edit" ? v : null)}
          >
            <AccordionItem value="tags">
              <AccordionTrigger>Collections</AccordionTrigger>
              <AccordionContent>
                <TagPicker card={c} cards={cards} />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="edit">
              <AccordionTrigger>Edit details</AccordionTrigger>
              <AccordionContent>
                <EditForm card={c} knownSets={sets} onPhoto={photo.pick} onSaved={() => setPanel(null)} />
              </AccordionContent>
            </AccordionItem>
            <Button variant="ghost" className={cn(accordionRowClass, actionRow)} onClick={photo.pick}>
              {c.img && /^https?:/.test(c.img) ? "Replace photo" : "Add your own photo"}
              <ChevronRightIcon aria-hidden="true" className="size-5 text-faint" />
            </Button>
            {panel === "remove" ? (
              <div className="border-t-[0.5px] border-input px-3.5 py-3.5">
                <p className="hint mb-2.5">Remove {c.name} from the list?</p>
                <div className="row-btns">
                  <Button onClick={() => setPanel(null)}>Keep</Button>
                  <Button variant="destructive" onClick={() => void remove(c)}>
                    Yes, remove
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                className={cn(accordionRowClass, actionRow, "text-destructive")}
                onClick={() => setPanel("remove")}
              >
                Remove from list
              </Button>
            )}
          </Accordion>
        </div>
      ) : null}
      {photo.fileInput}
    </>
  );
}

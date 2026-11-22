import { useMemo, useRef, useState, type SubmitEvent } from "react";
import { cardDocId, useCardWrites, useCards } from "~/features/cards/api";
import { collectionCards, knownSets } from "~/features/cards/collections";
import { newCard } from "~/features/cards/create";
import { parseLink, parseQuick, type ParsedCard, type ParsedLink } from "~/features/cards/quickAdd";
import type { Lang } from "~/features/cards/types";
import { cleanName, today } from "~/lib/format";
import { Sheet, SheetHead } from "~/ui/Sheet";
import { useToast } from "~/ui/Toast";
import { COLL_LIST, SET_LIST } from "./Datalists";
import { useActiveCollection } from "./useActiveCollection";

interface Draft {
  name: string;
  number: string;
  variant: string;
  set: string;
  lang: Lang;
  status: "want" | "got";
  coll: string;
  note: string;
  link: string;
  /** The line above the form saying where the details came from. */
  note0: string;
}

const isUrl = (s: string) => /^https?:\/\//i.test(s);

function draftFrom(p: ParsedCard | ParsedLink, coll: string, note0: string): Draft {
  const link = "listing" in p ? (p.listing?.url ?? p.dhUrl ?? "") : "";
  return {
    name: p.name,
    number: p.number,
    variant: p.variant,
    set: p.set,
    lang: p.lang,
    status: "want",
    coll,
    note: "",
    link,
    note0,
  };
}

/** Add a card by typing it or pasting a listing link, then check the details before it saves. */
export function AddSheet({ onClose }: { onClose: () => void }) {
  const { cards } = useCards();
  const { create } = useCardWrites();
  const { toast } = useToast();
  const coll = useActiveCollection();
  const sets = useMemo(() => knownSets(cards), [cards]);
  const [quick, setQuick] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const quickForm = useRef<HTMLFormElement>(null);

  const next = (e?: SubmitEvent) => {
    e?.preventDefault();
    const text = quick.trim();
    if (!text) return;
    if (!isUrl(text)) {
      setDraft(draftFrom(parseQuick(text, sets), coll ?? "", ""));
      return;
    }
    const p = parseLink(text, sets);
    if (!p) {
      toast("That link doesn't look right. Check it and paste again.");
      return;
    }
    const note0 = p.found
      ? `Filled in from your ${p.site} link. Check the details.`
      : `${p.site} links don't include the card name, so type it in. The link is saved with the card.`;
    setDraft(draftFrom(p, coll ?? "", note0));
  };

  const save = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!draft || saving) return;
    const name = draft.name.trim();
    if (!name) return;
    const link = draft.link.trim();
    const pl = link ? parseLink(link, sets) : null;
    const c = cleanName(draft.coll);
    const got = draft.status === "got";
    const data = newCard({
      name,
      number: draft.number.trim().replace(/^#/, ""),
      variant: draft.variant.trim(),
      set: draft.set.trim(),
      lang: draft.lang,
      note: draft.note.trim(),
      listing: pl?.listing ?? (link && !pl?.dhUrl ? { url: link, site: "", addedAt: today() } : null),
      dhUrl: pl?.dhUrl ?? null,
      status: got ? "got" : "want",
      checkRequested: !got,
      ...(c ? { collections: [c], slots: { [c]: collectionCards(cards, c).length } } : {}),
    });
    let id = cardDocId([data.name, data.set, data.number, data.variant].join(" "));
    if (cards.some((x) => x.id === id)) id += "-" + Date.now().toString(36);
    setSaving(true);
    const ok = await create(id, data);
    setSaving(false);
    if (!ok) {
      toast("Couldn't add it. Try again.");
      return;
    }
    onClose();
    toast(`Added ${data.name}${c ? ` to ${c}` : ""}${got ? "" : " · queued for a price check"}`);
  };

  const field = <K extends keyof Draft>(key: K) => ({
    value: draft?.[key] ?? "",
    onChange: (e: { target: { value: string } }) =>
      setDraft((d) => (d ? { ...d, [key]: e.target.value as Draft[K] } : d)),
  });

  return (
    <Sheet label="Add a card" onClose={onClose}>
      <SheetHead title="Add a card" />
      <section>
        <form ref={quickForm} className="add-row" autoComplete="off" onSubmit={next}>
          <input
            type="text"
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            onPaste={() =>
              setTimeout(() => {
                const v = quickForm.current?.querySelector("input")?.value.trim() ?? "";
                if (/^https?:\/\/\S+$/i.test(v)) quickForm.current?.requestSubmit();
              }, 0)
            }
            aria-label="Add a card or paste a listing link"
            placeholder="Card name, or paste a link"
            enterKeyHint="go"
            autoFocus
          />
          <button className="btn primary" type="submit">
            Next
          </button>
        </form>
        <p className="hint">
          Type it like &quot;Umbreon ex Prismatic Evolutions 161&quot;, or paste a link from DoubleHolo,
          TCGplayer, eBay, Cardmarket, PriceCharting, Mercari or anywhere else. You&apos;ll check the details
          before it saves.
        </p>
        {draft ? (
          <form className="confirm" onSubmit={(e) => void save(e)}>
            {draft.note0 ? <p className="parsed-note">{draft.note0}</p> : null}
            <label className="wide">
              Card name
              <input type="text" required autoFocus={!draft.name} {...field("name")} />
            </label>
            <label>
              Number
              <input
                type="text"
                placeholder="161"
                autoFocus={!!draft.name && !!draft.set}
                {...field("number")}
              />
            </label>
            <label>
              Variant
              <input type="text" placeholder="Reverse Holo" {...field("variant")} />
            </label>
            <label className="wide">
              Set
              <input type="text" list={SET_LIST} autoFocus={!!draft.name && !draft.set} {...field("set")} />
            </label>
            <label>
              Language
              <select {...field("lang")}>
                <option value="EN">English</option>
                <option value="JP">Japanese</option>
              </select>
            </label>
            <label>
              Status
              <select {...field("status")}>
                <option value="want">I want it</option>
                <option value="got">I already have it</option>
              </select>
            </label>
            <label className="wide">
              Collection
              <input
                type="text"
                list={COLL_LIST}
                placeholder="Optional, e.g. Gengar binder"
                {...field("coll")}
              />
            </label>
            <label className="wide">
              Note
              <input type="text" placeholder="Optional" {...field("note")} />
            </label>
            <label className="full">
              Listing link
              <input
                type="url"
                placeholder="Optional: a listing you're eyeing, or the card's DoubleHolo page"
                {...field("link")}
              />
            </label>
            <div className="actions">
              <button className="btn" type="button" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button className="btn primary" type="submit" disabled={saving}>
                Save to list
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </Sheet>
  );
}

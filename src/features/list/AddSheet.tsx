import { useDeferredValue, useEffect, useMemo, useRef, useState, type SubmitEvent } from "react";
import { cardDocId, useCardWrites, useCards } from "~/features/cards/api";
import { collectionCards, knownSets } from "~/features/cards/collections";
import { newCard, useAddCards, type WantOrGot } from "~/features/cards/create";
import { isGot } from "~/features/cards/pricing";
import { realPrice, setOf, useCatalog, type Catalog, type CatalogCard } from "~/features/catalog/catalog";
import { addSearch } from "~/features/catalog/search";
import { catalogLiveCard } from "~/features/explore/live";
import { listLookup } from "~/features/explore/onList";
import { parseLink, parseQuick, type ParsedCard, type ParsedLink } from "~/features/cards/quickAdd";
import type { Lang } from "~/features/cards/types";
import { cleanName, formatMoney, today } from "~/lib/format";
import { tcgImage } from "~/lib/images";
import { PickTile } from "~/ui/PickTile";
import { Seg } from "~/ui/Seg";
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

const RESULTS = 30;
const ADD_AS: readonly { value: WantOrGot; label: string }[] = [
  { value: "want", label: "I want it" },
  { value: "got", label: "Got it" },
];

interface MatchesProps {
  cat: Catalog;
  query: string;
  coll: string;
  addAs: WantOrGot;
}

/** Catalog printings matching the search, with pictures. A tap adds one straight to the list. */
function CatalogMatches({ cat, query, coll, addAs }: MatchesProps) {
  const { cards } = useCards();
  const { fromLive } = useAddCards();
  const { toast } = useToast();
  const onList = useMemo(() => listLookup(cards), [cards]);
  const [adding, setAdding] = useState<ReadonlySet<number>>(new Set());
  const { rows, total } = useMemo(() => addSearch(cat, query, RESULTS), [cat, query]);

  if (!rows.length)
    return <p className="hint">No card by that name. Check the spelling, or type it in below.</p>;

  const add = async (c: CatalogCard) => {
    if (adding.has(c.pid)) return;
    const d = catalogLiveCard(cat, c);
    const have = onList(d);
    // Already there with nothing to change: say so rather than claim it was added.
    if (have && (!coll || have.collections.includes(coll)) && (addAs === "want" || isGot(have))) {
      toast(coll ? `${c.name} is already in ${coll}` : `${c.name} is already on your list`);
      return;
    }
    setAdding((s) => new Set(s).add(c.pid));
    try {
      await fromLive(d, addAs, coll);
    } finally {
      setAdding((s) => {
        const next = new Set(s);
        next.delete(c.pid);
        return next;
      });
    }
  };

  return (
    <div className="pick-grid add-results">
      {rows.map((c) => {
        const set = setOf(cat, c);
        const market = realPrice(c.market);
        const d = catalogLiveCard(cat, c);
        const have = onList(d);
        const tag = adding.has(c.pid)
          ? "Adding…"
          : have
            ? isGot(have)
              ? "✓ Got it"
              : "✓ On list"
            : market
              ? "~" + formatMoney(market)
              : "+ Add";
        return (
          <PickTile
            key={c.pid}
            src={tcgImage(c.pid)}
            name={c.name}
            sub={`${set.jp ? "JP · " : ""}${set.name} · #${c.number}`}
            tag={tag}
            onPick={() => void add(c)}
          />
        );
      })}
      {total > rows.length ? (
        <p className="hint">
          Showing {rows.length} of {total.toLocaleString()}. Add a set name or number to narrow it.
        </p>
      ) : null}
    </div>
  );
}

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
  const [addAs, setAddAs] = useState<WantOrGot>("want");
  const quickForm = useRef<HTMLFormElement>(null);
  const query = useDeferredValue(quick);
  const catalog = useCatalog();
  const searching = !draft && !isUrl(query.trim()) && query.trim().length >= 2;
  useEffect(() => {
    if (catalog.isError) toast("Couldn't load the card catalog. Type the card in instead.");
  }, [catalog.isError, toast]);

  /** Enter: a pasted link fills the form; a search just puts the keyboard away to show the results. */
  const submitQuick = (e: SubmitEvent) => {
    e.preventDefault();
    if (isUrl(quick.trim())) next();
    else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };

  const next = () => {
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
        <form ref={quickForm} className="add-row" autoComplete="off" onSubmit={submitQuick}>
          <input
            type="search"
            value={quick}
            onChange={(e) => {
              setQuick(e.target.value);
              if (draft) setDraft(null);
            }}
            onPaste={() =>
              setTimeout(() => {
                const v = quickForm.current?.querySelector("input")?.value.trim() ?? "";
                if (/^https?:\/\/\S+$/i.test(v)) quickForm.current?.requestSubmit();
              }, 0)
            }
            aria-label="Search for a card, or paste a listing link"
            placeholder="Search cards, or paste a link"
            enterKeyHint="search"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            autoFocus
          />
        </form>
        {searching ? (
          <>
            <div className="add-bar">
              <Seg label="Add as" value={addAs} options={ADD_AS} onChange={setAddAs} />
              {coll ? <span className="hint">Goes to {coll}</span> : null}
            </div>
            {catalog.data ? (
              <CatalogMatches cat={catalog.data} query={query} coll={coll ?? ""} addAs={addAs} />
            ) : catalog.isError ? null : (
              <p className="hint">Loading every Pokémon card…</p>
            )}
            <button className="linkbtn add-manual" type="button" onClick={next}>
              Not here? Type in the details
            </button>
          </>
        ) : draft ? null : (
          <p className="hint">
            Search by name, set or number, like &quot;umbreon prismatic 161&quot;, then tap a card to add it.
            Add &quot;jp&quot; for Japanese cards. Or paste a link from DoubleHolo, TCGplayer, eBay or
            anywhere else.
          </p>
        )}
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

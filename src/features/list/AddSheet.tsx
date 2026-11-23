import {
  lazy,
  Suspense,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SubmitEvent,
} from "react";
import { cardDocId, useCardWrites, useCards } from "~/features/cards/api";
import { collectionCards, knownSets } from "~/features/cards/collections";
import { newCard, type WantOrGot } from "~/features/cards/create";
import { parseCard } from "~/features/cards/parse";
import { usePriceCheck } from "~/features/cards/priceCheck";
import { useCatalog, type Catalog } from "~/features/catalog/catalog";
import { addSearch } from "~/features/catalog/search";
import { parseLink, parseQuick, type ParsedCard, type ParsedLink } from "~/features/cards/quickAdd";
import type { Lang } from "~/features/cards/types";
import { cleanName, today } from "~/lib/format";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Seg } from "~/ui/Seg";
import { Sheet, SheetHead } from "~/ui/Sheet";
import { CameraIcon } from "~/ui/icons";
import { useToast } from "~/ui/Toast";
import { CatalogTiles } from "./CatalogTiles";
import { COLL_LIST, SET_LIST } from "./Datalists";
import { SearchInput } from "~/ui/SearchInput";
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

/* The scanner pulls in the card-matching code, so it loads only when the camera is tapped. */
const CardScanner = lazy(() =>
  import("~/features/scan/CardScanner").then((m) => ({ default: m.CardScanner })),
);

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
  const { rows, total } = useMemo(() => addSearch(cat, query, RESULTS), [cat, query]);
  if (!rows.length)
    return <p className="hint">No card by that name. Check the spelling, or type it in below.</p>;
  return (
    <CatalogTiles cat={cat} rows={rows} coll={coll} addAs={addAs}>
      {total > rows.length ? (
        <p className="hint">
          Showing {rows.length} of {total.toLocaleString()}. Add a set name or number to narrow it.
        </p>
      ) : null}
    </CatalogTiles>
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
  const checkPrice = usePriceCheck();
  const { toast } = useToast();
  const coll = useActiveCollection();
  const sets = useMemo(() => knownSets(cards), [cards]);
  const [quick, setQuick] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [addAs, setAddAs] = useState<WantOrGot>("want");
  const [scanning, setScanning] = useState(false);
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
    toast(`Added ${data.name}${c ? ` to ${c}` : ""}`);
    // The price follows on its own; the card shows it, or why there isn't one, when the check is done.
    void checkPrice(parseCard(id, data)).catch(() => undefined);
  };

  const field = <K extends keyof Draft>(key: K) => ({
    value: draft?.[key] ?? "",
    onChange: (e: { target: { value: string } }) =>
      setDraft((d) => (d ? { ...d, [key]: e.target.value as Draft[K] } : d)),
  });

  return (
    <Sheet label="Add a card" onClose={onClose}>
      <SheetHead title="Add a card" />
      {scanning ? (
        <section>
          <div className="add-bar">
            <Seg label="Add as" value={addAs} options={ADD_AS} onChange={setAddAs} />
            {coll ? <span className="hint">Goes to {coll}</span> : null}
          </div>
          <Suspense fallback={<p className="hint">Starting the camera…</p>}>
            <CardScanner
              cat={catalog.data}
              failed={catalog.isError}
              coll={coll ?? ""}
              addAs={addAs}
              onSearch={(text) => {
                // A name read off the card starts the search; otherwise whatever was typed is kept.
                if (text) {
                  setQuick(text);
                  setDraft(null);
                }
                setScanning(false);
              }}
            />
          </Suspense>
        </section>
      ) : (
        <section>
          <form ref={quickForm} className="add-row" autoComplete="off" onSubmit={submitQuick}>
            <SearchInput
              wrapClassName="flex-1"
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
            <Button
              size="icon-lg"
              className="rounded-md"
              aria-label="Scan a card with the camera"
              title="Scan a card"
              onClick={() => setScanning(true)}
            >
              <CameraIcon />
            </Button>
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
              <Button variant="link" className="add-manual" onClick={next}>
                Not here? Type in the details
              </Button>
            </>
          ) : draft ? null : (
            <p className="hint">
              Search by name, set or number, like &quot;umbreon prismatic 161&quot;, then tap a card to add
              it. Add &quot;jp&quot; for Japanese cards. Or paste a link from DoubleHolo, TCGplayer, eBay or
              anywhere else. Have the card in hand? Tap the camera to scan it.
            </p>
          )}
          {draft ? (
            <form className="confirm" onSubmit={(e) => void save(e)}>
              {draft.note0 ? <p className="parsed-note">{draft.note0}</p> : null}
              <Label className="wide">
                Card name
                <Input required autoFocus={!draft.name} {...field("name")} />
              </Label>
              <Label>
                Number
                <Input placeholder="161" autoFocus={!!draft.name && !!draft.set} {...field("number")} />
              </Label>
              <Label>
                Variant
                <Input placeholder="Reverse Holo" {...field("variant")} />
              </Label>
              <Label className="wide">
                Set
                <Input list={SET_LIST} autoFocus={!!draft.name && !draft.set} {...field("set")} />
              </Label>
              <Label>
                Language
                <NativeSelect {...field("lang")}>
                  <NativeSelectOption value="EN">English</NativeSelectOption>
                  <NativeSelectOption value="JP">Japanese</NativeSelectOption>
                </NativeSelect>
              </Label>
              <Label>
                Status
                <NativeSelect {...field("status")}>
                  <NativeSelectOption value="want">I want it</NativeSelectOption>
                  <NativeSelectOption value="got">I already have it</NativeSelectOption>
                </NativeSelect>
              </Label>
              <Label className="wide">
                Collection
                <Input list={COLL_LIST} placeholder="Optional, e.g. Gengar binder" {...field("coll")} />
              </Label>
              <Label className="wide">
                Note
                <Input placeholder="Optional" {...field("note")} />
              </Label>
              <Label className="full">
                Listing link
                <Input
                  type="url"
                  placeholder="Optional: a listing you're eyeing, or the card's DoubleHolo page"
                  {...field("link")}
                />
              </Label>
              <div className="actions">
                <Button className="flex-1" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button variant="default" className="flex-1" type="submit" disabled={saving}>
                  Save to list
                </Button>
              </div>
            </form>
          ) : null}
        </section>
      )}
    </Sheet>
  );
}

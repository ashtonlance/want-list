import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  realPrice,
  setOf,
  rarityOf,
  useCatalog,
  type Catalog,
  type CatalogCard,
} from "~/features/catalog/catalog";
import { searchCatalog } from "~/features/catalog/search";
import { cardImageSrc } from "~/features/cards/image";
import { isGot, priceOf } from "~/features/cards/pricing";
import type { Card } from "~/features/cards/types";
import { formatMoney } from "~/lib/format";
import { tcgImage } from "~/lib/images";
import { PickTile } from "~/ui/PickTile";
import { Seg } from "~/ui/Seg";
import { Select } from "~/ui/Select";
import { useToast } from "~/ui/Toast";
import type { Slot } from "./types";
import { useMediaQuery } from "./useMediaQuery";
import { useCollections } from "~/features/cards/useCollections";

type Source = "ours" | "web";
type Show = "all" | "got" | "want";

interface PickCardSheetProps {
  cards: readonly Card[];
  /** Ids of list cards already in this binder, shown last and dimmed. */
  inBinder: ReadonlySet<string>;
  onPlace: (slot: Slot, name: string) => void;
}

const SOURCES: readonly { value: Source; label: string }[] = [
  { value: "ours", label: "Our cards" },
  { value: "web", label: "Any card" },
];
const SHOWS: readonly { value: Show; label: string }[] = [
  { value: "all", label: "All" },
  { value: "got", label: "Have" },
  { value: "want", label: "Want" },
];
const OURS_LIMIT = 120;
const WEB_LIMIT = 90;

/** Picks a card for a pocket: one from the list, or any printing in the catalog. */
export function PickCardSheet({ cards, inBinder, onPlace }: PickCardSheetProps) {
  const [source, setSource] = useState<Source>("ours");
  const [q, setQ] = useState("");
  const [show, setShow] = useState<Show>("all");
  const [coll, setColl] = useState("");
  const [withJapanese, setWithJapanese] = useState(false);
  const query = useDeferredValue(q);
  const coarse = useMediaQuery("(pointer:coarse)");

  const { collections } = useCollections();
  const collOptions = useMemo(
    () => [
      { value: "", label: "All collections" },
      ...collections.map((c) => ({ value: c.name, label: c.name })),
    ],
    [collections],
  );

  return (
    <>
      <div className="seg sheet-tabs" role="tablist">
        {SOURCES.map((s) => (
          <button
            key={s.value}
            type="button"
            role="tab"
            aria-pressed={source === s.value}
            onClick={() => {
              setSource(s.value);
              setQ("");
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
      <input
        type="search"
        value={q}
        placeholder={source === "ours" ? "Search your list" : "Search any card: name, set or number"}
        aria-label="Search cards"
        enterKeyHint="search"
        autoFocus={!coarse}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="pick-ctrls">
        {source === "ours" ? (
          <>
            <Seg label="Show" value={show} options={SHOWS} onChange={setShow} />
            <Select aria-label="Collection" value={coll} options={collOptions} onChange={setColl} />
          </>
        ) : (
          <label className="chk">
            <input
              type="checkbox"
              checked={withJapanese}
              onChange={(e) => setWithJapanese(e.target.checked)}
            />{" "}
            Include Japanese
          </label>
        )}
      </div>
      <div className="pick-grid">
        {source === "ours" ? (
          <OurResults
            cards={cards}
            inBinder={inBinder}
            query={query}
            show={show}
            coll={coll}
            onPlace={onPlace}
          />
        ) : (
          <WebResults query={query} withJapanese={withJapanese} onPlace={onPlace} />
        )}
      </div>
    </>
  );
}

interface OurResultsProps {
  cards: readonly Card[];
  inBinder: ReadonlySet<string>;
  query: string;
  show: Show;
  coll: string;
  onPlace: PickCardSheetProps["onPlace"];
}

function OurResults({ cards, inBinder, query, show, coll, onPlace }: OurResultsProps) {
  const rows = useMemo(() => {
    const qq = query.trim().toLowerCase();
    const placed = (c: Card) => (inBinder.has(c.id) ? 1 : 0);
    return cards
      .filter(
        (c) =>
          (show === "all" || (show === "got") === isGot(c)) &&
          (!coll || c.collections.includes(coll)) &&
          (!qq || [c.name, c.set, c.number, ...c.collections].join(" ").toLowerCase().includes(qq)),
      )
      .sort((a, b) => placed(a) - placed(b) || a.name.localeCompare(b.name));
  }, [cards, inBinder, query, show, coll]);

  if (!rows.length) return <p className="hint">No cards match. Try Any card to search everything.</p>;
  return rows.slice(0, OURS_LIMIT).map((c) => {
    const price = priceOf(c);
    return (
      <PickTile
        key={c.id}
        src={cardImageSrc(c)}
        name={c.name}
        sub={[c.set, c.number ? "#" + c.number : ""].filter(Boolean).join(" · ")}
        tag={isGot(c) ? "Have it" : price != null ? formatMoney(price) : "Want"}
        already={inBinder.has(c.id)}
        onPick={() => onPlace({ k: "c", id: c.id }, c.name)}
      />
    );
  });
}

interface WebResultsProps {
  query: string;
  withJapanese: boolean;
  onPlace: PickCardSheetProps["onPlace"];
}

function WebResults({ query, withJapanese, onPlace }: WebResultsProps) {
  const catalog = useCatalog();
  const { toast } = useToast();
  useEffect(() => {
    if (catalog.isError) toast("Couldn't load the card catalog. Try again.");
  }, [catalog.isError, toast]);

  if (!catalog.data) return <p className="hint">Loading every Pokémon card…</p>;
  return <WebMatches cat={catalog.data} query={query} withJapanese={withJapanese} onPlace={onPlace} />;
}

function WebMatches({ cat, query, withJapanese, onPlace }: WebResultsProps & { cat: Catalog }) {
  const tooShort = query.trim().length < 2;
  const found = useMemo(
    () => (tooShort ? [] : searchCatalog(cat, query, withJapanese)),
    [cat, query, withJapanese, tooShort],
  );

  if (tooShort)
    return (
      <p className="hint">
        Type a Pokémon or card name. Add a set name or number to narrow it, like "gengar fossil" or "pikachu
        160".
      </p>
    );
  if (!found.length) return <p className="hint">Nothing found. Check the spelling, or try fewer words.</p>;

  const place = (c: CatalogCard) => {
    const set = setOf(cat, c);
    onPlace(
      {
        k: "w",
        pid: c.pid,
        n: c.name,
        s: set.name,
        no: c.number,
        r: rarityOf(cat, c),
        m: realPrice(c.market) || null,
        jp: set.jp,
      },
      c.name,
    );
  };

  return (
    <>
      {found.slice(0, WEB_LIMIT).map((c) => {
        const set = setOf(cat, c);
        const market = realPrice(c.market);
        return (
          <PickTile
            key={c.pid}
            src={tcgImage(c.pid)}
            name={c.name}
            sub={`${set.jp ? "Japanese · " : ""}${set.name} · #${c.number}`}
            tag={market ? "~" + formatMoney(market) : ""}
            onPick={() => place(c)}
          />
        );
      })}
      {found.length > WEB_LIMIT ? (
        <p className="hint" style={{ gridColumn: "1/-1" }}>
          Showing {WEB_LIMIT} of {found.length}. Add a set name or number to narrow it.
        </p>
      ) : null}
    </>
  );
}

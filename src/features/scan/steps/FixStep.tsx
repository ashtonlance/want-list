import { useEffect, useMemo, useState } from "react";
import { useCatalog } from "~/features/catalog/catalog";
import { searchCatalog } from "~/features/catalog/search";
import { formatMoney } from "~/lib/format";
import { tcgImage } from "~/lib/images";
import { CardImage } from "~/ui/CardImage";
import { PickTile } from "~/ui/PickTile";
import type { Entry, ScanIndex } from "../engine/match";
import type { ScanCell } from "../session";

interface FixStepProps {
  cell: ScanCell;
  /** Page and pocket, from 1. */
  page: number;
  pocket: number;
  index: ScanIndex;
  /** A card for this pocket, or null for an empty pocket. */
  onChoose: (pick: Entry | null) => void;
}

const RESULTS = 60;

const tagOf = (e: Entry): string => (e.mine ? "On your list" : e.market ? `~${formatMoney(e.market)}` : "");
const subOf = (e: Entry): string => `${e.jp ? "Japanese · " : ""}${e.set} · #${e.no}`;

/** OCR noise rarely looks like a word, so only a plausible name is put in the search box. */
const plausibleName = (hint: string): string => (/^[a-z][a-z' .-]{3,}$/i.test(hint) ? hint : "");

export function FixStep({ cell, page, pocket, index, onChoose }: FixStepProps) {
  const cur = cell.state !== "none" && cell.state !== "empty" ? cell.pick : null;
  const alts = cell.m.conf === "none" ? [] : cell.m.alts.filter((e) => e.pid !== cur?.pid);

  return (
    <>
      <div className="scan-cmp">
        <figure>
          <img src={cell.photo} alt="Your photo of this pocket" />
          <figcaption>Your photo</figcaption>
        </figure>
        <figure>
          {cur ? (
            <span className="cmp-img">
              <CardImage key={cur.pid} src={tcgImage(cur.pid)} name={cur.name} alt={cur.name} />
            </span>
          ) : (
            <span className="scan-blank">{cell.state === "empty" ? "Empty" : "No match"}</span>
          )}
          <figcaption>
            {cur ? `${cur.name} · ${cur.set} #${cur.no}` : `Page ${page}, pocket ${pocket}`}
          </figcaption>
        </figure>
      </div>
      <div className="row-btns">
        {cur ? (
          <button className="btn primary" type="button" onClick={() => onChoose(cur)}>
            Looks right
          </button>
        ) : null}
        <button className="btn" type="button" onClick={() => onChoose(null)}>
          Empty pocket
        </button>
      </div>
      {alts.length ? (
        <>
          <h4 className="sec-title">{cur ? "Or one of these" : "Is it one of these?"}</h4>
          <div className="pick-grid">
            {alts.map((e) => (
              <PickTile
                key={e.pid}
                src={tcgImage(e.pid)}
                name={e.name}
                sub={subOf(e)}
                tag={tagOf(e)}
                onPick={() => onChoose(e)}
              />
            ))}
          </div>
        </>
      ) : null}
      <h4 className="sec-title">Search for it</h4>
      <CardSearch initial={cur ? cur.name : plausibleName(cell.m.hint)} index={index} onChoose={onChoose} />
    </>
  );
}

interface CardSearchProps {
  initial: string;
  index: ScanIndex;
  onChoose: (pick: Entry) => void;
}

function CardSearch({ initial, index, onChoose }: CardSearchProps) {
  const catalog = useCatalog().data;
  const [text, setText] = useState(initial);
  const [query, setQuery] = useState(initial);
  const [withJapanese, setWithJapanese] = useState(false);

  // Searching every printing on each keystroke is slow on a phone, so wait for a pause in typing.
  useEffect(() => {
    const t = setTimeout(() => setQuery(text), 150);
    return () => clearTimeout(t);
  }, [text]);

  const q = query.trim();
  const found = useMemo(
    () =>
      catalog && q.length >= 2
        ? searchCatalog(catalog, q, withJapanese)
            .slice(0, RESULTS)
            .flatMap((c) => index.byPid.get(c.pid) ?? [])
        : [],
    [catalog, q, withJapanese, index],
  );

  return (
    <>
      <input
        type="search"
        value={text}
        placeholder="Name, set or number"
        aria-label="Search cards"
        enterKeyHint="search"
        onChange={(e) => setText(e.target.value)}
      />
      <label className="chk">
        <input type="checkbox" checked={withJapanese} onChange={(e) => setWithJapanese(e.target.checked)} />{" "}
        Include Japanese
      </label>
      <div className="pick-grid">
        {q.length < 2 ? (
          <p className="hint">Type the card's name. Add the set or number to narrow it.</p>
        ) : !found.length ? (
          <p className="hint">Nothing found. Check the spelling, or try fewer words.</p>
        ) : (
          found.map((e) => (
            <PickTile
              key={e.pid}
              src={tcgImage(e.pid)}
              name={e.name}
              sub={subOf(e)}
              tag={tagOf(e)}
              onPick={() => onChoose(e)}
            />
          ))
        )}
      </div>
    </>
  );
}

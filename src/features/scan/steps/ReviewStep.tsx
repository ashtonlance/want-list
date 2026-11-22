import { useState, type CSSProperties } from "react";
import { cleanName, plural } from "~/lib/format";
import { tcgImage } from "~/lib/images";
import { DEFAULT_NAME, willSave, type ScanCell } from "../session";

interface ReviewStepProps {
  pages: ScanCell[][];
  cols: number;
  pockets: number;
  /** The binder the pages go into, or null for a new one called `name`. */
  destName: string | null;
  name: string;
  onFix: (i: number) => void;
  onSave: () => void;
  onStartOver: () => void;
}

export function ReviewStep({
  pages,
  cols,
  pockets,
  destName,
  name,
  onFix,
  onSave,
  onStartOver,
}: ReviewStepProps) {
  const all = pages.flat();
  const cards = all.filter(willSave).length;
  const check = all.filter((c) => c.state === "check").length;
  const none = all.filter((c) => c.state === "none").length;
  const issues = [check ? `${check} to check` : "", none ? `${none} I couldn't read` : ""].filter(Boolean);
  const gridStyle: CSSProperties & Record<"--cols", number> = { "--cols": cols };
  const where = destName
    ? `adds ${plural(pages.length, "page")} to ${destName}`
    : `makes a binder called ${cleanName(name) || DEFAULT_NAME}`;

  return (
    <>
      <p className="scan-sum">
        <b>{plural(cards, "card")} found</b>
        {issues.length ? `. ${issues.join(", ")}.` : ". Everything looks good."}
      </p>
      <p className="hint">
        Tap any pocket to fix it. Pockets marked Pick stay empty unless you choose a card.
      </p>
      {pages.map((pg, pi) => (
        <div className="page scan-page" key={pi}>
          <div className="page-label">Page {pi + 1}</div>
          <div className="pockets" style={gridStyle}>
            {pg.map((c, ci) => {
              const i = pi * pockets + ci;
              // Keyed by the pick too, so a fixed pocket forgets that the old picture failed to load.
              return (
                <ScanTile
                  key={`${ci}:${c.pick?.pid ?? ""}`}
                  cell={c}
                  pocket={ci + 1}
                  onClick={() => onFix(i)}
                />
              );
            })}
          </div>
        </div>
      ))}
      <div className="scan-foot">
        <p className="hint">
          Saving marks these cards as owned (adding any that aren't on your list) and {where}.
        </p>
        <button className="btn primary wide" type="button" disabled={!cards} onClick={onSave}>
          Save {plural(cards, "card")}
        </button>
        <button className="btn wide" type="button" onClick={onStartOver}>
          Start over
        </button>
      </div>
    </>
  );
}

interface ScanTileProps {
  cell: ScanCell;
  /** Position on its page, from 1. */
  pocket: number;
  onClick: () => void;
}

function ScanTile({ cell, pocket, onClick }: ScanTileProps) {
  const [failed, setFailed] = useState(false);
  const { state, pick, photo } = cell;
  const label =
    state === "empty"
      ? "Empty pocket"
      : pick
        ? `${pick.name}${state === "check" ? ", check this" : ""}`
        : "Couldn't read, pick a card";
  // The match's picture where there is one; the pocket's own photo otherwise, or if that picture won't load.
  const src = pick && state !== "none" && !failed ? tcgImage(pick.pid) : photo;
  return (
    <button
      className={"pocket bpocket scan-tile" + (state === "empty" ? " empty" : "")}
      type="button"
      aria-label={`Pocket ${pocket}: ${label}`}
      onClick={onClick}
    >
      {state === "empty" ? (
        <span className="plus">Empty</span>
      ) : (
        <>
          <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
          {state === "check" ? <span className="scan-flag">Check</span> : null}
          {state === "none" ? <span className="scan-flag">Pick</span> : null}
        </>
      )}
    </button>
  );
}

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useCards } from "~/features/cards/api";
import type { WantOrGot } from "~/features/cards/create";
import type { Catalog } from "~/features/catalog/catalog";
import { CatalogTiles } from "~/features/list/CatalogTiles";
import { useToast } from "~/ui/Toast";
import { fileToImage, release, turned } from "./engine/image";
import { getWorker } from "./engine/ocr";
import { indexFor, readPocket } from "./read";
import { cardFrom } from "./shot";
import { centreCard, coverCrop, scanPicks, type ScanPicks } from "./single";
import { useCamera } from "./useCamera";

interface CardScannerProps {
  cat: Catalog | undefined;
  /** The catalog couldn't be loaded, so nothing can be matched. */
  failed: boolean;
  coll: string;
  addAs: WantOrGot;
  /** Leaves the camera for the search, prefilled with whatever name was read. */
  onSearch: (text: string) => void;
}

/**
 * Point the camera at one card, tap the shutter, then tap the right printing to add it. Each shot is read
 * on the phone and thrown away; nothing is uploaded or kept.
 */
export function CardScanner({ cat, failed, coll, addAs, onSearch }: CardScannerProps) {
  const { cards } = useCards();
  const { toast } = useToast();
  const video = useRef<HTMLVideoElement>(null);
  const guide = useRef<HTMLDivElement>(null);
  const cam = useCamera(!failed);
  const stream = cam.kind === "on" ? cam.stream : null;
  const [busy, setBusy] = useState(false);
  const [picks, setPicks] = useState<ScanPicks | null>(null);
  const [hint, setHint] = useState("");
  const [shots, setShots] = useState(0);
  // The read in progress; leaving the scanner clears it so a late result is dropped.
  const run = useRef<symbol | null>(null);

  // Get the reader and the index ready while the person lines up the first card.
  useEffect(() => {
    void getWorker().catch(() => undefined);
    run.current = null;
    return () => {
      run.current = null;
    };
  }, []);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.srcObject = stream;
    // Autoplay can be refused until a tap; the picture still shows once it plays.
    if (stream) void v.play().catch(() => undefined);
  }, [stream]);
  // Once per visit; a shot after an add rebuilds it anyway, and rebuilding on every add would stutter.
  const warmed = useRef(false);
  useEffect(() => {
    if (!cat || warmed.current) return;
    const t = setTimeout(() => {
      warmed.current = true;
      indexFor(cat, cards);
    }, 400);
    return () => clearTimeout(t);
  }, [cat, cards]);

  async function identify(card: HTMLCanvasElement) {
    const token = Symbol("shot");
    run.current = token;
    try {
      if (!cat) return;
      const m = await readPocket(indexFor(cat, cards), card);
      if (run.current !== token) return;
      setPicks(scanPicks(m, cat.byPid));
      setHint(m.hint);
    } finally {
      release(card);
      if (run.current === token) setBusy(false);
    }
  }

  const shoot = () => {
    const v = video.current;
    const g = guide.current;
    if (busy || !cat || !v || !g) return;
    if (!v.videoWidth || v.paused) {
      // Autoplay was refused or no frame has come yet; this tap starts the picture, the next one reads.
      void v.play().catch(() => undefined);
      return;
    }
    const vr = v.getBoundingClientRect();
    const gr = g.getBoundingClientRect();
    const size = { w: v.videoWidth, h: v.videoHeight };
    const area = coverCrop(
      size,
      { w: vr.width, h: vr.height },
      { x: gr.left - vr.left, y: gr.top - vr.top, w: gr.width, h: gr.height },
    );
    if (area.w < 8 || area.h < 8) return;
    setBusy(true);
    setShots((n) => n + 1);
    void identify(cardFrom(v, size, area));
  };

  const fromPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || busy || !cat) return;
    setBusy(true);
    try {
      const src = turned(await fileToImage(file), 0, 2000);
      let card: HTMLCanvasElement;
      try {
        const size = { w: src.width, h: src.height };
        card = cardFrom(src, size, centreCard(size, 0.85));
      } finally {
        release(src);
      }
      await identify(card);
    } catch {
      setBusy(false);
      toast("Couldn't open that photo. Try another.");
    }
  };

  const status = !cat
    ? failed
      ? "Couldn't load the card catalog. Search by name instead."
      : "Loading every Pokémon card…"
    : busy
      ? "Reading the card…"
      : cam.kind === "starting"
        ? "Starting the camera…"
        : null;

  return (
    <div className="cardscan">
      {cam.kind === "off" ? (
        <div className="cam-off">
          <p>
            {cam.denied
              ? "Camera access is off for this site. Turn it on in Settings, or take a photo instead."
              : "The camera isn't available here. Take a photo of the card instead."}
          </p>
          <Button
            asChild
            variant="default"
            className={cn((busy || !cat) && "pointer-events-none opacity-50")}
          >
            <label>
              {busy ? "Reading…" : "Take a photo"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                disabled={busy || !cat}
                onChange={(e) => void fromPhoto(e)}
              />
            </label>
          </Button>
        </div>
      ) : (
        <>
          <div className="cam">
            <video ref={video} playsInline muted autoPlay aria-label="Camera" />
            <div ref={guide} className={"cam-guide" + (busy ? " busy" : "")} key={shots} />
            {status ? (
              <p className="cam-status" aria-live="polite">
                {status}
              </p>
            ) : (
              <p className="cam-tip">Fit the card inside the outline</p>
            )}
          </div>
          <div className="cam-actions">
            <button
              className="shutter"
              type="button"
              aria-label="Read the card"
              disabled={busy || !cat || cam.kind !== "on"}
              onClick={shoot}
            />
          </div>
        </>
      )}
      {picks ? (
        <div className="cam-result" aria-live="polite">
          <p className="hint">{picks.note}</p>
          {cat && picks.rows.length ? (
            <CatalogTiles cat={cat} rows={picks.rows} coll={coll} addAs={addAs} />
          ) : null}
        </div>
      ) : null}
      <Button variant="link" className="add-manual" onClick={() => onSearch(hint)}>
        Search by name instead
      </Button>
    </div>
  );
}

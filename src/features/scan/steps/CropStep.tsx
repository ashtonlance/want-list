import { Button } from "~/components/ui/button";
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { findPage, project, squareToQuad, turned, type Point, type Quad } from "../engine/image";
import { MARGIN_CORNERS, type Photo } from "../session";

interface CropStepProps {
  photo: Photo;
  cols: number;
  rows: number;
  /** Position of this photo and how many there are. */
  index: number;
  total: number;
  /** Label for the main button: "Next photo", or which pages get read. */
  nextLabel: string;
  /** Must be stable across renders: the photo is reopened whenever it changes. */
  loadImage: (file: File) => Promise<HTMLImageElement>;
  onCorners: (corners: Quad) => void;
  /** The page found automatically once the photo has opened. Must be stable, like `loadImage`. */
  onGuess: (file: File, corners: Quad) => void;
  onRotate: () => void;
  onSkip: () => void;
  onNext: () => void;
}

/** The photo as shown, turned and at most this many pixels on its long side. */
const VIEW_MAX = 1400;
/** How close, in screen pixels, a press must be to a dot to pick it up: a fingertip's width. */
const PICK_RADIUS = 44;

type Loaded = { file: File; rot: number } & ({ view: HTMLCanvasElement } | { failed: true });

const guess = (view: HTMLCanvasElement): Quad => findPage(view) ?? MARGIN_CORNERS;

export function CropStep(props: CropStepProps) {
  const { photo, loadImage, onGuess } = props;
  const { file, rot } = photo;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  // A view made for another photo or turn is stale; this one is still opening.
  const current = loaded?.file === file && loaded.rot === rot ? loaded : null;

  useEffect(() => {
    let live = true;
    loadImage(file).then(
      (img) => {
        if (!live) return;
        const view = turned(img, rot, VIEW_MAX);
        setLoaded({ file, rot, view });
        onGuess(file, guess(view));
      },
      () => {
        if (live) setLoaded({ file, rot, failed: true });
      },
    );
    return () => {
      live = false;
    };
  }, [file, rot, loadImage, onGuess]);

  const view = current && "view" in current ? current.view : null;
  const status = !current
    ? "Opening photo…"
    : view
      ? ""
      : "Couldn't open that photo. Try a JPEG or PNG, or skip it.";

  return (
    <>
      <p className="hint">Drag the four dots to the corners of the page so the grid sits over the pockets.</p>
      {view ? (
        <CropView view={view} photo={photo} cols={props.cols} rows={props.rows} onCorners={props.onCorners} />
      ) : null}
      {status ? <p className="hint">{status}</p> : null}
      <div className="row-btns">
        {view ? (
          <>
            <Button onClick={props.onRotate}>Rotate</Button>
            <Button onClick={() => props.onCorners(guess(view))}>Reset dots</Button>
          </>
        ) : null}
        <Button onClick={props.onSkip}>Skip photo</Button>
      </div>
      <div className="scan-foot">
        {view ? (
          <Button variant="default" className="w-full" onClick={props.onNext}>
            {props.nextLabel}
          </Button>
        ) : null}
        <span className="hint">
          Photo {props.index + 1} of {props.total}
        </span>
      </div>
    </>
  );
}

interface CropViewProps {
  view: HTMLCanvasElement;
  photo: Photo;
  cols: number;
  rows: number;
  onCorners: (corners: Quad) => void;
}

/** The photo with the page outline, pocket grid and four draggable corner dots over it. */
function CropView({ view, photo, cols, rows, onCorners }: CropViewProps) {
  const shown = useRef<HTMLCanvasElement>(null);
  const drag = useRef<number | null>(null);
  const W = view.width;
  const H = view.height;

  useLayoutEffect(() => {
    shown.current?.getContext("2d")?.drawImage(view, 0, 0);
  }, [view]);

  const corners = photo.corners;
  const at = (e: PointerEvent<SVGSVGElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    ];
  };
  const down = (e: PointerEvent<SVGSVGElement>) => {
    if (!corners) return;
    const r = e.currentTarget.getBoundingClientRect();
    let k = -1;
    let best = PICK_RADIUS;
    corners.forEach(([u, v], i) => {
      const d = Math.hypot(r.left + u * r.width - e.clientX, r.top + v * r.height - e.clientY);
      if (d < best) {
        best = d;
        k = i;
      }
    });
    if (k < 0) return;
    drag.current = k;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const move = (e: PointerEvent<SVGSVGElement>) => {
    const k = drag.current;
    if (k === null || !corners) return;
    const p = at(e);
    onCorners([
      k === 0 ? p : corners[0],
      k === 1 ? p : corners[1],
      k === 2 ? p : corners[2],
      k === 3 ? p : corners[3],
    ]);
  };
  const end = () => {
    drag.current = null;
  };

  const q: Quad | null = corners && [
    [corners[0][0] * W, corners[0][1] * H],
    [corners[1][0] * W, corners[1][1] * H],
    [corners[2][0] * W, corners[2][1] * H],
    [corners[3][0] * W, corners[3][1] * H],
  ];
  const lw = Math.max(W, H) / 400;
  const rr = Math.max(W, H) / 40;
  const m = q && squareToQuad(q);
  const line = (key: string, a: Point, b: Point) => (
    <line
      key={key}
      x1={a[0]}
      y1={a[1]}
      x2={b[0]}
      y2={b[1]}
      stroke="#fff"
      strokeWidth={lw}
      strokeDasharray={lw * 6}
    />
  );

  return (
    <div className="crop">
      <canvas ref={shown} className="crop-img" width={W} height={H} />
      <svg
        className="crop-svg"
        viewBox={`0 0 ${W} ${H}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        {q && m ? (
          <>
            <polygon
              points={q.map((p) => p.join(",")).join(" ")}
              fill="rgba(255,255,255,.08)"
              stroke="#fff"
              strokeWidth={lw * 2}
            />
            {Array.from({ length: cols - 1 }, (_, i) =>
              line(`c${i}`, project(m, (i + 1) / cols, 0), project(m, (i + 1) / cols, 1)),
            )}
            {Array.from({ length: rows - 1 }, (_, j) =>
              line(`r${j}`, project(m, 0, (j + 1) / rows), project(m, 1, (j + 1) / rows)),
            )}
            {q.map(([x, y], k) => (
              <g key={k} className="crop-h">
                <circle cx={x} cy={y} r={rr * 1.8} fill="transparent" />
                <circle cx={x} cy={y} r={rr * 0.55} fill="#fff" stroke="#111" strokeWidth={lw * 1.5} />
              </g>
            ))}
          </>
        ) : null}
      </svg>
    </div>
  );
}

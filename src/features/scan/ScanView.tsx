/* Scan binder pages: photos → line up each page → read every pocket → review → save. Nothing is saved
   until the person taps Save, and leaving with unsaved work asks first. */
import { useCanGoBack, useBlocker, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "~/features/auth/AuthProvider";
import { useBinders } from "~/features/binders/useBinders";
import { useCatalog } from "~/features/catalog/catalog";
import { useOverlay } from "~/ui/overlay";
import { useToast } from "~/ui/Toast";
import type { Quad } from "./engine/image";
import { useSaveScan } from "./save";
import { GRID, MAX_PHOTOS, hasWork, willSave, type ScanState, type Step } from "./session";
import { CropStep } from "./steps/CropStep";
import { FixStep } from "./steps/FixStep";
import { LeaveConfirm } from "./steps/LeaveConfirm";
import { ReadStep } from "./steps/ReadStep";
import { ReviewStep } from "./steps/ReviewStep";
import { SavingStep } from "./steps/SavingStep";
import { ScanHead } from "./steps/ScanHead";
import { SetupStep } from "./steps/SetupStep";
import { useScan } from "./useScan";

const titleOf = (s: ScanState): Record<Step, string> => ({
  setup: "Scan binder pages",
  crop: `Line up page ${s.cur + 1}`,
  read: "Reading your pages",
  review: "Check your pages",
  fix: "Fix this pocket",
  saving: "Saving",
});

/**
 * Back to the binders: through history when the scan was opened from there, so Back and Forward stay
 * natural; otherwise (opened from a link or a reload) by replacing this entry.
 */
function useLeave(): () => void {
  const router = useRouter();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  // The router updates the resolved location only after this screen first renders, so on the first
  // render it still names the page the person came from.
  const from = useRouterState({ select: (s) => s.resolvedLocation?.pathname });
  const [fromBinders] = useState(() => from === "/binders" || from === "/binders/");
  return useCallback(() => {
    if (fromBinders && canGoBack) router.history.back();
    else void navigate({ to: "/binders", replace: true });
  }, [fromBinders, canGoBack, router, navigate]);
}

export function ScanView() {
  const { state, dispatch, imageOf, next, stop } = useScan();
  const saveScan = useSaveScan();
  const { binders, local } = useBinders();
  const { ready, canWrite } = useAuth();
  const { toast } = useToast();
  const leave = useLeave();
  const root = useRef<HTMLDivElement>(null);
  const reviewScroll = useRef(0);
  const canScan = canWrite && !local;
  // Start loading the catalog now; reading needs it, and it's large.
  const catalog = useCatalog();

  const blocker = useBlocker({
    shouldBlockFn: () => true,
    enableBeforeUnload: true,
    disabled: !hasWork(state),
    withResolver: true,
  });

  const { step, pockets } = state;
  const [cols, rows] = GRID[pockets];

  useOverlay(true, () => {
    if (step === "fix") dispatch({ type: "closeFix" });
    else leave();
  });

  // Scanning adds cards and binder pages, so it's for editors of the shared list only. The flag keeps a
  // second run of the effect from going back twice.
  const turnedAway = useRef(false);
  useEffect(() => {
    if (!ready || canScan || turnedAway.current) return;
    turnedAway.current = true;
    toast("Sign in as an editor to scan pages");
    leave();
  }, [ready, canScan, toast, leave]);

  useEffect(() => {
    if (catalog.isError) toast("Couldn't load the card catalog. Try again.");
  }, [catalog.isError, toast]);

  // Each step starts at the top, except that review comes back to the pocket that was being fixed.
  useLayoutEffect(() => {
    if (root.current) root.current.scrollTop = step === "review" ? reviewScroll.current : 0;
  }, [step]);

  const onGuess = useCallback(
    (file: File, corners: Quad) => dispatch({ type: "guess", file, corners }),
    [dispatch],
  );

  async function save() {
    if (!canScan) {
      toast("Sign in as an editor to save");
      return;
    }
    dispatch({ type: "saving" });
    const ok = await saveScan(state, () => dispatch({ type: "saved" }));
    if (ok) leave();
    else dispatch({ type: "closeFix" });
  }

  const back =
    step === "fix"
      ? () => dispatch({ type: "closeFix" })
      : step === "crop" && state.cur > 0
        ? () => dispatch({ type: "back" })
        : null;

  return (
    <div className="scanview" ref={root}>
      <div className="scan-in" role="dialog" aria-modal="true" aria-label="Scan binder pages">
        <ScanHead title={titleOf(state)[step]} onBack={back} onClose={leave} />
        {blocker.status === "blocked" ? (
          <LeaveConfirm onLeave={blocker.proceed} onStay={blocker.reset} />
        ) : null}
        {body()}
      </div>
    </div>
  );

  function body() {
    switch (step) {
      case "setup":
        return (
          <SetupStep
            pockets={pockets}
            dest={state.dest}
            name={state.name}
            binders={binders.filter((b) => b.pockets === pockets)}
            onPockets={(n) =>
              dispatch({
                type: "pockets",
                pockets: n,
                keepDest: binders.some((b) => b.id === state.dest && b.pockets === n),
              })
            }
            onDest={(dest) => dispatch({ type: "dest", dest })}
            onName={(name) => dispatch({ type: "name", name })}
            onFiles={(files) => {
              if (files.length > MAX_PHOTOS) toast(`Using the first ${MAX_PHOTOS} photos`);
              dispatch({ type: "photos", files });
            }}
          />
        );
      case "crop": {
        const photo = state.photos[state.cur];
        if (!photo) return null;
        const last = state.cur === state.photos.length - 1;
        const several = state.photos.filter((p) => !p.skip).length > 1 || state.cur > 0;
        return (
          <CropStep
            photo={photo}
            cols={cols}
            rows={rows}
            index={state.cur}
            total={state.photos.length}
            nextLabel={last ? `Read ${several ? "the pages" : "this page"}` : "Next photo"}
            loadImage={imageOf}
            onCorners={(corners) => dispatch({ type: "corners", corners })}
            onGuess={onGuess}
            onRotate={() => dispatch({ type: "rotate" })}
            onSkip={() => next(true)}
            onNext={() => next(false)}
          />
        );
      }
      case "read":
        return <ReadStep prog={state.prog} onStop={stop} />;
      case "review":
        return (
          <ReviewStep
            pages={state.pages}
            cols={cols}
            pockets={pockets}
            destName={binders.find((b) => b.id === state.dest)?.name ?? null}
            name={state.name}
            onFix={(fix) => {
              reviewScroll.current = root.current?.scrollTop ?? 0;
              dispatch({ type: "fix", fix });
            }}
            onSave={() => void save()}
            onStartOver={() => dispatch({ type: "startOver" })}
          />
        );
      case "fix": {
        const cell = state.pages.flat()[state.fix];
        if (!cell || !state.index) return null;
        return (
          <FixStep
            key={state.fix}
            cell={cell}
            page={Math.floor(state.fix / pockets) + 1}
            pocket={(state.fix % pockets) + 1}
            index={state.index}
            onChoose={(pick) => dispatch({ type: "choose", pick })}
          />
        );
      }
      case "saving":
        return <SavingStep saved={state.saved} total={state.pages.flat().filter(willSave).length} />;
    }
  }
}

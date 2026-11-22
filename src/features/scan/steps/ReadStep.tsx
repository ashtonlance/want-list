import type { Progress } from "../session";

interface ReadStepProps {
  prog: Progress;
  onStop: () => void;
}

export function ReadStep({ prog, onStop }: ReadStepProps) {
  const done = (prog.page - 1) * prog.cells + prog.cell;
  const all = prog.pages * prog.cells;
  const pct = all ? Math.round((100 * Math.max(0, done)) / all) : 0;
  const pageOf = prog.pages > 1 && prog.page ? `Page ${prog.page} of ${prog.pages}. ` : "";
  return (
    <div className="scan-read">
      <div className="scan-prog">
        <div className="scan-bar" style={{ width: `${pct}%` }} />
      </div>
      <p className="scan-msg" aria-live="polite">
        {pageOf + prog.msg}
      </p>
      <p className="hint">
        This runs on your phone, about a second or two per pocket. Keep this screen open.
      </p>
      <button className="btn" type="button" onClick={onStop}>
        Stop
      </button>
    </div>
  );
}

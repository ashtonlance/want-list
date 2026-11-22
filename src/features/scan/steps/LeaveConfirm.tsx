interface LeaveConfirmProps {
  onLeave: () => void;
  onStay: () => void;
}

/** Asked before leaving a scan that has photos or matches, since none of it is saved yet. */
export function LeaveConfirm({ onLeave, onStay }: LeaveConfirmProps) {
  return (
    <div className="scan-confirm" role="alert">
      <p>Leave without saving? The photos and matches from this scan will be lost.</p>
      <div className="row-btns">
        <button className="btn danger" type="button" onClick={onLeave}>
          Leave
        </button>
        <button className="btn" type="button" onClick={onStay}>
          Keep going
        </button>
      </div>
    </div>
  );
}

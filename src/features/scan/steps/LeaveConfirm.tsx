import { Button } from "~/components/ui/button";

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
        <Button variant="destructive" onClick={onLeave}>
          Leave
        </Button>
        <Button onClick={onStay}>Keep going</Button>
      </div>
    </div>
  );
}

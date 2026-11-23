import { ChevronLeftIcon, XIcon } from "lucide-react";
import { Button } from "~/components/ui/button";

interface ScanHeadProps {
  title: string;
  /** Shown as a back arrow when there's a step to go back to. */
  onBack: (() => void) | null;
  onClose: () => void;
}

export function ScanHead({ title, onBack, onClose }: ScanHeadProps) {
  return (
    <div className="scan-head">
      {onBack ? (
        <Button size="icon-sm" aria-label="Back" onClick={onBack}>
          <ChevronLeftIcon />
        </Button>
      ) : (
        <span className="scan-sp" />
      )}
      <h3>{title}</h3>
      <Button size="icon-sm" aria-label="Close" onClick={onClose}>
        <XIcon />
      </Button>
    </div>
  );
}

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
        <button className="sheet-x" type="button" aria-label="Back" onClick={onBack}>
          ‹
        </button>
      ) : (
        <span className="scan-sp" />
      )}
      <h3>{title}</h3>
      <button className="sheet-x" type="button" aria-label="Close" onClick={onClose}>
        ×
      </button>
    </div>
  );
}

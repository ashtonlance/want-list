interface SavingStepProps {
  saved: number;
  total: number;
}

export function SavingStep({ saved, total }: SavingStepProps) {
  return (
    <div className="scan-read">
      <p className="scan-msg" aria-live="polite">
        Saved {saved} of {total}
      </p>
      <p className="hint">Keep this screen open for a moment.</p>
    </div>
  );
}

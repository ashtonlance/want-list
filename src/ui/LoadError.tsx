/** A failed load, said plainly, with a way to try again. */
export function LoadError({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="empty-state" role="alert">
      {text}{" "}
      <button className="btn small" type="button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

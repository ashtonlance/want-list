import { Button } from "~/components/ui/button";
import { Empty } from "~/components/ui/empty";

/** A failed load, said plainly, with a way to try again. */
export function LoadError({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <Empty role="alert">
      {text}{" "}
      <Button size="sm" onClick={onRetry}>
        Try again
      </Button>
    </Empty>
  );
}

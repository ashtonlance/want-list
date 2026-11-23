import { Alert } from "~/components/ui/alert";
import { useOnline } from "~/lib/online";

/** Says so while there's no connection, so a change that can't save never looks like it did. */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <Alert variant="muted" role="status">
      You&apos;re offline. You can look around, but changes won&apos;t save until you&apos;re back.
    </Alert>
  );
}

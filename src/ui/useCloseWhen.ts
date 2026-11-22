import { useEffect, useRef } from "react";

/** Closes a sheet once when what it shows has gone (removed, or never existed). */
export function useCloseWhen(gone: boolean, onClose: () => void): void {
  const closed = useRef(false);
  useEffect(() => {
    if (!gone || closed.current) return;
    closed.current = true;
    onClose();
  }, [gone, onClose]);
}

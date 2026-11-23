import { useCallback } from "react";
import { useToast } from "~/ui/Toast";
import { shareUrl } from "./share";

/**
 * Shares the read-only want list page: the phone's share sheet where there is one, else the link
 * is copied. `coll` narrows the page to one collection.
 */
export function useShareLink(): (coll: string | null) => Promise<void> {
  const { toast } = useToast();
  return useCallback(
    async (coll) => {
      const url = shareUrl(location.origin, import.meta.env.BASE_URL, coll);
      const title = coll ? `Ashton's want list: ${coll}` : "Ashton's want list";
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ title, url });
          return;
        } catch (e) {
          // Closing the share sheet isn't a failure. After any other failure the tap no longer counts as
          // fresh, so the browser may refuse the clipboard too; the toast then shows the link itself.
          if (e instanceof DOMException && e.name === "AbortError") return;
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        toast("Link copied");
      } catch {
        toast(`Couldn't share. The link is ${url}`);
      }
    },
    [toast],
  );
}

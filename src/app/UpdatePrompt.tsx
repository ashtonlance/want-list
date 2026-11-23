import { useEffect } from "react";
import { toast } from "sonner";
import { useRegisterSW } from "virtual:pwa-register/react";

const HOUR = 60 * 60_000;
const ID = "update";

/**
 * Says when a new version has been published, and swaps it in on a tap. Checks for one every hour and each
 * time the app comes back to the front, so an installed app doesn't keep running an old build. It waits
 * quietly at the bottom (a toast that stays) until tapped.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (document.visibilityState === "visible" && navigator.onLine) void registration.update();
      };
      setInterval(check, HOUR);
      document.addEventListener("visibilitychange", check);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    toast("A new version is ready.", {
      id: ID,
      duration: Infinity,
      // No swiping it away: it would never come back while this build keeps running.
      dismissible: false,
      action: { label: "Refresh", onClick: () => void updateServiceWorker(true) },
      cancel: { label: "Later", onClick: () => setNeedRefresh(false) },
    });
    return () => {
      toast.dismiss(ID);
    };
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return null;
}

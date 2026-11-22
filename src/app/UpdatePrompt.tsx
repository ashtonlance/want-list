import { useRegisterSW } from "virtual:pwa-register/react";

const HOUR = 60 * 60_000;

/**
 * Says when a new version has been published, and swaps it in on a tap. Checks for one every hour and each
 * time the app comes back to the front, so an installed app doesn't keep running an old build. It waits
 * quietly at the bottom until tapped.
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

  if (!needRefresh) return null;
  return (
    <div className="toast update-toast" role="status">
      A new version is ready.
      <button className="toast-undo" type="button" onClick={() => void updateServiceWorker(true)}>
        Refresh
      </button>
      <button className="toast-undo" type="button" aria-label="Not now" onClick={() => setNeedRefresh(false)}>
        Later
      </button>
    </div>
  );
}

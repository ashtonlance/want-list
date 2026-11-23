import { useEffect, useState } from "react";

export type CameraState =
  { kind: "starting" } | { kind: "on"; stream: MediaStream } | { kind: "off"; denied: boolean };

/* The back camera, as sharp as the phone offers up to 1080p. Text on a card is small, so resolution matters. */
const CONSTRAINTS: MediaStreamConstraints = {
  video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
  audio: false,
};

/**
 * The back camera while the component is mounted. It's let go whenever the page is hidden (so the camera
 * light goes off when the app is put away) and picked up again on return.
 */
export function useCamera(enabled = true): CameraState {
  const [state, setState] = useState<CameraState>({ kind: "starting" });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    // Once refused or missing, it stays off: asking again on every return would re-prompt, and the
    // phone's own camera (for a photo instead) hides the page too.
    let off = false;
    let stream: MediaStream | null = null;
    let pending = false;
    const drop = (s: MediaStream) => s.getTracks().forEach((t) => t.stop());

    const start = async () => {
      if (pending || stream || off) return;
      pending = true;
      setState({ kind: "starting" });
      try {
        // Throws on a page without camera support (no mediaDevices) as well as on a refusal.
        const s = await navigator.mediaDevices.getUserMedia(CONSTRAINTS);
        if (!alive || document.hidden) {
          drop(s);
          return;
        }
        stream = s;
        setState({ kind: "on", stream: s });
      } catch (e) {
        off = true;
        if (alive)
          setState({ kind: "off", denied: e instanceof DOMException && e.name === "NotAllowedError" });
      } finally {
        pending = false;
      }
    };

    const stop = () => {
      if (stream) drop(stream);
      stream = null;
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (!stream) return;
        stop();
        setState({ kind: "starting" });
      } else void start();
    };

    void start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [enabled]);

  return state;
}

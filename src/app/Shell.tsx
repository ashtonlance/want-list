import { Outlet } from "@tanstack/react-router";
import { useRealtimeSync } from "~/data/realtime";
import { AuthProvider } from "~/features/auth/AuthProvider";
import { Datalists } from "~/features/list/Datalists";
import { LightboxProvider } from "~/ui/Lightbox";
import { ToastProvider } from "~/ui/Toast";
import { OverlayHost } from "./OverlayHost";
import { TabBar } from "./TabBar";
import { Topbar } from "./Topbar";
import { useSectionMemory } from "./useSectionMemory";

/** The frame around every screen: top bar, tab bar, sheets, and the app-wide providers. */
export function Shell() {
  return (
    <AuthProvider>
      <ToastProvider>
        <LightboxProvider>
          <Frame />
        </LightboxProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

function Frame() {
  useRealtimeSync();
  useSectionMemory();
  return (
    <>
      <Topbar />
      <main className="wrap">
        <Outlet />
      </main>
      <TabBar />
      <OverlayHost />
      <Datalists />
    </>
  );
}

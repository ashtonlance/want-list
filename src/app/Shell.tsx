import { Outlet, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { useRealtimeSync } from "~/data/realtime";
import { AuthProvider } from "~/features/auth/AuthProvider";
import { useSetNameCleanup } from "~/features/cards/useSetNameCleanup";
import { usePriceBackfill } from "~/features/cards/usePriceBackfill";
import { Datalists } from "~/features/list/Datalists";
import { useDesktop } from "~/lib/useMediaQuery";
import { LightboxProvider } from "~/ui/Lightbox";
import { ToastProvider } from "~/ui/Toast";
import { OfflineBanner } from "./OfflineBanner";
import { OverlayHost } from "./OverlayHost";
import { SideNav } from "./SideNav";
import { SideSlot } from "~/ui/sideSlot";
import { TabBar } from "./TabBar";
import { UpdatePrompt } from "./UpdatePrompt";
import { Topbar } from "./Topbar";
import { useSectionMemory } from "./useSectionMemory";
import { isSharePath } from "./sections";

/** The frame around every screen: top bar, tab bar (side bar on a desktop), sheets, and the app-wide providers. */
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
  // The shared want list is a read-only page for family and friends: no tabs, sheets, live sync or edits.
  const shared = isSharePath(useLocation({ select: (l) => l.pathname }));
  return shared ? (
    <main className="wrap share-wrap">
      <Outlet />
    </main>
  ) : (
    <AppFrame />
  );
}

function AppFrame() {
  useRealtimeSync();
  useSectionMemory();
  useSetNameCleanup();
  usePriceBackfill();
  const desktop = useDesktop();
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  return (
    <SideSlot value={desktop ? slot : null}>
      {desktop ? <SideNav slotRef={setSlot} /> : null}
      <Topbar />
      <main className="wrap">
        <OfflineBanner />
        <Outlet />
      </main>
      {desktop ? null : <TabBar />}
      <OverlayHost />
      <Datalists />
      <UpdatePrompt />
    </SideSlot>
  );
}

import { useSearch } from "@tanstack/react-router";
import { AccountSheet } from "~/features/auth/AccountSheet";
import { CardSheet } from "~/features/cards/CardSheet";
import { LiveSheet } from "~/features/explore/LiveSheet";
import { PickSheet } from "~/features/explore/PickSheet";
import { AddSheet } from "~/features/list/AddSheet";
import { OptionsSheet } from "~/features/list/OptionsSheet";
import { useOverlayNav } from "./overlayNav";

/** The sheets whose state lives in the address: closing one with the back button works everywhere. */
export function OverlayHost() {
  const search = useSearch({ strict: false });
  const { close } = useOverlayNav();
  return (
    <>
      {search.card ? <CardSheet id={search.card} onClose={close} /> : null}
      {search.pick ? <PickSheet id={search.pick} onClose={close} /> : null}
      {search.live ? <LiveSheet id={search.live} onClose={close} /> : null}
      {search.panel === "account" ? <AccountSheet onClose={close} /> : null}
      {search.panel === "add" ? <AddSheet onClose={close} /> : null}
      {search.panel === "options" ? <OptionsSheet onClose={close} /> : null}
    </>
  );
}

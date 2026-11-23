import { useSearch } from "@tanstack/react-router";
import { AccountSheet } from "~/features/auth/AccountSheet";
import { CardSheet } from "~/features/cards/CardSheet";
import { LiveSheet } from "~/features/explore/LiveSheet";
import { PickSheet } from "~/features/explore/PickSheet";
import { SetsSheet } from "~/features/explore/SetsSheet";
import { AddSheet } from "~/features/list/AddSheet";
import { CollectionsSheet } from "~/features/list/CollectionsSheet";
import { OptionsSheet } from "~/features/list/OptionsSheet";
import { useDesktop } from "~/lib/useMediaQuery";
import { KeysSheet } from "./KeysSheet";
import { useOverlayNav } from "./overlayNav";
import { detailOf } from "./search";

/** The sheets whose state lives in the address: closing one with the back button works everywhere. */
export function OverlayHost() {
  const search = useSearch({ strict: false });
  const { close } = useOverlayNav();
  const desktop = useDesktop();
  const shown = desktop ? detailOf(search) : undefined;
  return (
    <>
      {shown ? <CurrentTile id={shown} /> : null}
      {search.card ? <CardSheet id={search.card} onClose={close} /> : null}
      {search.pick ? <PickSheet id={search.pick} onClose={close} /> : null}
      {search.live ? <LiveSheet id={search.live} onClose={close} /> : null}
      {search.panel === "account" ? <AccountSheet onClose={close} /> : null}
      {search.panel === "add" ? <AddSheet onClose={close} /> : null}
      {search.panel === "options" ? <OptionsSheet onClose={close} /> : null}
      {search.panel === "collections" ? <CollectionsSheet onClose={close} /> : null}
      {search.panel === "sets" ? <SetsSheet onClose={close} /> : null}
      {search.panel === "keys" ? <KeysSheet onClose={close} /> : null}
    </>
  );
}

/**
 * Marks the tile of the card in the desktop details pane, so it's clear which one the pane shows. A rule
 * rather than a class, so it holds as a virtual grid redraws its rows.
 */
function CurrentTile({ id }: { id: string }) {
  const tile = `main [data-sr="${CSS.escape(id)}"]`;
  return (
    <style>{`${tile} .tile-img { box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--ink); }
${tile}.row { background: var(--sunk); }`}</style>
  );
}

import type { Ref } from "react";
import { Button } from "~/components/ui/button";
import { Kbd } from "~/components/ui/kbd";
import { KeyboardIcon } from "~/ui/icons";
import { useOverlayNav } from "./overlayNav";
import { useSectionLinks } from "./sectionLinks";

/**
 * The desktop side bar, in place of the phone's tab bar: the sections, then whatever the screen puts in
 * its slot (its collections, sets or binders, see ui/Rail), and the keyboard shortcuts at the foot.
 */
export function SideNav({ slotRef }: { slotRef: Ref<HTMLDivElement> }) {
  const links = useSectionLinks();
  const { open } = useOverlayNav();
  return (
    <aside className="sidenav">
      <p className="side-brand">Poke Cards</p>
      <nav className="side-sections" aria-label="Sections">
        {links.map((l) => (
          <a key={l.section} href={l.href} aria-current={l.current ? "page" : undefined} onClick={l.onClick}>
            {l.icon}
            {l.label}
          </a>
        ))}
      </nav>
      <div className="side-slot" ref={slotRef} />
      <div className="side-foot">
        <Button variant="ghost" onClick={() => open({ panel: "keys" })}>
          <KeyboardIcon />
          Keyboard shortcuts
          <Kbd className="ml-auto">?</Kbd>
        </Button>
      </div>
    </aside>
  );
}

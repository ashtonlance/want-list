import { useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { useAuth } from "~/features/auth/AuthProvider";
import { ExploreTabs } from "~/features/explore/ExploreTabs";
import { useActiveCollection } from "~/features/list/useActiveCollection";
import { useCollections } from "~/features/cards/useCollections";
import { useShareLink } from "~/features/share/useShareLink";
import { cn } from "~/lib/utils";
import { PlusIcon, ShareIcon } from "~/ui/icons";
import { useOverlayNav } from "./overlayNav";
import { sectionOf } from "./sections";

const TITLES = { explore: "Explore", binders: "Binders" } as const;

function useScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return scrolled;
}

export function Topbar() {
  const section = sectionOf(useLocation({ select: (l) => l.pathname }));
  const coll = useActiveCollection();
  const { email, canWrite } = useAuth();
  const { open } = useOverlayNav();
  const scrolled = useScrolled();
  const share = useShareLink();
  // A saved collection name is only trusted once collections load, so a renamed one isn't shared.
  const collsLoaded = useCollections().loaded;
  const title = section === "list" ? (coll ?? "My list") : TITLES[section];

  return (
    <header className={"topbar" + (scrolled ? " scrolled" : "")}>
      <div className="topbar-in">
        {section === "explore" ? (
          <div className="tb-title">
            <h1 className="sr-only">{title}</h1>
            <ExploreTabs />
          </div>
        ) : (
          <div className="tb-title">
            <h1 title={title}>{title}</h1>
          </div>
        )}
        <div className="tb-acts">
          {section === "list" ? (
            <Button
              size="icon"
              aria-label={coll ? `Share ${coll}` : "Share the want list"}
              disabled={coll !== null && !collsLoaded}
              onClick={() => void share(coll)}
            >
              <ShareIcon />
            </Button>
          ) : null}
          {canWrite && section === "list" ? (
            <Button
              variant="default"
              size="icon"
              aria-label="Add a card"
              onClick={() => open({ panel: "add" })}
            >
              <PlusIcon />
            </Button>
          ) : null}
          <Button
            size="sm"
            className={cn(
              "h-9 min-w-9 rounded-full px-3.5 py-0",
              email && "w-9 bg-foreground px-0 text-[15px] text-background",
            )}
            aria-label="Account and sign in"
            onClick={() => open({ panel: "account" })}
          >
            {email ? email.charAt(0).toUpperCase() : "Sign in"}
          </Button>
        </div>
      </div>
    </header>
  );
}

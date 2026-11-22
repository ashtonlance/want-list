import { useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "~/features/auth/AuthProvider";
import { useActiveCollection } from "~/features/list/useActiveCollection";
import { PlusIcon } from "~/ui/icons";
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
  const title = section === "list" ? (coll ?? "My list") : TITLES[section];

  return (
    <header className={"topbar" + (scrolled ? " scrolled" : "")}>
      <div className="topbar-in">
        <div className="tb-title">
          <small>Ashton&apos;s Want List</small>
          <h1>{title}</h1>
        </div>
        <div className="tb-acts">
          {canWrite && section === "list" ? (
            <button
              type="button"
              className="icon-btn primary"
              aria-label="Add a card"
              onClick={() => open({ panel: "add" })}
            >
              <PlusIcon />
            </button>
          ) : null}
          <button
            type="button"
            className={"acct-btn" + (email ? " avatar" : "")}
            aria-label="Account and sign in"
            onClick={() => open({ panel: "account" })}
          >
            {email ? email.charAt(0).toUpperCase() : "Sign in"}
          </button>
        </div>
      </div>
    </header>
  );
}

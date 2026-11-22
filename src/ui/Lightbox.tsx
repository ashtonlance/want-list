import { useLocation } from "@tanstack/react-router";
import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { bigImage } from "~/lib/images";
import { useOverlay } from "./overlay";

export interface LightboxItem {
  src: string;
  name: string;
  /** The line under the name: set, number, price. */
  caption: string;
}

const LightboxContext = createContext<((item: LightboxItem) => void) | null>(null);

/** Full-screen card photo. Closes on Escape, a tap outside the photo, or any navigation. */
export function LightboxProvider({ children }: { children: ReactNode }) {
  const [opened, setOpened] = useState<{ item: LightboxItem; href: string } | null>(null);
  const lastFocus = useRef<Element | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const href = useLocation({ select: (l) => l.href });
  // Navigating anywhere closes the photo.
  const item = opened?.href === href ? opened.item : null;

  const close = () => {
    setOpened(null);
    if (lastFocus.current instanceof HTMLElement) lastFocus.current.focus();
  };
  useOverlay(item !== null, close);
  useEffect(() => {
    if (item) closeBtn.current?.focus();
  }, [item]);

  const open = useCallback(
    (next: LightboxItem) => {
      lastFocus.current = document.activeElement;
      setOpened({ item: next, href });
    },
    [href],
  );

  return (
    <LightboxContext value={open}>
      {children}
      {item ? (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Card photo"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <button className="close" type="button" aria-label="Close" ref={closeBtn} onClick={close}>
            ×
          </button>
          <img src={bigImage(item.src)} alt={`${item.name} card`} />
          <div className="cap">
            <b>{item.name}</b>
            {item.caption}
          </div>
        </div>
      ) : null}
    </LightboxContext>
  );
}

export function useLightbox(): (item: LightboxItem) => void {
  const open = use(LightboxContext);
  if (!open) throw new Error("useLightbox needs a LightboxProvider");
  return open;
}

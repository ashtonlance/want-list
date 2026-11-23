import { useLayoutEffect, useRef, useState } from "react";

interface SegProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}

/** A row of mutually exclusive buttons. The highlight slides to the chosen one. */
export function Seg<T extends string>({ label, value, options, onChange, className }: SegProps<T>) {
  const box = useRef<HTMLDivElement>(null);
  // Set once the highlight has its first place, so it appears there instead of sliding in from the left.
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const place = () => {
      const on = el.querySelector<HTMLElement>('button[aria-pressed="true"]');
      el.style.setProperty("--x", `${String(on?.offsetLeft ?? 0)}px`);
      el.style.setProperty("--w", `${String(on?.offsetWidth ?? 0)}px`);
    };
    place();
    if (typeof ResizeObserver === "undefined") return;
    // Widths change with the text size and the screen; keep the highlight on its button.
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value, options]);

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      ref={box}
      className={"seg has-thumb" + (ready ? " ready" : "") + (className ? " " + className : "")}
      role="group"
      aria-label={label}
    >
      <span className="seg-thumb" aria-hidden="true" />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

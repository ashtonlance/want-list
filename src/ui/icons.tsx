import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base: IconProps = { viewBox: "0 0 24 24", "aria-hidden": true, focusable: false };

export const PlusIcon = (p: IconProps) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const TickIcon = (p: IconProps) => (
  <svg
    {...base}
    fill="none"
    stroke="currentColor"
    strokeWidth={2.4}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export const CrossIcon = (p: IconProps) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" {...p}>
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </svg>
);

/** Outline star; pass `filled` for the solid version. */
export const StarIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <svg {...base} fill={filled ? "currentColor" : "none"} {...p}>
    <path
      d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.5l-5.1 2.7 1-5.6-4.1-4 5.7-.8z"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinejoin="round"
    />
  </svg>
);

/** Solid star used as a priority marker on tiles. */
export const StarMark = (p: IconProps) => <StarIcon filled {...p} />;

export const SlidersIcon = (p: IconProps) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </svg>
);

export const ListIcon = (p: IconProps) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" {...p}>
    <rect x="7" y="3.5" width="12" height="16" rx="2" />
    <path d="M4.5 7v11.5a2 2 0 0 0 2 2H15" />
  </svg>
);

export const CompassIcon = (p: IconProps) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M15.5 8.5l-2 5-5 2 2-5z" />
  </svg>
);

export const BinderIcon = (p: IconProps) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" {...p}>
    <rect x="4" y="4" width="16" height="16" rx="2.5" />
    <path d="M12 4v16M4 12h16" />
  </svg>
);

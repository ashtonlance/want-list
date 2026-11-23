import {
  Camera,
  Check,
  Compass,
  GalleryVerticalEnd,
  Grid2x2,
  Plus,
  Share,
  SlidersHorizontal,
  Star,
  X,
  type LucideProps,
} from "lucide-react";

/**
 * The app's icons, from Lucide (shadcn/ui's icon set), named for what they mean here. Strokes match the
 * weight each was drawn at: bolder for small action marks, lighter for the tab bar.
 */
export const PlusIcon = (p: LucideProps) => <Plus strokeWidth={2.4} {...p} />;
export const TickIcon = (p: LucideProps) => <Check strokeWidth={2.4} {...p} />;
export const CrossIcon = (p: LucideProps) => <X strokeWidth={2.4} {...p} />;

/** Outline star; pass `filled` for the solid version. */
export const StarIcon = ({ filled, ...p }: LucideProps & { filled?: boolean }) => (
  <Star strokeWidth={1.7} strokeLinejoin="round" fill={filled ? "currentColor" : "none"} {...p} />
);

/** Solid star used as a priority marker on tiles. */
export const StarMark = (p: LucideProps) => <StarIcon filled {...p} />;

export const SlidersIcon = (p: LucideProps) => <SlidersHorizontal {...p} />;

/** My list: a stack of cards. */
export const ListIcon = (p: LucideProps) => <GalleryVerticalEnd strokeWidth={1.8} {...p} />;
export const CompassIcon = (p: LucideProps) => <Compass strokeWidth={1.8} {...p} />;
/** Binders: a page of pockets. */
export const BinderIcon = (p: LucideProps) => <Grid2x2 strokeWidth={1.8} {...p} />;
/** The iPhone share mark: a box with an arrow out of the top. */
export const ShareIcon = (p: LucideProps) => <Share strokeWidth={1.9} {...p} />;
export const CameraIcon = (p: LucideProps) => <Camera strokeWidth={1.8} {...p} />;

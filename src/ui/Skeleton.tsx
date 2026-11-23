import { Skeleton } from "~/components/ui/skeleton";

/** A grid of placeholder tiles (shadcn/ui Skeleton) while cards load. */
export function SkeletonGrid({ className, count }: { className: string; count: number }) {
  return (
    <div className={className} aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div className="flex flex-col gap-1.5" key={i}>
          <Skeleton className="aspect-[63/88]" />
          <Skeleton className="h-[11px] w-4/5" />
          <Skeleton className="h-[11px] w-[55%]" />
        </div>
      ))}
    </div>
  );
}

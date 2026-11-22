export function SkeletonGrid({ className, count }: { className: string; count: number }) {
  return (
    <div className={className} aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div className="skel-tile" key={i}>
          <div className="skel" />
          <div className="skel skel-line" style={{ width: "80%" }} />
          <div className="skel skel-line" style={{ width: "55%" }} />
        </div>
      ))}
    </div>
  );
}

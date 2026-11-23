import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";

interface SegProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}

/** A segmented control (shadcn/ui Toggle Group): one option always chosen, the highlight slides to it. */
export function Seg<T extends string>({ label, value, options, onChange, className }: SegProps<T>) {
  return (
    <ToggleGroup
      type="single"
      aria-label={label}
      value={value}
      // Tapping the chosen option again would clear it; a segmented control always keeps one.
      onValueChange={(v) => {
        const hit = options.find((o) => o.value === v);
        if (hit) onChange(hit.value);
      }}
      className={className}
    >
      {options.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value}>
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

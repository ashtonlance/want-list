interface SegProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}

/** A row of mutually exclusive buttons. */
export function Seg<T extends string>({ label, value, options, onChange, className }: SegProps<T>) {
  return (
    <div className={"seg" + (className ? " " + className : "")} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

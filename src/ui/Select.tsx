import type { SelectHTMLAttributes } from "react";

interface SelectProps<T extends string | number> extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "value" | "onChange"
> {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}

/** A native select whose options carry typed values (strings or numbers). */
export function Select<T extends string | number>({ value, options, onChange, ...rest }: SelectProps<T>) {
  return (
    <select
      value={String(value)}
      onChange={(e) => {
        const hit = options.find((o) => String(o.value) === e.target.value);
        if (hit) onChange(hit.value);
      }}
      {...rest}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

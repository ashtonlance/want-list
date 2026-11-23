import type { SelectHTMLAttributes } from "react";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";

interface SelectProps<T extends string | number> extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "value" | "onChange"
> {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  /** Classes for the select itself; `className` sizes the box around it. */
  selectClassName?: string;
}

/** shadcn/ui Native Select whose options carry typed values (strings or numbers). */
export function Select<T extends string | number>({ value, options, onChange, ...rest }: SelectProps<T>) {
  return (
    <NativeSelect
      value={String(value)}
      onChange={(e) => {
        const hit = options.find((o) => String(o.value) === e.target.value);
        if (hit) onChange(hit.value);
      }}
      {...rest}
    >
      {options.map((o) => (
        <NativeSelectOption key={String(o.value)} value={String(o.value)}>
          {o.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

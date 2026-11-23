import { ChevronDownIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "~/lib/utils";
import { inputClass } from "./input";

/**
 * shadcn/ui Native Select: the phone's own picker (the wheel on iPhone), drawn like Input.
 * `className` sizes the wrapper, `selectClassName` the select inside it.
 */
function NativeSelect({
  className,
  selectClassName,
  ...props
}: ComponentProps<"select"> & { selectClassName?: string }) {
  return (
    <div
      data-slot="native-select-wrapper"
      className={cn(
        "group/native-select relative w-full min-w-0 has-[select:disabled]:opacity-50",
        className,
      )}
    >
      <select
        data-slot="native-select"
        className={cn(inputClass, "cursor-pointer pr-9 disabled:pointer-events-none", selectClassName)}
        {...props}
      />
      <ChevronDownIcon
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground select-none"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  );
}

function NativeSelectOption(props: ComponentProps<"option">) {
  return <option data-slot="native-select-option" {...props} />;
}

export { NativeSelect, NativeSelectOption };

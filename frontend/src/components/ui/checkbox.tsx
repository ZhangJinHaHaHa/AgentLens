import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const inputId = id ?? React.useId();
    return (
      <label
        htmlFor={inputId}
        className={cn(
          "group relative inline-flex cursor-pointer select-none items-center gap-2 text-sm",
          "text-muted-foreground hover:text-foreground transition-colors",
          props.disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <span className="relative inline-flex h-4 w-4 items-center justify-center">
          <input
            id={inputId}
            ref={ref}
            type="checkbox"
            className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded border border-border bg-transparent transition-colors checked:border-foreground checked:bg-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            {...props}
          />
          <Check className="pointer-events-none h-3 w-3 text-background opacity-0 transition-opacity peer-checked:opacity-100" />
        </span>
        {label != null && <span className="text-foreground/90">{label}</span>}
      </label>
    );
  }
);
Checkbox.displayName = "Checkbox";

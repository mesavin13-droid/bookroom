import * as React from "react";
import { cn } from "@/lib/utils";

export const Checkbox = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        "size-5 shrink-0 cursor-pointer appearance-none rounded-md border border-input bg-surface transition-colors checked:border-primary checked:bg-primary",
        "bg-center bg-no-repeat checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22 fill=%22none%22 stroke=%22%23222%22 stroke-width=%222%22><path d=%22m4 8.5 2.5 2.5L12 5.5%22/></svg>')]",
        className,
      )}
      {...props}
    />
  ),
);
Checkbox.displayName = "Checkbox";

import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "h-11 w-full min-w-0 rounded-md border border-border bg-navy/60 px-2 font-mono text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-subtle focus-visible:border-primary/70 focus-visible:ring-2 focus-visible:ring-ring/40 sm:px-3",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };

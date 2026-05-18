import * as React from "react";
import { cn } from "@/lib/utils";

type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "bottom";
  className?: string;
};

export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();

  const show = () => setOpen(true);
  const hide = () => setOpen(false);

  const child = React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
    "aria-describedby": open ? id : undefined,
  });

  return (
    <span className="relative inline-flex">
      {child}
      {open && content && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute left-1/2 -translate-x-1/2 z-50",
            "whitespace-nowrap rounded-md px-2 py-1 text-xs font-roboto",
            "bg-slate-900 text-white shadow-lg",
            "animate-in fade-in-0 zoom-in-95 duration-150",
            side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
            className,
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}

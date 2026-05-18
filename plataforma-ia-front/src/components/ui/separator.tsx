import { cn } from "@/lib/utils";

type Props = {
  orientation?: "horizontal" | "vertical";
  className?: string;
  decorative?: boolean;
};

export function Separator({ orientation = "horizontal", className, decorative = true }: Props) {
  return (
    <div
      role={decorative ? "none" : "separator"}
      aria-orientation={orientation}
      className={cn(
        "bg-slate-200",
        orientation === "horizontal" ? "h-px w-full" : "w-px h-full",
        className,
      )}
    />
  );
}

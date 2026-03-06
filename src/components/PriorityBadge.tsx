import { cn } from "@/lib/utils";

interface PriorityBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

export function PriorityBadge({ score, size = "md" }: PriorityBadgeProps) {
  const getColor = () => {
    if (score >= 8) return "bg-bellum-success/15 text-bellum-success border-bellum-success/30";
    if (score >= 5) return "bg-bellum-warning/15 text-bellum-warning border-bellum-warning/30";
    return "bg-destructive/15 text-destructive border-destructive/30";
  };

  const sizeClasses = {
    sm: "h-6 w-6 text-xs",
    md: "h-9 w-9 text-sm",
    lg: "h-12 w-12 text-lg",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-lg border font-mono font-bold transition-transform duration-200 hover:scale-110",
        getColor(),
        sizeClasses[size],
        score >= 8 && "score-pulse"
      )}
    >
      {score}
    </div>
  );
}

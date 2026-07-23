import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MetricConfidence } from "@/lib/metrics/types";

const STYLES: Record<MetricConfidence, { label: string; dot: string; className: string }> = {
  high: {
    label: "High confidence",
    dot: "bg-emerald-500",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  medium: {
    label: "Medium confidence",
    dot: "bg-foreground/50",
    className: "",
  },
  low: {
    label: "Low confidence",
    dot: "bg-amber-500",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  insufficient: {
    label: "Insufficient sample",
    dot: "bg-muted-foreground",
    className: "text-muted-foreground",
  },
};

export function ConfidenceBadge({ confidence }: { confidence?: MetricConfidence }) {
  if (!confidence) return null;
  const s = STYLES[confidence];
  const variant = confidence === "medium" ? "secondary" : "outline";
  return (
    <Badge variant={variant} className={cn("gap-1.5 font-normal", s.className)}>
      <span className={cn("size-1.5 rounded-full", s.dot)} aria-hidden />
      {s.label}
    </Badge>
  );
}

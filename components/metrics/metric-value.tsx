import { formatMetric, gateMessage, isReliable } from "@/lib/metrics/format";
import { cn } from "@/lib/utils";
import type { Metric } from "@/lib/metrics/types";

/** The short human-readable provenance line for a metric. */
export function provenanceCaption(metric: Metric): string {
  const parts: string[] = [];
  if (metric.interval) {
    parts.push(`95% CI ${Math.round(metric.interval.low)}–${Math.round(metric.interval.high)}%`);
  }
  if (metric.sample) parts.push(`n=${metric.sample.n}`);
  parts.push(metric.basis);
  return parts.join(" · ");
}

export function MetricValue({ metric, className }: { metric: Metric; className?: string }) {
  const reliable = isReliable(metric);
  return (
    <span
      className={cn(reliable ? "tabular-nums" : "text-muted-foreground", className)}
      title={provenanceCaption(metric)}
    >
      {reliable ? formatMetric(metric) : gateMessage(metric)}
    </span>
  );
}

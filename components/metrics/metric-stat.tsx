import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import { ConfidenceBadge } from "@/components/metrics/confidence-badge";
import { provenanceCaption } from "@/components/metrics/metric-value";
import { formatMetric, gateMessage, isReliable } from "@/lib/metrics/format";
import { cn } from "@/lib/utils";
import type { Metric } from "@/lib/metrics/types";

export function MetricStat({
  label,
  metric,
  previous,
  className,
}: {
  label: string;
  metric: Metric;
  previous?: string;
  className?: string;
}) {
  const reliable = isReliable(metric);
  return (
    <Card className={cn("gap-3 py-5", className)}>
      <CardHeader className="gap-2">
        <CardDescription>{label}</CardDescription>
        {previous ? <p className="text-xs text-muted-foreground">{previous}</p> : null}
        {reliable ? (
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{formatMetric(metric)}</p>
        ) : (
          <p className="text-sm font-medium text-muted-foreground">{gateMessage(metric)}</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <ConfidenceBadge confidence={metric.confidence} />
        </div>
        <p className="text-xs text-muted-foreground" title={metric.basis}>
          {provenanceCaption(metric)}
        </p>
      </CardHeader>
    </Card>
  );
}

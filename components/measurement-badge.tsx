import { Badge } from "@/components/ui/badge";
import type { MeasurementLabel } from "@/lib/providers/measurement";

const VARIANT: Record<MeasurementLabel, "default" | "secondary" | "outline"> = {
  measured: "default",
  simulated: "secondary",
  estimate: "outline",
};

/**
 * Renders the honesty label carried by every ingestion/data-mesh record:
 * `measured` (real observation) · `simulated` (LLM/mock) · `estimate` (modelled).
 */
export function MeasurementBadge({ measurement, source }: { measurement: MeasurementLabel; source?: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <Badge variant={VARIANT[measurement]}>{measurement}</Badge>
      {source && <span className="text-xs text-muted-foreground">via {source}</span>}
    </span>
  );
}

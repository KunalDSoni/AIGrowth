import { TrendingUp } from "lucide-react";
import { outcomeLearningRecords } from "@/lib/data/demo";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OutcomesPage() {
  return (
    <>
      <PageHeader
        title="What changed after implementation?"
        description="Simulated before-and-after comparisons with attribution limits. These are learning signals, not proof of guaranteed causation."
        action={<Badge variant="secondary">Demo outcomes</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {outcomeLearningRecords.map((record) => (
          <Card key={record.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardDescription>Implemented action</CardDescription>
                  <CardTitle className="text-base">{record.recommendationTitle}</CardTitle>
                </div>
                <Badge variant="secondary">{record.outcomeConfidence} confidence</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3 rounded-lg border p-3 text-sm">
                <div><p className="font-medium">Baseline</p><p className="text-muted-foreground">{record.baselinePeriod}</p></div>
                <div><p className="font-medium">Implementation</p><p className="text-muted-foreground">{record.implementationDate}</p></div>
                <div><p className="font-medium">Comparison</p><p className="text-muted-foreground">{record.comparisonPeriod}</p></div>
              </div>
              <div className="flex flex-wrap gap-6">
                {record.observedChanges.map((change) => (
                  <div key={change.label} className="flex flex-col">
                    <span className="flex items-center gap-1 text-lg font-semibold tabular-nums">
                      <TrendingUp className="size-4 text-emerald-600" />
                      {change.delta > 0 ? "+" : ""}{change.delta}{change.unit}
                    </span>
                    <span className="text-xs text-muted-foreground">{change.label}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm"><span className="font-medium">Attribution limits: </span><span className="text-muted-foreground">{record.attributionLimitations}</span></p>
              {record.externalEvents.length > 0 && (
                <p className="text-sm"><span className="font-medium">External events: </span><span className="text-muted-foreground">{record.externalEvents.join(" ")}</span></p>
              )}
              <p className="text-sm"><span className="font-medium">Follow-up: </span><span className="text-muted-foreground">{record.followUpAction}</span></p>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

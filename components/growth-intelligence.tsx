import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { GrowthIntelligenceReport } from "@/lib/domain/types";

/**
 * Presentational Growth Intelligence surface: the six-pillar snapshot plus the
 * ranked cross-engine decisions, with honesty labels and SEO guardrails.
 * Renders only what the report carries — no computation, no invented data.
 */
export function GrowthIntelligenceView({ report }: { report: GrowthIntelligenceReport }) {
  return (
    <div className="space-y-8">
      <section
        aria-label="Growth intelligence pillars"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {report.pillars.map((pillar) => (
          <Card key={pillar.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{pillar.label}</CardTitle>
              <CardDescription>
                {pillar.signalCount} signal{pillar.signalCount === 1 ? "" : "s"}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {pillar.topSignalTitle ?? pillar.labels[0] ?? "—"}
            </CardContent>
          </Card>
        ))}
      </section>

      <section aria-label="Unified growth decisions" className="space-y-3">
        <h2 className="text-base font-semibold">Top growth decisions</h2>
        {report.decisions.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              No ranked decisions yet — this scan produced insufficient evidence to prioritise.
            </CardContent>
          </Card>
        ) : (
          report.decisions.map((decision) => (
            <Card key={decision.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-sm">{decision.title}</CardTitle>
                  <Badge variant="secondary">Priority {decision.priorityScore}</Badge>
                </div>
                <CardDescription>{decision.whyNow}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">Next: </span>
                  {decision.nextAction}
                </p>
                <p className="text-muted-foreground">{decision.measurement}</p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {decision.sourceSignals.map((source) => (
                    <Badge key={source} variant="outline">
                      {source}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <section
        aria-label="Method and limitations"
        className="space-y-1 border-t pt-4 text-xs text-muted-foreground"
      >
        {report.labels.map((label, index) => (
          <p key={`label-${index}`}>• {label}</p>
        ))}
        {report.guardrails.map((guardrail, index) => (
          <p key={`guardrail-${index}`}>◦ {guardrail}</p>
        ))}
      </section>
    </div>
  );
}

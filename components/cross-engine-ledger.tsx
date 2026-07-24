"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CrossEngineLedger, EngineCitationState } from "@/lib/engines/geo-cross-engine-ledger";
import type { EngineTargetPlan } from "@/lib/engines/geo-engine-targets";

const STATE_VARIANT: Record<EngineCitationState, "default" | "secondary" | "outline"> = {
  covered: "default",
  absent: "secondary",
  unmeasured: "outline",
};

const STATE_LABEL: Record<EngineCitationState, string> = {
  covered: "Cited",
  absent: "Absent",
  unmeasured: "Unmeasured",
};

export function CrossEngineLedgerView({
  report,
  targetPlan,
}: {
  report: CrossEngineLedger;
  targetPlan?: EngineTargetPlan;
}) {
  return (
    <div className="space-y-6">
      {targetPlan && targetPlan.targets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Where to focus</CardTitle>
            <CardDescription>{targetPlan.note}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {targetPlan.targets.map((t, i) => (
              <div key={t.engine} className="flex items-start gap-3 text-sm">
                <Badge variant={i === 0 ? "default" : "outline"} className="mt-0.5 capitalize">
                  {i === 0 ? "Focus" : `#${i + 1}`} · {t.engine}
                </Badge>
                <span className="text-muted-foreground">{t.rationale}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {report.enginesAbsent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">You are absent where AI answers</CardTitle>
            <CardDescription>
              Answered but never cited on: {report.enginesAbsent.join(", ")}.
              {report.enginesCovered.length > 0 && ` Cited on: ${report.enginesCovered.join(", ")}.`}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {report.engines.map((e) => (
          <Card key={e.engine}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base capitalize">{e.engine}</CardTitle>
                <div className="flex gap-2">
                  <Badge variant={STATE_VARIANT[e.state]}>{STATE_LABEL[e.state]}</Badge>
                  <Badge variant="outline">{e.measurement}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                Citation share: {Math.round(e.citedShare * 100)}%{" "}
                <span className="text-muted-foreground">
                  (n={e.sampleSize}
                  {e.reliable ? "" : ", directional"})
                </span>
              </p>
              {e.topCompetitors.length > 0 && (
                <p className="text-muted-foreground">
                  Cited instead: {e.topCompetitors.map((c) => `${c.domain} (${c.count})`).join(", ")}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {report.competitorUnion.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Who beats you across engines</CardTitle>
            <CardDescription>Cross-engine share of voice: {Math.round(report.overallCitedShare * 100)}% yours.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {report.competitorUnion.map((c) => (
              <Badge key={c.domain} variant="secondary">
                {c.domain} · {c.totalCount} · {c.engines.join("/")}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

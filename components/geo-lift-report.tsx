"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LiftReport } from "@/lib/engines/geo-lift-report";

const LABEL_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  causal: "default",
  directional: "secondary",
  insufficient: "outline",
};

export function GeoLiftReportView({ report }: { report: LiftReport }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{report.headline}</p>
      {report.rows.map((row) => (
        <Card key={row.fixId}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">{row.fixId}</CardTitle>
              <Badge variant={LABEL_VARIANT[row.label]}>{row.label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              Citation share: {Math.round(row.baselineShare * 100)}% → {Math.round(row.postShare * 100)}%{" "}
              <span className={row.deltaShare > 0 ? "text-emerald-600" : "text-muted-foreground"}>
                ({row.deltaShare > 0 ? "+" : ""}
                {Math.round(row.deltaShare * 100)} pts)
              </span>
            </p>
            {row.postInterval && (
              <p className="text-muted-foreground">
                Post 95% CI: {row.postInterval.low}–{row.postInterval.high}%
              </p>
            )}
            <p className="text-muted-foreground">{row.note}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

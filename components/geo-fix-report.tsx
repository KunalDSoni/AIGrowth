"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FixShipControls } from "@/components/fix-ship-controls";
import type { GeoFixReport } from "@/lib/engines/geo-fix-report";

const BAND_LABEL: Record<string, string> = { high: "High", moderate: "Moderate", low: "Low" };

export function GeoFixReportView({ report }: { report: GeoFixReport }) {
  const { coverage } = report;
  return (
    <div className="space-y-6">
      {/* Diagnosis */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Prompts cited" value={coverage.cited} />
        <Stat label="Named, not cited" value={coverage.mentionedNotCited} />
        <Stat label="Absent" value={coverage.absent} />
        <Stat label="Sample (answered)" value={report.sampleSize} />
      </div>

      {!report.reliable && (
        <p className="text-sm text-muted-foreground">
          Small sample (n={report.sampleSize}) — treat these signals as directional, not stable rankings.
        </p>
      )}

      {report.competitorsBeatingYou.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Who gets cited instead</CardTitle>
            <CardDescription>Domains cited across the prompts where {report.brand} was absent.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {report.competitorsBeatingYou.map((c) => (
              <Badge key={c.domain} variant="secondary">
                {c.domain} · {c.count}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Fixes */}
      {report.fixesAvailable ? (
        report.fixes.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Recommended citation fixes</h2>
            {report.fixes.map((fix) => (
              <Card key={fix.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">{fix.title}</CardTitle>
                    <div className="flex gap-2">
                      <Badge>Lift: {BAND_LABEL[fix.expectedLiftBand]}</Badge>
                      <Badge variant="outline">Effort: {fix.effort}</Badge>
                      <Badge variant="outline">{fix.confidence} confidence</Badge>
                    </div>
                  </div>
                  <CardDescription>{fix.whatToCreate}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>
                    <span className="font-medium">Why it earns citations: </span>
                    {fix.whyItEarnsCitations}
                  </p>
                  <p className="text-muted-foreground">
                    Affects {fix.affectedPrompts.length} prompt(s) · competitor share{" "}
                    {Math.round(fix.competitorShare * 100)}%
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                    {fix.assumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                  <FixShipControls domain={report.domain} fix={fix} />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{report.note}</p>
        )
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fixes need a live crawl</CardTitle>
            <CardDescription>{report.note}</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

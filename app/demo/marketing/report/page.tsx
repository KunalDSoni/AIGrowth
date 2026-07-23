"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { KpiStatCard } from "@/components/marketing/kpi-stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveAnalyze } from "@/lib/client/live-project";
import type { MarketingOSSnapshot } from "@/lib/marketing/types";

export default function MarketingReportPage() {
  const { result, ready } = useLiveAnalyze();
  const [os, setOs] = useState<MarketingOSSnapshot | null>(null);

  useEffect(() => {
    if (!ready) return;
    void fetch("/api/marketing/os", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domain: result?.project.domain, useDemo: !result }),
    })
      .then((r) => r.json())
      .then((d) => setOs(d.os ?? null));
  }, [ready, result?.project.domain]);

  if (!ready) return null;

  return (
    <>
      <PageHeader
        title="SEO + GEO Position Report"
        description="Client-ready position, impact, and Fix → Publish → Promote → Measure improvisation."
        action={
          <Button asChild variant="outline">
            <Link href="/demo/marketing">Back to Marketing OS</Link>
          </Button>
        }
      />

      {os && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {os.report.kpis.map((kpi) => (
              <KpiStatCard key={kpi.id} label={kpi.label} value={kpi.value} hint={kpi.hint} />
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {os.report.scoreboard.labels.map((l) => (
              <Badge key={l} variant="outline">
                {l}
              </Badge>
            ))}
            <Badge variant="secondary">pressure: {os.report.scoreboard.competitorPressure}</Badge>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {os.report.chapters.map((ch) => (
              <Card key={ch.id}>
                <CardHeader>
                  <CardTitle className="text-base">{ch.title}</CardTitle>
                  <CardDescription>{ch.body}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {ch.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Improvisation plan</CardTitle>
              <CardDescription>Ordered steps agencies can deliver this month</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {os.report.improvisation.map((step) => (
                <div key={step.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{step.bucket}</Badge>
                    <Badge variant="secondary">{step.effortHours}h</Badge>
                    {step.packType ? <Badge>{step.packType}</Badge> : null}
                  </div>
                  <p className="mt-2 font-medium">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>GEO depth (Phase 3)</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium">Why not cited</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {os.geoDepth.whyNotCited.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Answer gaps</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {os.geoDepth.answerGaps.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}

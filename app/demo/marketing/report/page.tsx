"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { KpiStatCard } from "@/components/marketing/kpi-stat-card";
import { ReportSuitePanel } from "@/components/reports/report-suite-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveAnalyze } from "@/lib/client/live-project";
import type { MarketingWorkspace } from "@/lib/marketing/workspace";

export default function MarketingReportPage() {
  const { result, ready } = useLiveAnalyze();
  const [ws, setWs] = useState<MarketingWorkspace | null>(null);

  useEffect(() => {
    if (!ready) return;
    const domain = result?.project.domain;
    if (!domain) return;
    void fetch(`/api/marketing/workspace?domain=${encodeURIComponent(domain)}`)
      .then(async (r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((d) => {
        if (d?.workspace) setWs(d.workspace);
      });
  }, [ready, result?.project.domain]);

  if (!ready) return null;

  return (
    <>
      <PageHeader
        title="Position Report desk"
        description="Persisted SEO+GEO position + improvisation. Open the HTML artifact for client delivery."
        action={
          <div className="flex gap-2">
            {ws?.reportHtmlUrl ? (
              <Button asChild>
                <a href={ws.reportHtmlUrl} target="_blank" rel="noreferrer">
                  Open HTML report
                </a>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href="/demo/marketing">Back</Link>
            </Button>
          </div>
        }
      />

      {result?.project.domain ? <ReportSuitePanel domain={result.project.domain} /> : null}

      {!ws && (
        <Card>
          <CardHeader>
            <CardTitle>No report yet</CardTitle>
            <CardDescription>Generate a workspace on the Marketing OS page.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/demo/marketing">Generate</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {ws && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {ws.report.kpis.map((kpi) => (
              <KpiStatCard key={kpi.id} label={kpi.label} value={kpi.value} hint={kpi.hint} />
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {ws.report.chapters.map((ch) => (
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
              <CardTitle>Improvisation — Fix / Publish / Promote / Measure</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ws.report.improvisation.map((step) => (
                <div key={step.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap gap-2">
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
              <CardTitle>GEO depth</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {ws.geoDepth.whyNotCited.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {ws.geoDepth.answerGaps.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}

"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MeasurementBadge } from "@/components/measurement-badge";
import type { IngestionReport } from "@/lib/engines/ingestion-report";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function IngestionReportView({ report }: { report: IngestionReport }) {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Crawl &amp; corpus</CardTitle>
            <CardDescription>Multi-page frontier crawl, persisted and indexed for retrieval.</CardDescription>
          </div>
          <MeasurementBadge measurement={report.crawl.measurement} source={report.crawl.source} />
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Pages scanned" value={report.crawl.data.pagesScanned} />
          <Stat label="Docs indexed" value={report.crawl.data.indexedDocs} />
          <Stat label="Retrieval verdict" value={report.retrieval.verdict} />
          <Stat label="Changes vs last" value={report.changes ? `${report.changes.added.length}+ / ${report.changes.removed.length}-` : "first run"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Full-site audit</CardTitle>
            <CardDescription>Technical issues aggregated across every crawled page.</CardDescription>
          </div>
          <MeasurementBadge measurement={report.audit.measurement} source={report.audit.source} />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Total issues" value={report.audit.data.issueCount} />
            <Stat label="Critical" value={report.audit.data.critical} />
            <Stat label="High" value={report.audit.data.high} />
          </div>
          <ul className="space-y-1 text-sm">
            {report.audit.data.topIssues.map((issue) => (
              <li key={issue.id} className="flex items-center gap-2">
                <Badge variant={issue.severity === "critical" ? "destructive" : "outline"}>{issue.severity}</Badge>
                <span>{issue.title}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>AI visibility (GEO)</CardTitle>
              <CardDescription>Measured citation presence across answer-engine prompts.</CardDescription>
            </div>
            <MeasurementBadge measurement={report.geo.measurement} source={report.geo.source} />
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            <Stat label="Prompts" value={report.geo.data.sampleSize} />
            <Stat label="Brand mention" value={pct(report.geo.data.brandMentionRate)} />
            <Stat label="Cited" value={pct(report.geo.data.citationPresenceRate)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Core Web Vitals</CardTitle>
              <CardDescription>Performance signal normalised into audit issues.</CardDescription>
            </div>
            <MeasurementBadge measurement={report.performance.measurement} source={report.performance.source} />
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            <Stat label="Score" value={report.performance.data.performanceScore} />
            <Stat label="LCP" value={report.performance.data.lcpMs ? `${Math.round(report.performance.data.lcpMs)}ms` : "—"} />
            <Stat label="CLS" value={report.performance.data.cls ?? "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>SERP snapshot</CardTitle>
              <CardDescription>Positions used to verify answer-engine citations.</CardDescription>
            </div>
            <MeasurementBadge measurement={report.serp.measurement} source={report.serp.source} />
          </CardHeader>
          <CardContent>
            <ol className="space-y-1 text-sm">
              {report.serp.data.results.slice(0, 5).map((r) => (
                <li key={r.rank} className="flex gap-2">
                  <span className="text-muted-foreground tabular-nums">{r.rank}.</span>
                  <span className="truncate">{r.title}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Authority</CardTitle>
              <CardDescription>Backlink / authority proxy from open data.</CardDescription>
            </div>
            <MeasurementBadge measurement={report.authority.measurement} source={report.authority.source} />
          </CardHeader>
          <CardContent className="space-y-2">
            <Stat label="Authority score" value={report.authority.data.score ?? "—"} />
            {report.authority.data.note && <p className="text-xs text-muted-foreground">{report.authority.data.note}</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>AI-crawler parity</CardTitle>
            <CardDescription>Content visible to humans vs an AI crawler (GPTBot).</CardDescription>
          </div>
          {"skipped" in report.parity ? (
            <Badge variant="outline">skipped</Badge>
          ) : (
            <MeasurementBadge measurement={report.parity.measurement} source={report.parity.source} />
          )}
        </CardHeader>
        <CardContent>
          {"skipped" in report.parity ? (
            <p className="text-sm text-muted-foreground">{report.parity.reason}</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Words hidden" value={report.parity.data.wordCountDelta} />
              <Stat label="Links hidden" value={report.parity.data.linksHiddenFromBot} />
              <Stat label="Blocked" value={report.parity.data.blocked ? "yes" : "no"} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="mb-2 text-sm font-medium">Honesty guardrails</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {report.guardrails.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

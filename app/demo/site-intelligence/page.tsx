"use client";

import { EmptyLiveState } from "@/components/empty-live-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveAnalyze } from "@/lib/client/live-project";

export default function SiteIntelligencePage() {
  const { result, ready, hasLive } = useLiveAnalyze();
  if (!ready) return null;
  if (!hasLive || !result) {
    return <EmptyLiveState title="No live site inventory yet" />;
  }

  return (
    <>
      <PageHeader
        title={`Site intelligence · ${result.project.brandGuess}`}
        description={`Pages discovered and scored from the live crawl of ${result.project.domain}.`}
        action={<Badge variant="secondary">{result.seo.site.pagesScanned} pages</Badge>}
      />

      <div className="grid gap-3">
        {result.seo.pages.map((page) => (
          <Card key={page.finalUrl}>
            <CardHeader>
              <div className="flex flex-wrap gap-2">
                {page.ok ? (
                  <Badge variant="outline">{page.metrics.score}/100</Badge>
                ) : (
                  <Badge variant="outline" className="text-red-700">Failed</Badge>
                )}
                <Badge variant="secondary">{page.metrics.band}</Badge>
              </div>
              <CardTitle className="text-base break-all">{page.title ?? page.finalUrl}</CardTitle>
              <CardDescription className="break-all">{page.finalUrl}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {!page.ok && <p>{page.error}</p>}
              {page.ok && (
                <p>
                  {page.issues.length} issue{page.issues.length === 1 ? "" : "s"} · {page.metrics.critical} critical ·{" "}
                  {page.metrics.high} high
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

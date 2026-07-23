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

  const inventory = result.intelligence?.siteInventory;
  const access = result.intelligence?.aiAccess ?? [];

  return (
    <>
      <PageHeader
        title={`Site intelligence · ${result.project.brandGuess}`}
        description={`Classified inventory + AI crawler access from the live crawl of ${result.project.domain}.`}
        action={<Badge variant="secondary">{result.seo.site.pagesScanned} pages</Badge>}
      />

      {inventory && (
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(inventory.countsByPurpose)
            .filter(([, n]) => n > 0)
            .map(([purpose, count]) => (
              <Card key={purpose}>
                <CardHeader>
                  <CardDescription>{purpose}</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">{count}</CardTitle>
                </CardHeader>
              </Card>
            ))}
        </div>
      )}

      {inventory && inventory.coverageGaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Service coverage gaps</CardTitle>
            <CardDescription>Declared/inferred services without matching pages</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {inventory.coverageGaps.map((g) => (
              <p key={g.service}>
                <Badge variant="outline" className="mr-2">{g.service}</Badge>
                {g.reason}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {access.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI / crawler access (TSEO-002)</CardTitle>
            <CardDescription>robots.txt and page directives — access ≠ citation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {access.map((f) => (
              <div key={f.id} className="border-b border-border pb-3 last:border-0">
                <div className="mb-1 flex flex-wrap gap-2">
                  <Badge variant="outline">{f.severity}</Badge>
                  <span className="text-sm font-medium">{f.title}</span>
                </div>
                <p className="text-sm text-muted-foreground">{f.detail}</p>
                <p className="mt-1 text-xs text-muted-foreground">Caveat: {f.caveat}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {(inventory?.pages ?? []).map((page) => (
          <Card key={page.url}>
            <CardHeader>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{page.purpose}</Badge>
                <Badge variant="outline">{page.confidence}% conf.</Badge>
                {page.overridden && <Badge>Override</Badge>}
              </div>
              <CardTitle className="text-base break-all">{page.url}</CardTitle>
              <CardDescription>{page.signals.join(" · ")}</CardDescription>
            </CardHeader>
          </Card>
        ))}
        {!inventory &&
          result.seo.pages.map((page) => (
            <Card key={page.finalUrl}>
              <CardHeader>
                <CardTitle className="text-base break-all">{page.title ?? page.finalUrl}</CardTitle>
                <CardDescription>{page.ok ? `${page.metrics.score}/100` : page.error}</CardDescription>
              </CardHeader>
            </Card>
          ))}
      </div>
    </>
  );
}

"use client";

import { EmptyLiveState } from "@/components/empty-live-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveAnalyze } from "@/lib/client/live-project";

export default function AuditPage() {
  const { result, ready, hasLive } = useLiveAnalyze();
  if (!ready) return null;
  if (!hasLive || !result) {
    return <EmptyLiveState title="No live audit yet" />;
  }

  const issues = [
    ...result.seo.siteIssues,
    ...result.seo.pages.filter((p) => p.ok).flatMap((p) => p.issues),
  ];

  return (
    <>
      <PageHeader
        title={`Audit · ${result.project.brandGuess}`}
        description={`Live crawl of ${result.project.domain}. Issues below come only from scanned pages.`}
        action={<Badge variant="secondary">{result.seo.site.score}/100 readiness</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{result.project.domain}</CardTitle>
          <CardDescription>
            {result.seo.site.pagesScanned} pages · {result.seo.site.totalIssues} issues · scanned{" "}
            {new Date(result.seo.scannedAt).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-xl bg-primary text-2xl font-bold text-primary-foreground">
            {result.seo.site.score}
          </div>
          <div className="text-sm">
            <p className="font-medium">Growth readiness · {result.seo.site.band}</p>
            <p className="text-muted-foreground">
              {result.seo.site.critical} critical · {result.seo.site.high} high · {result.seo.site.quickWins} quick wins
            </p>
          </div>
        </CardContent>
      </Card>

      {(result.intelligence?.aiAccess?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI crawler access</CardTitle>
            <CardDescription>From robots.txt / page directives — not a citation guarantee</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {result.intelligence!.aiAccess.map((f) => (
              <p key={f.id}>
                <Badge variant="outline" className="mr-2">{f.severity}</Badge>
                {f.title}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {issues.length === 0 && (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">No audit issues found on this run.</CardContent>
          </Card>
        )}
        {issues.map((issue, index) => (
          <Card key={`${issue.id}-${index}`}>
            <CardHeader>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{issue.severity}</Badge>
                <Badge variant="secondary">{issue.impactArea}</Badge>
              </div>
              <CardTitle className="text-base">{issue.title}</CardTitle>
              <CardDescription>{issue.description}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm">
              <span className="font-medium">Recommended action: </span>
              {issue.recommendedAction}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

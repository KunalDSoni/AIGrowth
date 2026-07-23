"use client";

import { EmptyLiveState } from "@/components/empty-live-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveAnalyze } from "@/lib/client/live-project";

export default function OpportunitiesPage() {
  const { result, ready, hasLive } = useLiveAnalyze();
  if (!ready) return null;
  if (!hasLive || !result) {
    return <EmptyLiveState title="No live opportunities yet" />;
  }

  return (
    <>
      <PageHeader
        title={`Next actions · ${result.project.brandGuess}`}
        description="Ranked from your live SEO crawl and Gemini GEO probes."
        action={<Badge variant="secondary">{result.nextActions.length} actions</Badge>}
      />

      <div className="grid gap-3">
        {result.nextActions.length === 0 && (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">No prioritized actions from this run.</CardContent>
          </Card>
        )}
        {result.nextActions.map((action) => (
          <Card key={action.id}>
            <CardHeader>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">#{action.rank}</Badge>
                <Badge variant="outline">{action.source}</Badge>
                <Badge variant="outline">{action.bucket}</Badge>
              </div>
              <CardTitle className="text-base">{action.title}</CardTitle>
              <CardDescription>{action.action}</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Priority {action.priorityScore}/100 · Evidence: {action.evidenceIds.join(", ")}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

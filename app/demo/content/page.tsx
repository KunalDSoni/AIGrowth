"use client";

import { EmptyLiveState } from "@/components/empty-live-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveAnalyze } from "@/lib/client/live-project";

export default function ContentPage() {
  const { result, ready, hasLive } = useLiveAnalyze();
  if (!ready) return null;
  if (!hasLive || !result) {
    return <EmptyLiveState title="No live content opportunities yet" />;
  }

  const contentActions = result.nextActions.filter(
    (a) => a.source === "ai-visibility" || a.source === "citation" || a.source === "content" || a.source === "technical",
  );

  return (
    <>
      <PageHeader
        title={`Content planner · ${result.project.brandGuess}`}
        description="Actions from your live analyze that imply content or on-page work. No invented topics."
        action={<Badge variant="secondary">{contentActions.length} items</Badge>}
      />

      <div className="grid gap-3">
        {contentActions.length === 0 && (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">No content-related actions in the latest run.</CardContent>
          </Card>
        )}
        {contentActions.map((action) => (
          <Card key={action.id}>
            <CardHeader>
              <Badge variant="outline" className="w-fit">{action.source}</Badge>
              <CardTitle className="text-base">{action.title}</CardTitle>
              <CardDescription>{action.action}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </>
  );
}

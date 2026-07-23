"use client";

import { EmptyLiveState } from "@/components/empty-live-state";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { useLiveAnalyze } from "@/lib/client/live-project";

export default function OutcomesPage() {
  const { result, ready, hasLive } = useLiveAnalyze();
  if (!ready) return null;
  if (!hasLive || !result) {
    return <EmptyLiveState title="No outcome data yet" description="Outcomes require before/after measurement after you implement actions. Analyze a site first, then re-analyze later to compare." />;
  }

  return (
    <>
      <PageHeader
        title="Outcomes"
        description="No measured before/after window yet for this project. Re-run analyze after implementing Next actions to start learning."
      />
      <Card>
        <CardContent className="space-y-2 py-6 text-sm text-muted-foreground">
          <p>Latest baseline available:</p>
          <p>
            <span className="font-medium text-foreground">{result.project.domain}</span> · readiness{" "}
            {result.seo.site.score}/100 · brand mention {result.geo.brandMentionRate}% ·{" "}
            {new Date(result.analyzedAt).toLocaleString()}
          </p>
        </CardContent>
      </Card>
    </>
  );
}

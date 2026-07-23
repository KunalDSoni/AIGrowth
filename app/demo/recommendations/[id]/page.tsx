"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { EmptyLiveState } from "@/components/empty-live-state";
import { EvidenceDrawer } from "@/components/evidence-drawer";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveAnalyze } from "@/lib/client/live-project";

export default function RecommendationDetailPage() {
  const params = useParams<{ id: string }>();
  const { result, ready, hasLive } = useLiveAnalyze();

  if (!ready) return null;
  if (!hasLive || !result) {
    return (
      <EmptyLiveState
        title="No live recommendation"
        description="Analyze a site first, then open a Next action from the dashboard or opportunities."
      />
    );
  }

  const id = decodeURIComponent(params.id);
  const action = result.nextActions.find((a) => a.id === id);

  if (!action) {
    return (
      <EmptyLiveState
        title="Action not in latest run"
        description={`No next action with id "${id}". Re-analyze or pick another action.`}
      />
    );
  }

  const components = Object.entries(action.scoreComponents);

  return (
    <>
      <PageHeader
        title={action.title}
        description={action.action}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/demo/dashboard">Back to dashboard</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge>#{action.rank}</Badge>
        <Badge variant="outline">{action.source}</Badge>
        <Badge variant="secondary">{action.bucket}</Badge>
        <Badge variant="outline">Priority {action.priorityScore}/100</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Why this ranks here (REC-002)</CardTitle>
          <CardDescription>{action.explanation}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {components.map(([key, value]) => (
            <div key={key} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span className="text-muted-foreground">{key}</span>
              <span className="font-medium tabular-nums">{value}</span>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm sm:col-span-2">
            <span className="text-muted-foreground">impact × feasibility</span>
            <span className="font-medium tabular-nums">
              {action.impactScore} × {action.feasibilityScore}
            </span>
          </div>
        </CardContent>
      </Card>

      <EvidenceDrawer evidence={result.evidence} evidenceIds={action.evidenceIds} title="Evidence chain" />
    </>
  );
}

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

  const search = result.intelligence?.searchOpportunities ?? [];
  const clusters = result.intelligence?.topicClusters ?? [];

  return (
    <>
      <PageHeader
        title={`Opportunities · ${result.project.brandGuess}`}
        description="Ranked Next actions plus crawl-derived search topics (not Search Console)."
        action={<Badge variant="secondary">{result.nextActions.length} actions</Badge>}
      />

      {(result.intelligence?.labels ?? []).map((line) => (
        <p key={line} className="text-sm text-muted-foreground">{line}</p>
      ))}

      <div className="grid gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Next actions</h2>
        {result.nextActions.map((action) => (
          <Card key={action.id}>
            <CardHeader>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">#{action.rank}</Badge>
                <Badge variant="outline">{action.source}</Badge>
                <Badge variant="outline">{action.bucket}</Badge>
              </div>
              <CardTitle className="text-base">
                <a className="hover:underline" href={`/demo/recommendations/${encodeURIComponent(action.id)}`}>
                  {action.title}
                </a>
              </CardTitle>
              <CardDescription>{action.action}</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Priority {action.priorityScore}/100 · Evidence: {action.evidenceIds.join(", ")}
            </CardContent>
          </Card>
        ))}
      </div>

      {search.length > 0 && (
        <div className="grid gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Search / prompt demand (crawl-derived)
          </h2>
          {search.slice(0, 10).map((opp) => (
            <Card key={opp.id}>
              <CardHeader>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{opp.intent}</Badge>
                  <Badge variant="outline">{opp.funnelStage}</Badge>
                  {opp.labels.map((l) => (
                    <Badge key={l} variant="secondary">{l}</Badge>
                  ))}
                </div>
                <CardTitle className="text-base">{opp.query}</CardTitle>
                <CardDescription>
                  Service: {opp.service} · demand proxy {opp.demandProxy}/100 · relevance {opp.businessRelevance}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {clusters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Topic clusters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {clusters.map((c) => (
              <p key={c.id}>
                <Badge variant="outline" className="mr-2">{c.label}</Badge>
                {c.members.join(" · ")}
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}

"use client";

import { EmptyLiveState } from "@/components/empty-live-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveAnalyze } from "@/lib/client/live-project";

export default function CompetitorsPage() {
  const { result, ready, hasLive } = useLiveAnalyze();
  if (!ready) return null;
  if (!hasLive || !result) {
    return <EmptyLiveState title="No competitor evidence yet" />;
  }

  const citations = result.intelligence?.citations;
  const competitors = result.intelligence?.competitors ?? [];
  const gaps = result.intelligence?.competitorGaps ?? [];

  return (
    <>
      <PageHeader
        title={`Competitors · ${result.project.brandGuess}`}
        description="Citation competitors from live Gemini answers — not a full market crawl."
        action={<Badge variant="secondary">{competitors.length} domains</Badge>}
      />

      {citations && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>First-party citation share</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{citations.firstPartyShare}%</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Competitor share</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{citations.competitorShare}%</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Third-party share</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{citations.thirdPartyShare}%</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {gaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Competitor gaps</CardTitle>
            <CardDescription>Only shown when sample size supports the conclusion</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {gaps.map((g) => (
              <div key={g.id}>
                <Badge variant="outline" className="mr-2">{g.gapType}</Badge>
                <span className="text-sm">{g.detail}</span>
                <p className="text-xs text-muted-foreground">Confidence: {g.confidence} · n={g.sampleSize}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {(citations?.byDomain ?? []).map((d) => (
          <Card key={d.domain}>
            <CardHeader>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{d.classification}</Badge>
                <Badge variant="secondary">×{d.count}</Badge>
              </div>
              <CardTitle className="text-base">{d.domain}</CardTitle>
              <CardDescription>{d.pages.slice(0, 4).join(", ")}</CardDescription>
            </CardHeader>
          </Card>
        ))}
        {competitors.length === 0 && (!citations || citations.byDomain.length === 0) && (
          <Card className="md:col-span-2">
            <CardContent className="py-6 text-sm text-muted-foreground">
              No third-party domains were cited in this GEO run.
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

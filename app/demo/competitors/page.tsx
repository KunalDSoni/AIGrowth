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

  const cited = new Map<string, number>();
  for (const obs of result.geo.observations) {
    for (const c of obs.citations) {
      if (c.classification === "other") cited.set(c.domain, (cited.get(c.domain) ?? 0) + 1);
    }
  }
  const domains = [...cited.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <>
      <PageHeader
        title={`Citation competitors · ${result.project.brandGuess}`}
        description="Domains cited in live Gemini answers instead of (or alongside) your site. Not a full competitor crawl."
        action={<Badge variant="secondary">{domains.length} cited domains</Badge>}
      />

      {domains.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No third-party domains were cited in this GEO run.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {domains.map(([domain, count]) => (
            <Card key={domain}>
              <CardHeader>
                <CardTitle className="text-base">{domain}</CardTitle>
                <CardDescription>Cited in {count} observation{count === 1 ? "" : "s"}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

"use client";

import { EmptyLiveState } from "@/components/empty-live-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveAnalyze } from "@/lib/client/live-project";

export default function AIVisibilityPage() {
  const { result, ready, hasLive } = useLiveAnalyze();
  if (!ready) return null;
  if (!hasLive || !result) {
    return <EmptyLiveState title="No live GEO observations yet" />;
  }

  const { geo, project } = result;

  return (
    <>
      <PageHeader
        title={`AI visibility · ${project.brandGuess}`}
        description="Live Gemini probes for this project. Directional samples only — not a ranking."
        action={<Badge variant="secondary">{geo.sampleSize} probes · {geo.model}</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Brand mention rate</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{geo.brandMentionRate}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>First-party citation share</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{geo.firstPartyCitationShare}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Sample size</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{geo.sampleSize}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {result.guardrails.map((line) => (
        <p key={line} className="text-sm text-muted-foreground">{line}</p>
      ))}

      <div className="grid gap-3">
        {geo.observations.map((obs, index) => (
          <Card key={`${obs.id}-${index}`}>
            <CardHeader>
              <div className="flex flex-wrap gap-2">
                <Badge variant={obs.brandMentioned ? "default" : "outline"}>
                  {obs.brandMentioned ? "Brand mentioned" : "No brand mention"}
                </Badge>
                {obs.error && <Badge variant="outline" className="text-red-700">Failed</Badge>}
              </div>
              <CardTitle className="text-base">{obs.prompt}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {obs.error ? <p>{obs.error}</p> : <p className="whitespace-pre-wrap">{obs.rawResponse}</p>}
              {obs.citations.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {obs.citations.map((c) => (
                    <Badge key={c.url} variant="outline">{c.domain} · {c.classification}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { EmptyLiveState } from "@/components/empty-live-state";
import { OutcomeDeltaPanel } from "@/components/outcome-delta-panel";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveAnalyze } from "@/lib/client/live-project";
import type { AnalyzeDelta } from "@/lib/engines/analyze-delta";

export default function OutcomesPage() {
  const { result, ready, hasLive } = useLiveAnalyze();
  const [delta, setDelta] = useState<AnalyzeDelta | null>(null);

  useEffect(() => {
    if (!result?.project.domain) return;
    if (result.delta) {
      setDelta(result.delta);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/analyze?domain=${encodeURIComponent(result.project.domain)}&delta=1`);
        if (!response.ok) return;
        const json = (await response.json()) as { delta?: AnalyzeDelta };
        if (!cancelled && json.delta) setDelta(json.delta);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [result]);

  if (!ready) return null;
  if (!hasLive || !result) {
    return (
      <EmptyLiveState
        title="No outcome data yet"
        description="Analyze a site, ship fixes, then re-analyze the same domain. Outcomes compare two live runs — never simulated demos."
      />
    );
  }

  return (
    <>
      <PageHeader
        title={`Outcomes · ${result.project.brandGuess}`}
        description="Directional learning from consecutive live analyzes on this domain."
        action={<Badge variant="secondary">{result.project.domain}</Badge>}
      />

      {delta ? (
        <OutcomeDeltaPanel delta={delta} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Waiting for a second run</CardTitle>
            <CardDescription>
              Latest baseline: readiness {result.seo.site.score}/100 · brand mention {result.geo.brandMentionRate}% ·{" "}
              {new Date(result.analyzedAt).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Re-run <span className="font-medium text-foreground">Analyze</span> on {result.project.domain} after implementing
            Next actions. We&apos;ll show SEO/GEO deltas with attribution limits — not fake before/after stories.
          </CardContent>
        </Card>
      )}
    </>
  );
}

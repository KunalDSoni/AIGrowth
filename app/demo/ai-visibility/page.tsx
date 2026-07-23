"use client";

import { useState } from "react";
import { EmptyLiveState } from "@/components/empty-live-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { writeLiveAnalyze, useLiveAnalyze } from "@/lib/client/live-project";
import type { AnalyzeResult } from "@/lib/analyze/types";

export default function AIVisibilityPage() {
  const { result, ready, hasLive, setResult } = useLiveAnalyze();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready) return null;
  if (!hasLive || !result) {
    return <EmptyLiveState title="No live GEO observations yet" />;
  }

  const { geo, project } = result;
  const variants = result.intelligence?.promptVariants ?? [];

  async function reprobe(useVariants: boolean) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/geo-reprobe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: result!.project.domain, useVariants, maxPrompts: 6 }),
      });
      const data = (await response.json()) as AnalyzeResult & { error?: string };
      if (!response.ok || !data.geo) {
        setError(data.error ?? "Re-probe failed");
        setLoading(false);
        return;
      }
      setResult(data);
      writeLiveAnalyze(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-probe failed");
    }
    setLoading(false);
  }

  return (
    <>
      <PageHeader
        title={`AI visibility · ${project.brandGuess}`}
        description="Live Gemini probes. Re-probe to refresh samples or expand with prompt-family variants."
        action={<Badge variant="secondary">{geo.sampleSize} probes · {geo.model}</Badge>}
      />

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={loading} onClick={() => reprobe(false)}>
          {loading ? "Running…" : "Re-probe GEO"}
        </Button>
        <Button type="button" disabled={loading || variants.length === 0} onClick={() => reprobe(true)}>
          Re-probe with variants
        </Button>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>

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

      {variants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prompt family variants (AIV-001/002)</CardTitle>
            <CardDescription>Controlled geography / persona / stage / wording variants</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            {variants.slice(0, 8).map((v) => (
              <p key={v.id}>
                <Badge variant="outline" className="mr-2">{v.dimension}</Badge>
                {v.text}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {geo.observations.map((obs, index) => (
          <Card key={`${obs.id}-${index}`}>
            <CardHeader>
              <div className="flex flex-wrap gap-2">
                <Badge variant={obs.brandMentioned ? "default" : "outline"}>
                  {obs.brandMentioned ? "Brand mentioned" : "No brand mention"}
                </Badge>
                {obs.error && (
                  <Badge variant="outline" className="text-red-700">
                    Failed
                  </Badge>
                )}
              </div>
              <CardTitle className="text-base">{obs.prompt}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {obs.error ? <p>{obs.error}</p> : <p className="whitespace-pre-wrap">{obs.rawResponse}</p>}
              {obs.citations.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {obs.citations.map((c) => (
                    <Badge key={c.url} variant="outline">
                      {c.domain} · {c.classification}
                    </Badge>
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

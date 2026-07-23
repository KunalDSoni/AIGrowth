"use client";

import { useEffect, useState } from "react";
import { EmptyLiveState } from "@/components/empty-live-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { writeLiveAnalyze, useLiveAnalyze } from "@/lib/client/live-project";
import type { AnalyzeResult } from "@/lib/analyze/types";
import type { CompetitorComparison } from "@/lib/engines/competitor-crawl";
import type { CompetitorType } from "@/lib/engines/competitor-intelligence";

const TYPES: CompetitorType[] = ["business", "organic", "local", "ai-answer", "citation"];

export default function CompetitorsPage() {
  const { result, ready, hasLive, setResult } = useLiveAnalyze();
  const [busy, setBusy] = useState(false);
  const [crawlBusy, setCrawlBusy] = useState(false);
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [comparisons, setComparisons] = useState<CompetitorComparison[]>([]);

  useEffect(() => {
    if (!result?.project.domain) return;
    let cancelled = false;
    fetch(`/api/competitors?domain=${encodeURIComponent(result.project.domain)}`)
      .then((r) => r.json())
      .then((data: { comparisons?: CompetitorComparison[] }) => {
        if (!cancelled) setComparisons(data.comparisons ?? []);
      })
      .catch(() => {
        if (!cancelled) setComparisons([]);
      });
    return () => {
      cancelled = true;
    };
  }, [result?.project.domain]);

  if (!ready) return null;
  if (!hasLive || !result) {
    return <EmptyLiveState title="No competitor evidence yet" />;
  }

  const citations = result.intelligence?.citations;
  const competitors = result.intelligence?.competitors ?? [];
  const gaps = result.intelligence?.competitorGaps ?? [];
  const citationGaps = result.intelligence?.citationGaps ?? [];

  async function correct(name: string, type: CompetitorType) {
    setBusy(true);
    try {
      const response = await fetch("/api/business", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          domain: result!.project.domain,
          competitorCorrection: { name, type, relevant: true },
        }),
      });
      const data = (await response.json()) as { intelligence?: AnalyzeResult["intelligence"] };
      if (data.intelligence) {
        const next = { ...result!, intelligence: data.intelligence };
        setResult(next);
        writeLiveAnalyze(next);
      }
    } finally {
      setBusy(false);
    }
  }

  async function crawlCompetitor() {
    setCrawlBusy(true);
    setCrawlError(null);
    try {
      const response = await fetch("/api/competitors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: result!.project.domain, competitorUrl }),
      });
      const data = (await response.json()) as {
        error?: string;
        comparisons?: CompetitorComparison[];
      };
      if (!response.ok) {
        setCrawlError(data.error ?? "Competitor crawl failed");
        return;
      }
      setComparisons(data.comparisons ?? []);
      setCompetitorUrl("");
    } catch {
      setCrawlError("Could not reach competitor crawl API");
    } finally {
      setCrawlBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={`Competitors · ${result.project.brandGuess}`}
        description="Citation competitors from live Gemini answers, plus optional safe homepage crawl comparison."
        action={<Badge variant="secondary">{competitors.length} domains</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Live competitor homepage crawl</CardTitle>
          <CardDescription>
            Safely crawl a public competitor URL and compare readiness, proof, CTA, and structured data against your last analyze.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={competitorUrl}
              onChange={(e) => setCompetitorUrl(e.target.value)}
              placeholder="https://competitor.example"
              disabled={crawlBusy}
            />
            <Button onClick={crawlCompetitor} disabled={crawlBusy || !competitorUrl.trim()}>
              {crawlBusy ? "Crawling…" : "Compare"}
            </Button>
          </div>
          {crawlError && <p className="text-sm text-destructive">{crawlError}</p>}
          {comparisons.length > 0 && (
            <div className="space-y-3">
              {comparisons.map((c) => (
                <div key={`${c.competitor.domain}-${c.competitor.crawledAt}`} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{c.competitor.domain}</span>
                    <Badge variant="outline">score {c.competitor.score}</Badge>
                    <Badge variant="secondary">you {c.ours.score}</Badge>
                    <Badge variant="outline">Δ {c.deltas.score}</Badge>
                  </div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {c.conclusions.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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

      {citationGaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Citation gaps → actions (CITE-002)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {citationGaps.map((g) => (
              <div key={g.id}>
                <Badge variant="outline" className="mr-2">{g.gapType}</Badge>
                <span className="text-sm font-medium">{g.title}</span>
                <p className="text-sm text-muted-foreground">{g.explanation}</p>
                <p className="text-xs text-muted-foreground">Confidence: {g.confidence}</p>
              </div>
            ))}
          </CardContent>
        </Card>
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
        {competitors.map((c) => (
          <Card key={c.name}>
            <CardHeader>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{c.type}</Badge>
                <Badge variant="secondary">{c.confidence}%</Badge>
              </div>
              <CardTitle className="text-base">{c.name}</CardTitle>
              <CardDescription>{c.source}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {TYPES.map((type) => (
                <Button
                  key={type}
                  size="sm"
                  variant={c.type === type ? "default" : "outline"}
                  disabled={busy}
                  onClick={() => correct(c.name, type)}
                >
                  {type}
                </Button>
              ))}
            </CardContent>
          </Card>
        ))}
        {(citations?.byDomain ?? [])
          .filter((d) => !competitors.some((c) => c.name === d.domain))
          .map((d) => (
            <Card key={d.domain}>
              <CardHeader>
                <Badge variant="outline">{d.classification}</Badge>
                <CardTitle className="text-base">{d.domain}</CardTitle>
                <CardDescription>Cited ×{d.count}</CardDescription>
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

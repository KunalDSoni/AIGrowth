"use client";

import { useEffect, useState } from "react";
import { Gauge, Layers, Loader2, Radar, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AnalyzeResult } from "@/lib/analyze/types";

const LAST_KEY = "opengrowth:analyze:last";

const sourceBadge: Record<string, string> = {
  technical: "SEO",
  "ai-visibility": "GEO",
  citation: "GEO",
  search: "Search",
  content: "Content",
  competitor: "Competitor",
  outcome: "Outcome",
};

export function ProjectAnalyze({ onLiveResult }: { onLiveResult?: (hasLive: boolean) => void }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as AnalyzeResult;
      if (parsed?.project?.domain && parsed?.seo?.site && parsed?.geo) {
        setResult(parsed);
        setUrl(parsed.project.url);
        onLiveResult?.(true);
      } else {
        localStorage.removeItem(LAST_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [onLiveResult]);

  async function runAnalyze(event: React.FormEvent) {
    event.preventDefault();
    if (!url.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim(), force: true }),
      });
      const data = (await response.json()) as AnalyzeResult & { error?: string; code?: string };
      // Only treat top-level API failures as errors (successful payloads can include per-probe error strings).
      if (!response.ok || typeof data.error === "string" || !data.project || !data.seo || !data.geo) {
        setError(typeof data.error === "string" ? data.error : "Analyze failed");
        setLoading(false);
        return;
      }
      setResult(data);
      onLiveResult?.(true);
      try {
        // Keep cache small — full Gemini answers can blow localStorage quota.
        const slim: AnalyzeResult = {
          ...data,
          geo: {
            ...data.geo,
            observations: data.geo.observations.map((obs) => ({
              ...obs,
              rawResponse: (obs.rawResponse ?? "").slice(0, 1200),
            })),
          },
        };
        localStorage.setItem(LAST_KEY, JSON.stringify(slim));
      } catch {
        // Analysis succeeded; cache is optional.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the analyzer. Please try again.");
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="size-4" /> Analyze site (SEO + GEO)
          </CardTitle>
          <CardDescription>
            Live multi-page crawl plus Gemini AI-visibility probes. Results become your Next actions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={runAnalyze} className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com"
              inputMode="url"
              autoComplete="url"
              className="sm:flex-1"
            />
            <Button type="submit" disabled={loading || !url.trim()}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {loading ? "Analyzing…" : "Analyze"}
            </Button>
          </form>
          {loading && (
            <p className="mt-3 text-sm text-muted-foreground">
              Crawling pages and running Gemini probes — typically 20–60s.
            </p>
          )}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Site readiness" value={`${result.seo.site.score}/100`} icon={Gauge} hint={result.seo.site.band} />
            <Kpi label="Pages scanned" value={String(result.seo.site.pagesScanned)} icon={Layers} hint={result.project.domain} />
            <Kpi
              label="Brand mention rate"
              value={`${result.geo.brandMentionRate}%`}
              icon={Radar}
              hint={`${result.geo.sampleSize} Gemini probes · ${result.geo.model}`}
            />
            <Kpi label="Next actions" value={String(result.nextActions.length)} icon={Sparkles} hint="SEO + GEO ranked" />
          </div>

          {result.guardrails.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Guardrails</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                {result.guardrails.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Next actions</CardTitle>
              <CardDescription>
                Ranked for {result.project.brandGuess} · evidence-backed · decision-support only
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.nextActions.length === 0 && (
                <p className="text-sm text-muted-foreground">No prioritized actions yet — site looks clean on this thin pass.</p>
              )}
              {result.nextActions.map((action) => (
                <div key={action.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">#{action.rank}</Badge>
                    <Badge variant="outline">{sourceBadge[action.source] ?? action.source}</Badge>
                    <Badge variant="outline">{action.bucket}</Badge>
                    <span className="text-xs text-muted-foreground">{action.priorityScore}/100 priority</span>
                  </div>
                  <p className="mt-2 font-medium">{action.title}</p>
                  <p className="text-sm text-muted-foreground">{action.action}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{action.explanation}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Evidence: {action.evidenceIds.join(", ")}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
              GEO observations ({result.geo.observations.length}) — expand
            </summary>
            <div className="mt-3 grid gap-3">
              {result.geo.observations.map((obs) => (
                <Card key={obs.id}>
                  <CardHeader>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={obs.brandMentioned ? "default" : "outline"}>
                        {obs.brandMentioned ? "Brand mentioned" : "No brand mention"}
                      </Badge>
                      {obs.error && <Badge variant="outline" className="border-red-200 text-red-700">error</Badge>}
                    </div>
                    <CardTitle className="text-base">{obs.prompt}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    {obs.error ? <p>{obs.error}</p> : <p className="line-clamp-6 whitespace-pre-wrap">{obs.rawResponse}</p>}
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
          </details>

          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
              SEO top issues — expand
            </summary>
            <div className="mt-3 space-y-2">
              {result.seo.site.topIssues.map((issue) => (
                <div key={issue.ruleId} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <span>{issue.title}</span>
                  <Badge variant="secondary">{issue.count} pages</Badge>
                </div>
              ))}
              {result.seo.site.topIssues.length === 0 && (
                <p className="text-sm text-muted-foreground">No recurring SEO issues in this run.</p>
              )}
            </div>
          </details>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon: typeof Gauge }) {
  return (
    <Card className="gap-3 py-5">
      <CardHeader className="px-5">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl font-bold tabular-nums">{value}</CardTitle>
        <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </div>
      </CardHeader>
      {hint && <CardContent className="px-5 text-xs text-muted-foreground">{hint}</CardContent>}
    </Card>
  );
}

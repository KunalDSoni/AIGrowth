"use client";

import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Gauge, Globe, Loader2, ShieldAlert, Wrench, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Severity = "critical" | "high" | "quick-win" | "monitor" | "ignore";

interface Issue {
  id: string;
  ruleId: string;
  severity: Severity;
  title: string;
  description: string;
  recommendedAction: string;
  affectedPages: number;
  impactArea: string;
}

interface ScanResult {
  url: string;
  finalUrl: string;
  crawledAt: string;
  crawl: {
    title: string | null;
    description: string | null;
    statusCode: number;
    wordCount: number;
    headings: number;
    h1Count: number;
    images: number;
    imagesMissingAlt: number;
    internalLinks: number;
    externalLinks: number;
    hasViewport: boolean;
    hasStructuredData: boolean;
  };
  metrics: { score: number; band: string; total: number; critical: number; high: number; monitor: number; quickWins: number };
  issues: Issue[];
}

const LAST_KEY = "opengrowth:scan:last";
const HISTORY_KEY = "opengrowth:scan:history";

type HistoryEntry = { finalUrl: string; score: number; total: number; critical: number; quickWins: number; at: string };

function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as HistoryEntry[];
  } catch {
    return [];
  }
}

const severityMeta: Record<Severity, { label: string; className: string }> = {
  critical: { label: "Critical", className: "border-red-200 bg-red-50 text-red-700" },
  high: { label: "High", className: "border-amber-200 bg-amber-50 text-amber-700" },
  "quick-win": { label: "Quick win", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  monitor: { label: "Monitor", className: "border-blue-200 bg-blue-50 text-blue-700" },
  ignore: { label: "Ignore", className: "border-neutral-200 bg-neutral-50 text-neutral-600" },
};

function DeltaStat({
  label,
  value,
  Icon,
  previous,
  higherIsBetter,
  suffix,
}: {
  label: string;
  value: number;
  Icon: typeof Gauge;
  previous?: number;
  higherIsBetter: boolean;
  suffix?: string;
}) {
  const hasPrev = typeof previous === "number";
  const diff = hasPrev ? value - (previous as number) : 0;
  const improved = higherIsBetter ? diff > 0 : diff < 0;
  const worsened = higherIsBetter ? diff < 0 : diff > 0;
  return (
    <Card className="gap-3 py-5">
      <CardHeader className="px-5">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl font-bold tabular-nums">
          {value}
          {suffix && <span className="text-base font-medium text-muted-foreground">{suffix}</span>}
        </CardTitle>
        <CardAction>
          <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 px-5">
        {hasPrev ? (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "gap-1",
                improved && "border-emerald-200 bg-emerald-50 text-emerald-700",
                worsened && "border-red-200 bg-red-50 text-red-700",
              )}
            >
              {diff >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {diff >= 0 ? "+" : ""}
              {diff}
            </Badge>
            <span className="text-xs text-muted-foreground">vs previous scan</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Baseline set — scan again to track change</span>
        )}
      </CardContent>
    </Card>
  );
}

export function SiteScan() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [previous, setPrevious] = useState<HistoryEntry | null>(null);

  useEffect(() => {
    try {
      const last = localStorage.getItem(LAST_KEY);
      if (last) {
        const parsed = JSON.parse(last) as ScanResult;
        setResult(parsed);
        setUrl(parsed.url);
        const prior = loadHistory().filter((h) => h.finalUrl === parsed.finalUrl && h.at !== parsed.crawledAt);
        setPrevious(prior.at(-1) ?? null);
      }
    } catch {
      /* ignore */
    }
  }, []);

  async function runScan(event: React.FormEvent) {
    event.preventDefault();
    if (!url.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await response.json()) as ScanResult | { error: string };
      if ("error" in data) {
        setError(data.error);
        setLoading(false);
        return;
      }
      // Determine the previous scan for this site BEFORE recording the new one.
      const prior = loadHistory().filter((h) => h.finalUrl === data.finalUrl);
      setPrevious(prior.at(-1) ?? null);

      setResult(data);
      localStorage.setItem(LAST_KEY, JSON.stringify(data));
      const entry: HistoryEntry = {
        finalUrl: data.finalUrl,
        score: data.metrics.score,
        total: data.metrics.total,
        critical: data.metrics.critical,
        quickWins: data.metrics.quickWins,
        at: data.crawledAt,
      };
      localStorage.setItem(HISTORY_KEY, JSON.stringify([...loadHistory(), entry].slice(-50)));
    } catch {
      setError("Could not reach the scanner. Please try again.");
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="size-4" /> Scan a live website
          </CardTitle>
          <CardDescription>
            Real crawl + real SEO rule engine. No mock data — every number below is computed from the page we fetch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={runScan} className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com"
              inputMode="url"
              autoComplete="url"
              className="sm:flex-1"
            />
            <Button type="submit" disabled={loading || !url.trim()}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              {loading ? "Scanning…" : "Scan site"}
            </Button>
          </form>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DeltaStat label="Growth readiness" value={result.metrics.score} suffix="/100" Icon={Gauge} previous={previous?.score} higherIsBetter />
            <DeltaStat label="Issues found" value={result.metrics.total} Icon={Search} previous={previous?.total} higherIsBetter={false} />
            <DeltaStat label="Critical issues" value={result.metrics.critical} Icon={ShieldAlert} previous={previous?.critical} higherIsBetter={false} />
            <DeltaStat label="Quick fixes" value={result.metrics.quickWins} Icon={Wrench} previous={previous?.quickWins} higherIsBetter />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="size-4" /> {result.finalUrl}
              </CardTitle>
              <CardDescription>
                Fetched {new Date(result.crawledAt).toLocaleString()} · HTTP {result.crawl.statusCode} · readiness band: {result.metrics.band}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
              <Fact label="Title" value={result.crawl.title ? "present" : "missing"} bad={!result.crawl.title} />
              <Fact label="Meta description" value={result.crawl.description ? "present" : "missing"} bad={!result.crawl.description} />
              <Fact label="H1 tags" value={String(result.crawl.h1Count)} bad={result.crawl.h1Count !== 1} />
              <Fact label="Words" value={String(result.crawl.wordCount)} bad={result.crawl.wordCount < 300} />
              <Fact label="Headings" value={String(result.crawl.headings)} />
              <Fact label="Images" value={String(result.crawl.images)} />
              <Fact label="Images missing alt" value={String(result.crawl.imagesMissingAlt)} bad={result.crawl.imagesMissingAlt > 0} />
              <Fact label="Internal links" value={String(result.crawl.internalLinks)} />
              <Fact label="Viewport tag" value={result.crawl.hasViewport ? "yes" : "no"} bad={!result.crawl.hasViewport} />
              <Fact label="Structured data" value={result.crawl.hasStructuredData ? "yes" : "no"} bad={!result.crawl.hasStructuredData} />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">
              Findings <span className="text-muted-foreground">({result.issues.length})</span>
            </h2>
            {result.issues.length === 0 && (
              <Card>
                <CardContent className="py-6 text-sm text-muted-foreground">
                  No rule violations detected on this page. Try scanning a deeper page for more signal.
                </CardContent>
              </Card>
            )}
            {result.issues.map((issue) => {
              const meta = severityMeta[issue.severity] ?? severityMeta.monitor;
              return (
                <Card key={issue.id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={meta.className}>
                        {meta.label}
                      </Badge>
                      <Badge variant="secondary">{issue.impactArea}</Badge>
                      <span className="text-xs text-muted-foreground">rule: {issue.ruleId}</span>
                    </div>
                    <CardTitle className="text-base">{issue.title}</CardTitle>
                    <CardDescription>{issue.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <span className="font-medium">Recommended action: </span>
                    {issue.recommendedAction}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Fact({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("font-medium tabular-nums", bad && "text-red-600")}>{value}</span>
    </div>
  );
}

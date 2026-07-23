"use client";

import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, FileWarning, Gauge, Layers, Loader2, Search, ShieldAlert } from "lucide-react";
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
  impactArea: string;
}

interface PageResult {
  url: string;
  title: string | null;
  ok: boolean;
  error: string | null;
  score: number;
  band: string;
  critical: number;
  high: number;
  total: number;
  issues: Issue[];
}

interface SiteResult {
  url: string;
  finalUrl: string;
  origin: string;
  crawledAt: string;
  sitemapUrlCount: number;
  site: {
    score: number;
    band: string;
    pagesScanned: number;
    pagesFailed: number;
    totalIssues: number;
    critical: number;
    high: number;
    quickWins: number;
    worstPages: { url: string; title: string | null; score: number }[];
    topIssues: { ruleId: string; title: string; severity: Severity; count: number }[];
  };
  siteIssues: Issue[];
  pages: PageResult[];
}

const LAST_KEY = "opengrowth:scan:last";
const HISTORY_KEY = "opengrowth:scan:history";

type HistoryEntry = { origin: string; score: number; totalIssues: number; critical: number; at: string };

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

function scoreClass(score: number) {
  if (score >= 85) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (score >= 70) return "border-lime-200 bg-lime-50 text-lime-700";
  if (score >= 50) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
}

function DeltaStat({
  label,
  value,
  suffix,
  Icon,
  previous,
  higherIsBetter,
  hint,
}: {
  label: string;
  value: number;
  suffix?: string;
  Icon: typeof Gauge;
  previous?: number;
  higherIsBetter: boolean;
  hint?: string;
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
              className={cn("gap-1", improved && "border-emerald-200 bg-emerald-50 text-emerald-700", worsened && "border-red-200 bg-red-50 text-red-700")}
            >
              {diff >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {diff >= 0 ? "+" : ""}
              {diff}
            </Badge>
            <span className="text-xs text-muted-foreground">vs previous scan</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{hint ?? "Baseline set — scan again to track change"}</span>
        )}
      </CardContent>
    </Card>
  );
}

function IssueCard({ issue }: { issue: Issue }) {
  const meta = severityMeta[issue.severity] ?? severityMeta.monitor;
  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
        <Badge variant="secondary">{issue.impactArea}</Badge>
        <span className="text-xs text-muted-foreground">rule: {issue.ruleId}</span>
      </div>
      <p className="mt-2 font-medium">{issue.title}</p>
      <p className="text-sm text-muted-foreground">{issue.description}</p>
      <p className="mt-1 text-sm">
        <span className="font-medium">Fix: </span>
        {issue.recommendedAction}
      </p>
    </div>
  );
}

export function SiteScan() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SiteResult | null>(null);
  const [previous, setPrevious] = useState<HistoryEntry | null>(null);

  useEffect(() => {
    try {
      const last = localStorage.getItem(LAST_KEY);
      if (last) {
        const parsed = JSON.parse(last) as SiteResult;
        setResult(parsed);
        setUrl(parsed.url);
        const prior = loadHistory().filter((h) => h.origin === parsed.origin && h.at !== parsed.crawledAt);
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
      const data = (await response.json()) as SiteResult | { error: string };
      if ("error" in data) {
        setError(data.error);
        setLoading(false);
        return;
      }
      const prior = loadHistory().filter((h) => h.origin === data.origin);
      setPrevious(prior.at(-1) ?? null);

      setResult(data);
      localStorage.setItem(LAST_KEY, JSON.stringify(data));
      const entry: HistoryEntry = {
        origin: data.origin,
        score: data.site.score,
        totalIssues: data.site.totalIssues,
        critical: data.site.critical,
        at: data.crawledAt,
      };
      localStorage.setItem(HISTORY_KEY, JSON.stringify([...loadHistory(), entry].slice(-50)));
    } catch {
      setError("Could not reach the scanner. Please try again.");
    }
    setLoading(false);
  }

  const sortedPages = result ? [...result.pages].sort((a, b) => Number(a.ok) - Number(b.ok) || a.score - b.score) : [];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="size-4" /> Scan an entire website
          </CardTitle>
          <CardDescription>
            Real multi-page crawl: we read the sitemap, fetch every page (up to 20), and run the SEO rule engine on each. No mock data.
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
              {loading ? "Crawling site…" : "Scan site"}
            </Button>
          </form>
          {loading && <p className="mt-3 text-sm text-muted-foreground">Crawling pages from the sitemap — this can take 10–30s for larger sites.</p>}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DeltaStat label="Site readiness" value={result.site.score} suffix="/100" Icon={Gauge} previous={previous?.score} higherIsBetter />
            <DeltaStat
              label="Pages scanned"
              value={result.site.pagesScanned}
              Icon={Layers}
              higherIsBetter
              hint={`${result.sitemapUrlCount} URLs in sitemap${result.site.pagesFailed ? ` · ${result.site.pagesFailed} failed` : ""}`}
            />
            <DeltaStat label="Total issues" value={result.site.totalIssues} Icon={FileWarning} previous={previous?.totalIssues} higherIsBetter={false} />
            <DeltaStat label="Critical issues" value={result.site.critical} Icon={ShieldAlert} previous={previous?.critical} higherIsBetter={false} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{result.origin}</CardTitle>
              <CardDescription>
                Crawled {new Date(result.crawledAt).toLocaleString()} · {result.site.pagesScanned} pages · readiness band: {result.site.band}
              </CardDescription>
            </CardHeader>
            {result.siteIssues.length > 0 && (
              <CardContent className="flex flex-col gap-2">
                <span className="text-sm font-medium">Site-wide issues</span>
                {result.siteIssues.map((issue) => <IssueCard key={issue.id} issue={issue} />)}
              </CardContent>
            )}
          </Card>

          {result.site.topIssues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top issues across the site</CardTitle>
                <CardDescription>Most impactful recurring problems, ranked by severity × frequency.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {result.site.topIssues.map((topIssue) => {
                  const meta = severityMeta[topIssue.severity] ?? severityMeta.monitor;
                  return (
                    <div key={topIssue.ruleId} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                        <span className="text-sm">{topIssue.title.replace(/\s*\d+\s*characters?/i, "")}</span>
                      </div>
                      <Badge variant="secondary">{topIssue.count} {topIssue.count === 1 ? "page" : "pages"}</Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">
              Pages <span className="text-muted-foreground">({result.pages.length})</span>
            </h2>
            {sortedPages.map((page) => (
              <Card key={page.url}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    {page.ok ? (
                      <Badge variant="outline" className={scoreClass(page.score)}>{page.score}/100</Badge>
                    ) : (
                      <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">failed</Badge>
                    )}
                    {page.critical > 0 && <Badge variant="outline" className={severityMeta.critical.className}>{page.critical} critical</Badge>}
                    {page.high > 0 && <Badge variant="outline" className={severityMeta.high.className}>{page.high} high</Badge>}
                  </div>
                  <CardTitle className="text-base">{page.title ?? page.url}</CardTitle>
                  <CardDescription className="break-all">{page.url}</CardDescription>
                </CardHeader>
                <CardContent>
                  {!page.ok && <p className="text-sm text-red-600">Could not crawl: {page.error}</p>}
                  {page.ok && page.issues.length === 0 && <p className="text-sm text-muted-foreground">No issues found on this page.</p>}
                  {page.ok && page.issues.length > 0 && (
                    <details className="group">
                      <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                        {page.issues.length} finding{page.issues.length === 1 ? "" : "s"} — click to expand
                      </summary>
                      <div className="mt-3 flex flex-col gap-2">
                        {page.issues.map((issue, index) => <IssueCard key={`${issue.id}-${index}`} issue={issue} />)}
                      </div>
                    </details>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

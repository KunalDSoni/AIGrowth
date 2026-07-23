import { AlertTriangle, FileWarning, LayoutGrid, ShieldCheck } from "lucide-react";
import { aiAccessFindings, contentInventory, contentRefreshCandidates, siteInventory } from "@/lib/data/demo";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const severityClass: Record<string, string> = {
  critical: "border-rose-200 bg-rose-50 text-rose-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  notice: "border-slate-200 bg-slate-50 text-slate-700",
};

const statusClass: Record<string, string> = {
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-700",
  thin: "border-amber-200 bg-amber-50 text-amber-700",
  stale: "border-rose-200 bg-rose-50 text-rose-700",
  duplicate: "border-violet-200 bg-violet-50 text-violet-700",
  underperforming: "border-amber-200 bg-amber-50 text-amber-700",
};

export default function SiteIntelligencePage() {
  return (
    <>
      <PageHeader
        title="Inventory, crawler access & content health"
        description="How the site is structured, whether AI and search crawlers can reach it, and which pages need work."
        action={<Badge variant="secondary">Demo crawl · simulated</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><LayoutGrid className="size-4" /> Pages classified by purpose</CardTitle>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {Object.entries(siteInventory.countsByPurpose)
              .filter(([, count]) => count > 0)
              .map(([purpose, count]) => <Badge key={purpose} variant="outline">{purpose}: {count}</Badge>)}
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {siteInventory.pages.map((page) => (
            <div key={page.url} className="rounded-lg border p-3">
              <Badge variant="secondary">{page.purpose}</Badge>
              <p className="mt-2 font-medium break-all">{page.url}</p>
              <p className="text-xs text-muted-foreground">Confidence {page.confidence}% · {page.signals.join(", ")}</p>
            </div>
          ))}
        </CardContent>
        {siteInventory.coverageGaps.length > 0 && (
          <CardContent className="pt-0 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Coverage gaps: </span>
            {siteInventory.coverageGaps.map((gap) => gap.service).join(", ")}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="size-4" /> Can crawlers reach the content?</CardTitle>
          <CardDescription>AI &amp; search crawler access.</CardDescription>
        </CardHeader>
        <CardContent>
          {aiAccessFindings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No crawler-access issues detected in the simulated robots setup.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {aiAccessFindings.map((finding) => (
                <div key={finding.id} className="rounded-lg border p-3">
                  <Badge variant="outline" className={severityClass[finding.severity]}>{finding.severity}</Badge>
                  <p className="mt-2 font-medium">{finding.title}</p>
                  <p className="text-sm text-muted-foreground">{finding.detail}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><AlertTriangle className="size-3" /> {finding.caveat}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">{finding.affectedAgents.slice(0, 4).map((agent) => <Badge key={agent} variant="outline">{agent}</Badge>)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><FileWarning className="size-4" /> Which pages need attention</CardTitle>
          <CardDescription>Content health &amp; refresh.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contentInventory.map((item) => (
            <div key={item.url} className="rounded-lg border p-3">
              <Badge variant="outline" className={statusClass[item.status]}>{item.status}</Badge>
              <p className="mt-2 font-medium break-all">{item.url}</p>
              <p className="text-xs text-muted-foreground">Target: {item.targetQuery} · SEO value {item.seoValue} · {item.performanceSource}</p>
            </div>
          ))}
        </CardContent>
        {contentRefreshCandidates.length > 0 && (
          <CardContent className="space-y-1 pt-0">
            <h3 className="text-sm font-semibold">Prioritized refresh candidates</h3>
            {contentRefreshCandidates.map((candidate) => (
              <p key={candidate.url} className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{candidate.url}</span> (priority {candidate.priority}): {candidate.reasons.join(" ")}
              </p>
            ))}
          </CardContent>
        )}
      </Card>
    </>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { KpiStatCard } from "@/components/marketing/kpi-stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveAnalyze } from "@/lib/client/live-project";
import type { MarketingWorkspace } from "@/lib/marketing/workspace";

async function apiGenerate(domain: string) {
  const res = await fetch("/api/marketing/workspace", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ domain, hoursPerWeek: 8 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Generate failed");
  return data.workspace as MarketingWorkspace;
}

async function apiLoad(domain: string) {
  const res = await fetch(`/api/marketing/workspace?domain=${encodeURIComponent(domain)}`);
  const data = await res.json();
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(data.error ?? "Load failed");
  return data.workspace as MarketingWorkspace;
}

async function apiAction(body: Record<string, unknown>) {
  const res = await fetch("/api/marketing/workspace", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Action failed");
  return data.workspace as MarketingWorkspace;
}

export function MarketingOsDashboard() {
  const { result, ready } = useLiveAnalyze();
  const [ws, setWs] = useState<MarketingWorkspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const domain = result?.project.domain;

  const wsDomain = ws?.domain;

  const refresh = useCallback(async () => {
    const d = domain ?? wsDomain;
    if (!d) return;
    const loaded = await apiLoad(d);
    if (loaded) setWs(loaded);
  }, [domain, wsDomain]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      try {
        if (domain) {
          const loaded = await apiLoad(domain);
          if (!cancelled && loaded) setWs(loaded);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, domain]);

  async function generate() {
    if (!domain) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const workspace = await apiGenerate(domain);
      setWs(workspace);
      const chars = workspace.packs.reduce(
        (s, p) => s + p.assets.reduce((a, x) => a + x.body.length, 0),
        0,
      );
      setMessage(
        `Deep engine: ${workspace.brand} · ${workspace.siteFacts?.length ?? 0} site facts · ${workspace.packs.length} packs · ${chars.toLocaleString()} chars of drafts${workspace.geminiUsed ? " · Gemini hybrid" : " · deterministic"}. HTML report includes full pack bodies.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setBusy(false);
    }
  }

  async function approvePlan() {
    if (!ws) return;
    setBusy(true);
    try {
      const next = await apiAction({ action: "approve_plan", domain: ws.domain });
      setWs(next);
      setMessage("Plan approved. Pod unlocked for pack production.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;

  const approvedCount = ws?.packs.filter((p) => p.status === "approved" || p.status === "shipped").length ?? 0;

  return (
    <>
      <PageHeader
        title="Marketing OS"
        description="Live analyze → site facts → claim-checked campaign packs → persisted HTML Position Report. Approvals stick. Nothing is generated without a real scan."
        action={
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || !domain} onClick={() => generate()}>
              {busy ? "Working…" : "Generate from live site"}
            </Button>
            {ws ? (
              <Button disabled={busy} variant="outline" onClick={() => refresh()}>
                Reload saved
              </Button>
            ) : null}
          </div>
        }
      />

      {!domain && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No site analysed yet</CardTitle>
            <CardDescription>
              Run a scan on the Dashboard to populate this workspace. Nothing is shown until there is real data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/demo/dashboard">Go to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      {!ws && (
        <Card>
          <CardHeader>
            <CardTitle>No workspace yet</CardTitle>
            <CardDescription>Click Generate. This creates a persisted workspace under .data/marketing-workspaces and a printable HTML report.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {ws && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{ws.source}</Badge>
            <Badge variant="outline">{ws.domain}</Badge>
            <Badge variant={ws.approvals.planApproved ? "secondary" : "outline"}>
              plan {ws.approvals.planApproved ? "approved" : "pending"}
            </Badge>
            <Badge variant="outline">
              packs approved {approvedCount}/{ws.packs.length}
            </Badge>
            <Badge variant="outline">{ws.siteFacts?.length ?? 0} site facts</Badge>
            <Badge variant={ws.geminiUsed ? "secondary" : "outline"}>
              {ws.geminiUsed ? "Gemini hybrid" : "deterministic"}
            </Badge>
            <span className="text-xs text-muted-foreground">Updated {new Date(ws.updatedAt).toLocaleString()}</span>
          </div>

          {(ws.siteFacts?.length ?? 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Evidence trail</CardTitle>
                <CardDescription>Facts extracted from crawl + GEO — packs must stay inside these</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                  {ws.siteFacts.slice(0, 16).map((fact) => (
                    <li key={fact} className="truncate border-b border-border/60 py-1 last:border-0">
                      {fact}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {ws.report.kpis.map((kpi) => (
              <KpiStatCard key={kpi.id} label={kpi.label} value={kpi.value} hint={kpi.hint} previous={kpi.previous} />
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Channel mix</CardTitle>
                <CardDescription>Hours this week from ranked tactics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {ws.channelMix.map((c) => (
                  <div key={c.channel} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize">{c.channel}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {c.hours}h · {(c.pct * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(4, c.pct * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Approvals</CardTitle>
                <CardDescription>Human gates — agents do not publish</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full" disabled={busy || ws.approvals.planApproved} onClick={approvePlan}>
                  {ws.approvals.planApproved ? "Plan approved ✓" : "Approve 30/60/90 plan"}
                </Button>
                {ws.reportHtmlUrl ? (
                  <Button asChild variant="outline" className="w-full">
                    <a href={ws.reportHtmlUrl} target="_blank" rel="noreferrer">
                      Open Position Report HTML
                    </a>
                  </Button>
                ) : null}
                {ws.weeklyHtmlUrl ? (
                  <Button asChild variant="outline" className="w-full">
                    <a href={ws.weeklyHtmlUrl} target="_blank" rel="noreferrer">
                      Open Weekly Pack HTML
                    </a>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Report</CardTitle>
                <CardDescription>Improvisation + chapters</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/demo/marketing/report">Open report desk</Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Campaign packs</CardTitle>
                <CardDescription>{ws.packs.length} packs · approve each</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/demo/marketing/packs">Manage packs</Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Outreach</CardTitle>
                <CardDescription>{ws.outreach.length} targets</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/demo/marketing/outreach">Outreach desk</Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Agency / Pods</CardTitle>
                <CardDescription>{ws.pods[0]?.status ?? "—"}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/demo/marketing/agency">Open suite</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Agent activity (persisted)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {ws.agentLog.slice(0, 8).map((step, i) => (
                <div key={`${step.agent}-${step.at}-${i}`} className="flex justify-between gap-2 border-b py-2 text-sm last:border-0">
                  <div>
                    <p className="font-medium">{step.agent}</p>
                    <p className="text-muted-foreground">{step.summary}</p>
                  </div>
                  <Badge variant={step.status === "needs_approval" ? "outline" : "secondary"}>{step.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}

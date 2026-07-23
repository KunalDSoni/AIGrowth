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

async function apiGenerate(domain: string | undefined, useDemo: boolean) {
  const res = await fetch("/api/marketing/workspace", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ domain, useDemo, hoursPerWeek: 8 }),
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

  const refresh = useCallback(async () => {
    if (!domain && !ws?.domain) return;
    const d = domain ?? ws!.domain;
    const loaded = await apiLoad(d);
    if (loaded) setWs(loaded);
  }, [domain, ws?.domain]);

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

  async function generate(useDemo: boolean) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const workspace = await apiGenerate(useDemo ? undefined : domain, useDemo || !domain);
      setWs(workspace);
      setMessage(
        `Generated for ${workspace.brand}. Report HTML saved. ${workspace.packs.length} packs ready for approval.`,
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
        description="Generate a real Position Report + campaign packs from live analyze (or demo), approve the plan, open the HTML report."
        action={
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => generate(false)}>
              {busy ? "Working…" : domain ? "Generate from live site" : "Generate (needs analyze)"}
            </Button>
            <Button disabled={busy} variant="secondary" onClick={() => generate(true)}>
              Generate demo workspace
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
            <CardTitle className="text-base">No live analyze in this browser</CardTitle>
            <CardDescription>
              Run a site analyze on the Dashboard first for live evidence — or generate a demo workspace to test the full flow.
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
            <span className="text-xs text-muted-foreground">Updated {new Date(ws.updatedAt).toLocaleString()}</span>
          </div>

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

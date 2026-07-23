"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { KpiStatCard } from "@/components/marketing/kpi-stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveAnalyze } from "@/lib/client/live-project";
import type { MarketingOSSnapshot } from "@/lib/marketing/types";

const PHASES = [
  { n: 1, name: "Position + Packs" },
  { n: 2, name: "Distribution + Experiments" },
  { n: 3, name: "GEO + Agency" },
  { n: 4, name: "Truth + Ship" },
  { n: 5, name: "Marketing Pods" },
];

export function MarketingOsDashboard() {
  const { result, ready } = useLiveAnalyze();
  const [os, setOs] = useState<MarketingOSSnapshot | null>(null);
  const [source, setSource] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(forceDemo = false) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/marketing/os", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          domain: forceDemo ? undefined : result?.project.domain,
          useDemo: forceDemo || !result,
          hoursPerWeek: 8,
        }),
      });
      const data = (await res.json()) as { os?: MarketingOSSnapshot; source?: string; error?: string };
      if (!res.ok || !data.os) throw new Error(data.error ?? "Failed to load Marketing OS");
      setOs(data.os);
      setSource(data.source ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!ready) return;
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, result?.project.domain]);

  if (!ready) return null;

  return (
    <>
      <PageHeader
        title="Marketing OS"
        description="AI Agentic Marketing Operating System — Position Report, campaign packs, outreach, experiments, pods."
        action={
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Phases 1–5</Badge>
            {source ? <Badge variant="outline">{source}</Badge> : null}
            <Button size="sm" variant="outline" disabled={busy} onClick={() => load(false)}>
              Refresh
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => load(true)}>
              Demo snapshot
            </Button>
          </div>
        }
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {PHASES.map((p) => (
          <Card key={p.n} className="py-4">
            <CardHeader className="gap-1">
              <CardDescription>Phase {p.n}</CardDescription>
              <CardTitle className="text-base">{p.name}</CardTitle>
              <Badge variant="secondary" className="w-fit">
                Active
              </Badge>
            </CardHeader>
          </Card>
        ))}
      </div>

      {os && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {os.report.kpis.map((kpi) => (
              <KpiStatCard
                key={kpi.id}
                label={kpi.label}
                value={kpi.value}
                previous={kpi.previous}
                deltaPct={kpi.deltaPct}
                hint={kpi.hint}
              />
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Channel mix · 8h/week</CardTitle>
                <CardDescription>Effort allocation from ranked marketing tactics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {os.channelMix.map((c) => (
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
                <CardTitle>Agent crew</CardTitle>
                <CardDescription>Approval-gated orchestration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {os.agentLog.map((step) => (
                  <div key={step.agent} className="flex items-start justify-between gap-2 border-b border-border/60 py-2 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{step.agent}</p>
                      <p className="text-xs text-muted-foreground">{step.summary}</p>
                    </div>
                    <Badge variant={step.status === "needs_approval" ? "outline" : "secondary"}>{step.status}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Position Report</CardTitle>
                <CardDescription>{os.report.brand}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/demo/marketing/report">Open report</Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Campaign Packs</CardTitle>
                <CardDescription>{os.packs.length} drafts</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/demo/marketing/packs">Open packs</Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Outreach + Weekly</CardTitle>
                <CardDescription>
                  {os.outreach.length} targets · week {os.weekly.weekOf}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/demo/marketing/outreach">Phase 2 desk</Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Agency + Pods</CardTitle>
                <CardDescription>
                  {os.agencyClients.length} clients · {os.pods.length} pods
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/demo/marketing/agency">Phases 3–5</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>30 / 60 / 90 plan</CardTitle>
              <CardDescription>Improvisation roadmap from live (or demo) evidence</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {os.plan.map((m) => (
                <div key={m.window} className="rounded-lg border p-4">
                  <Badge variant="secondary" className="mb-2">
                    {m.window} days
                  </Badge>
                  <p className="font-medium">{m.title}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                    {m.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}

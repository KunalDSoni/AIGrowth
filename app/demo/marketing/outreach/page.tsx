"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveAnalyze } from "@/lib/client/live-project";
import type { MarketingOSSnapshot, OutreachTarget } from "@/lib/marketing/types";

export default function MarketingOutreachPage() {
  const { result, ready } = useLiveAnalyze();
  const [os, setOs] = useState<MarketingOSSnapshot | null>(null);
  const [targets, setTargets] = useState<OutreachTarget[]>([]);

  useEffect(() => {
    if (!ready) return;
    void fetch("/api/marketing/os", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domain: result?.project.domain, useDemo: !result }),
    })
      .then((r) => r.json())
      .then((d) => {
        setOs(d.os ?? null);
        setTargets(d.os?.outreach ?? []);
      });
  }, [ready, result?.project.domain]);

  async function advance(t: OutreachTarget) {
    const order = ["todo", "pitched", "follow-up", "won"] as const;
    const idx = order.indexOf(t.status as (typeof order)[number]);
    const next = order[Math.min(order.length - 1, idx + 1)] ?? "pitched";
    setTargets((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: next } : x)));
    await fetch("/api/marketing/state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "outreach",
        id: t.id,
        status: next,
        domain: os?.report.domain ?? "default",
      }),
    });
  }

  if (!ready) return null;

  return (
    <>
      <PageHeader
        title="Distribution desk"
        description="Phase 2 — Citation outreach CRM, weekly growth pack, experiment hooks, outcome learning."
        action={
          <Button asChild variant="outline">
            <Link href="/demo/marketing">Back</Link>
          </Button>
        }
      />

      {os && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Weekly Growth Pack</CardTitle>
              <CardDescription>{os.weekly.weekOf} · {os.weekly.positionDelta}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm font-medium">Summary</p>
                <p className="text-sm text-muted-foreground">{os.weekly.summary}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Wins</p>
                <ul className="list-disc pl-5 text-sm text-muted-foreground">
                  {os.weekly.wins.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-medium">Next</p>
                <ul className="list-disc pl-5 text-sm text-muted-foreground">
                  {os.weekly.nextActions.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Citation outreach CRM</CardTitle>
                <CardDescription>Approve-to-send copy only — no silent spam</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {targets.map((t) => (
                  <div key={t.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{t.class}</Badge>
                      <Badge variant="secondary">{t.status}</Badge>
                    </div>
                    <p className="mt-2 font-medium">{t.domain}</p>
                    <p className="text-sm text-muted-foreground">{t.why}</p>
                    {t.pitch && <p className="mt-2 text-xs text-muted-foreground">Pitch: {t.pitch}</p>}
                    <Button size="sm" className="mt-2" variant="outline" onClick={() => advance(t)}>
                      Advance status
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Learning + simulations</CardTitle>
                <CardDescription>Phase 2/5 — priors and directional lift bands</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {os.learning.map((l) => (
                  <div key={l.tacticId} className="flex items-center justify-between gap-2 border-b py-2 text-sm last:border-0">
                    <span>{l.tacticId}</span>
                    <Badge variant="secondary">{l.score}</Badge>
                  </div>
                ))}
                <div className="pt-2">
                  <p className="mb-2 text-sm font-medium">Simulations</p>
                  {os.simulations.slice(0, 4).map((s) => (
                    <p key={s.tacticId} className="text-sm text-muted-foreground">
                      {s.tacticId}: {s.expectedLeadLiftBand} ({s.confidence}) · {s.costHours}h
                    </p>
                  ))}
                </div>
                <Button asChild variant="secondary">
                  <Link href="/demo/bandit">Open CRO bandit</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  );
}

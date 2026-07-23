"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveAnalyze } from "@/lib/client/live-project";
import type { MarketingWorkspace } from "@/lib/marketing/workspace";
import type { OutreachTarget } from "@/lib/marketing/types";

const NEXT: Record<OutreachTarget["status"], OutreachTarget["status"]> = {
  todo: "pitched",
  pitched: "follow-up",
  "follow-up": "won",
  won: "won",
  lost: "lost",
};

export default function MarketingOutreachPage() {
  const { result, ready } = useLiveAnalyze();
  const [ws, setWs] = useState<MarketingWorkspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    const domain = result?.project.domain;
    if (!domain) return;
    void fetch(`/api/marketing/workspace?domain=${encodeURIComponent(domain)}`)
      .then((r) => (r.status === 404 ? null : r.json()))
      .then((d) => {
        if (d?.workspace) setWs(d.workspace);
      });
  }, [ready, result?.project.domain]);

  async function advance(t: OutreachTarget) {
    if (!ws) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/marketing/workspace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "outreach_status",
          domain: ws.domain,
          targetId: t.id,
          status: NEXT[t.status],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      setWs(data.workspace);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;

  return (
    <>
      <PageHeader
        title="Outreach + Weekly desk"
        description="Statuses persist. Weekly pack HTML is generated with the workspace."
        action={
          <Button asChild variant="outline">
            <Link href="/demo/marketing">Back</Link>
          </Button>
        }
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!ws && (
        <Card>
          <CardHeader>
            <CardTitle>No workspace</CardTitle>
            <CardDescription>Generate from Marketing OS first.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/demo/marketing">Generate</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {ws && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Weekly Growth Pack</CardTitle>
              <CardDescription>
                {ws.weekly.weekOf} · {ws.weekly.positionDelta}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{ws.weekly.summary}</p>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm font-medium">Wins</p>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground">
                    {ws.weekly.wins.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-medium">Risks</p>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground">
                    {ws.weekly.risks.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-medium">Next</p>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground">
                    {ws.weekly.nextActions.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>
              {ws.weeklyHtmlUrl ? (
                <Button asChild>
                  <a href={ws.weeklyHtmlUrl} target="_blank" rel="noreferrer">
                    Open weekly HTML
                  </a>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Citation outreach CRM</CardTitle>
                <CardDescription>Advance status — saved on server</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {ws.outreach.map((t) => (
                  <div key={t.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{t.class}</Badge>
                      <Badge variant="secondary">{t.status}</Badge>
                    </div>
                    <p className="mt-2 font-medium">{t.domain}</p>
                    <p className="text-sm text-muted-foreground">{t.why}</p>
                    {t.pitch && <p className="mt-2 text-xs text-muted-foreground">Pitch: {t.pitch}</p>}
                    <Button size="sm" className="mt-2" variant="outline" disabled={busy || t.status === "won"} onClick={() => advance(t)}>
                      Advance → {NEXT[t.status]}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Learning + simulations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {ws.learning.map((l) => (
                  <div key={l.tacticId} className="flex justify-between text-sm">
                    <span>{l.tacticId}</span>
                    <Badge variant="secondary">{l.score}</Badge>
                  </div>
                ))}
                <div className="pt-2">
                  {ws.simulations.slice(0, 5).map((s) => (
                    <p key={s.tacticId} className="text-sm text-muted-foreground">
                      {s.tacticId}: {s.expectedLeadLiftBand} ({s.confidence})
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

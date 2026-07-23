"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveAnalyze } from "@/lib/client/live-project";
import type { MarketingWorkspace } from "@/lib/marketing/workspace";

export default function MarketingAgencyPage() {
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

  async function approvePlan() {
    if (!ws) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/marketing/workspace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "approve_plan", domain: ws.domain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Approve failed");
      setWs(data.workspace);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;

  return (
    <>
      <PageHeader
        title="Agency suite & Pods"
        description="Approve plan to unlock pod status. Connectors show real config state."
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
              <CardTitle>Clients</CardTitle>
              <CardDescription>Command center</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {ws.agencyClients.map((c) => (
                <div key={c.id} className="rounded-lg border p-4">
                  <div className="flex justify-between">
                    <p className="font-medium">{c.name}</p>
                    <Badge variant="secondary">{c.score}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{c.domain}</p>
                  <Badge variant="outline" className="mt-2">
                    {c.stage}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Connectors</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {ws.connectors.map((c) => (
                  <div key={c.id} className="flex justify-between gap-2 border-b py-2 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{c.label}</p>
                      <p className="text-xs text-muted-foreground">{c.detail}</p>
                    </div>
                    <Badge variant="outline">{c.status}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Marketing Pods</CardTitle>
                <CardDescription>Approve plan to move pod out of awaiting-approval</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {ws.pods.map((pod) => (
                  <div key={pod.id} className="rounded-lg border p-3">
                    <Badge className="mb-2">{pod.status}</Badge>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {pod.loopNotes.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                <Button disabled={busy || ws.approvals.planApproved} onClick={approvePlan}>
                  {ws.approvals.planApproved ? "Plan already approved" : "Approve plan (unlock pod)"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  );
}

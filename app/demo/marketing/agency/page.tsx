"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveAnalyze } from "@/lib/client/live-project";
import type { MarketingOSSnapshot } from "@/lib/marketing/types";

export default function MarketingAgencyPage() {
  const { result, ready } = useLiveAnalyze();
  const [os, setOs] = useState<MarketingOSSnapshot | null>(null);

  useEffect(() => {
    if (!ready) return;
    void fetch("/api/marketing/os", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domain: result?.project.domain, useDemo: !result }),
    })
      .then((r) => r.json())
      .then((d) => setOs(d.os ?? null));
  }, [ready, result?.project.domain]);

  if (!ready) return null;

  return (
    <>
      <PageHeader
        title="Agency suite & Marketing Pods"
        description="Phases 3–5 — multi-client command center, connectors, autonomous pods under approval."
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
              <CardTitle>Multi-client command center</CardTitle>
              <CardDescription>White-label ready portfolio view</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {os.agencyClients.map((c) => (
                <div key={c.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
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
                <CardTitle>Connectors (Phase 4)</CardTitle>
                <CardDescription>Truth adapters + CMS ship-with-approval stubs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {os.connectors.map((c) => (
                  <div key={c.id} className="flex items-start justify-between gap-2 border-b py-2 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{c.label}</p>
                      <p className="text-xs text-muted-foreground">{c.detail}</p>
                    </div>
                    <Badge variant={c.status === "connected" ? "secondary" : "outline"}>{c.status}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Marketing Pods (Phase 5)</CardTitle>
                <CardDescription>Continuous loops — humans approve strategy & packs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {os.pods.map((pod) => (
                  <div key={pod.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge>{pod.status}</Badge>
                      <Badge variant="outline">{pod.id}</Badge>
                    </div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {pod.loopNotes.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Next loop: {pod.nextLoopAt ? new Date(pod.nextLoopAt).toLocaleString() : "—"}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Proposal generator</CardTitle>
              <CardDescription>90-day retainer scope from Position Report</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                Scope for <span className="font-medium text-foreground">{os.report.brand}</span>: deliver weekly
                Position diffs, 2 campaign packs/month, citation outreach, and CRO experiments on approved arms.
              </p>
              <p>Top improvisation commitments:</p>
              <ul className="list-disc pl-5">
                {os.report.improvisation.slice(0, 4).map((s) => (
                  <li key={s.id}>
                    {s.bucket}: {s.title} (~{s.effortHours}h)
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}

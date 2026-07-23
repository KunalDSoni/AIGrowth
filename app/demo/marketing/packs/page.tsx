"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveAnalyze } from "@/lib/client/live-project";
import type { CampaignPack, MarketingOSSnapshot } from "@/lib/marketing/types";

export default function MarketingPacksPage() {
  const { result, ready } = useLiveAnalyze();
  const [os, setOs] = useState<MarketingOSSnapshot | null>(null);
  const [packs, setPacks] = useState<CampaignPack[]>([]);

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
        setPacks(d.os?.packs ?? []);
      });
  }, [ready, result?.project.domain]);

  async function setStatus(pack: CampaignPack, status: CampaignPack["status"]) {
    setPacks((prev) => prev.map((p) => (p.id === pack.id ? { ...p, status } : p)));
    await fetch("/api/marketing/state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "pack",
        id: pack.id,
        status,
        domain: os?.report.domain ?? "default",
      }),
    });
  }

  if (!ready) return null;

  return (
    <>
      <PageHeader
        title="Campaign Packs"
        description="Evidence-grounded packs with claim checks. Approve before ship — never silent publish."
        action={
          <Button asChild variant="outline">
            <Link href="/demo/marketing">Back</Link>
          </Button>
        }
      />

      <div className="grid gap-4">
        {packs.map((pack) => (
          <Card key={pack.id}>
            <CardHeader>
              <div className="flex flex-wrap gap-2">
                <Badge>{pack.packType}</Badge>
                <Badge variant="outline">{pack.status}</Badge>
                <Badge variant="secondary">{pack.effortHours}h</Badge>
              </div>
              <CardTitle className="text-base">{pack.goal}</CardTitle>
              <CardDescription>{pack.measurementPlan}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pack.assets.map((asset) => (
                <div key={asset.title} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">
                    {asset.kind}: {asset.title}
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{asset.body}</pre>
                  {asset.claimChecks.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">Claims: {asset.claimChecks.join(" · ")}</p>
                  )}
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setStatus(pack, "review")}>
                  Send to review
                </Button>
                <Button size="sm" onClick={() => setStatus(pack, "approved")}>
                  Approve
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setStatus(pack, "shipped")}>
                  Mark shipped
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/demo/bandit">Open Experiment Studio</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

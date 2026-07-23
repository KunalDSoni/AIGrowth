"use client";

import Link from "next/link";
import { useState } from "react";
import { EmptyLiveState } from "@/components/empty-live-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveAnalyze } from "@/lib/client/live-project";
import type { Campaign } from "@/lib/engines/campaign";

export default function CommunityPage() {
  const { result, ready, hasLive } = useLiveAnalyze();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [handoff, setHandoff] = useState<{ status: string; reason?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!ready) return null;
  if (!hasLive || !result) {
    return (
      <EmptyLiveState
        title="No campaign yet"
        description="Analyze a site first. Campaigns are built from live Next actions — no demo playbooks."
      />
    );
  }

  const seed = campaign ?? result.intelligence?.campaign;

  async function sync(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch("/api/campaign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: result!.project.domain, ...body }),
      });
      const data = (await response.json()) as {
        campaign?: Campaign;
        handoff?: { status: string; reason?: string };
        error?: string;
      };
      if (data.campaign) setCampaign(data.campaign);
      if (data.handoff) setHandoff(data.handoff);
    } finally {
      setBusy(false);
    }
  }

  if (!seed) {
    return (
      <EmptyLiveState
        title="No orchestration campaign"
        description="Re-analyze to generate a campaign from Next actions."
      />
    );
  }

  return (
    <>
      <PageHeader
        title={`Campaign · ${seed.name}`}
        description="ORCH-001 orchestration from live Next actions. Approve gates before export."
        action={<Badge variant="secondary">{seed.tasks.length} tasks</Badge>}
      />

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => sync({ rebuild: true })}>
          Rebuild from Next actions
        </Button>
        <Button
          type="button"
          disabled={busy}
          onClick={() => sync({ export: true, baseUrl: result.project.url })}
        >
          Export handoff
        </Button>
        <Button asChild variant="outline">
          <Link href="/demo/dashboard">Dashboard</Link>
        </Button>
      </div>

      {handoff && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Export: {handoff.status}</CardTitle>
            <CardDescription>{handoff.reason ?? "Ready when gates and tasks are complete."}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Objective</CardTitle>
          <CardDescription>{seed.objective}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          UTM: source={seed.utm.source} · medium={seed.utm.medium} · campaign={seed.utm.campaign}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approval gates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {seed.gates.map((g) => (
              <div key={g.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{g.label}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{g.state}</Badge>
                  {g.state !== "approved" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => sync({ gateId: g.id, gateState: "approved" })}
                    >
                      Approve
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {seed.tasks.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <Badge variant="secondary" className="mr-2">{t.assetType}</Badge>
                  {t.title}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{t.status}</Badge>
                  {t.status !== "done" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => sync({ taskId: t.id, taskStatus: "done" })}
                    >
                      Mark done
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

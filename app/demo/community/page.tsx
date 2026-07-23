"use client";

import Link from "next/link";
import { EmptyLiveState } from "@/components/empty-live-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveAnalyze } from "@/lib/client/live-project";

export default function CommunityPage() {
  const { result, ready, hasLive } = useLiveAnalyze();
  if (!ready) return null;
  if (!hasLive || !result) {
    return (
      <EmptyLiveState
        title="No campaign yet"
        description="Analyze a site first. Campaigns are built from live Next actions — no demo playbooks."
      />
    );
  }

  const campaign = result.intelligence?.campaign;

  if (!campaign) {
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
        title={`Campaign · ${campaign.name}`}
        description="ORCH-001 mock orchestration from live Next actions. Nothing auto-publishes."
        action={<Badge variant="secondary">{campaign.tasks.length} tasks</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Objective</CardTitle>
          <CardDescription>{campaign.objective}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          UTM: source={campaign.utm.source} · medium={campaign.utm.medium} · campaign={campaign.utm.campaign}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approval gates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {campaign.gates.map((g) => (
              <div key={g.id} className="flex items-center justify-between text-sm">
                <span>{g.label}</span>
                <Badge variant="outline">{g.state}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {campaign.tasks.map((t) => (
              <div key={t.id} className="text-sm">
                <Badge variant="secondary" className="mr-2">{t.assetType}</Badge>
                {t.title}
                <span className="ml-2 text-xs text-muted-foreground">{t.status}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Button asChild variant="outline">
        <Link href="/demo/dashboard">Execute actions from Dashboard</Link>
      </Button>
    </>
  );
}

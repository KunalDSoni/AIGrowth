"use client";

import { EmptyLiveState } from "@/components/empty-live-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLiveAnalyze } from "@/lib/client/live-project";

export default function SettingsPage() {
  const { result, ready, hasLive } = useLiveAnalyze();
  if (!ready) return null;
  if (!hasLive || !result) {
    return <EmptyLiveState title="No project settings yet" description="Analyze a website first. Settings are filled from the live project — never from a fictional demo business." />;
  }

  return (
    <>
      <PageHeader
        title="Project settings"
        description="Values below come from your latest live analyze."
        action={<Badge variant="secondary">{result.project.domain}</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Business name
            <Input readOnly value={result.project.brandGuess} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Website
            <Input readOnly value={result.project.url} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Domain
            <Input readOnly value={result.project.domain} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Last analyzed
            <Input readOnly value={new Date(result.analyzedAt).toLocaleString()} />
          </label>
        </CardContent>
      </Card>
    </>
  );
}

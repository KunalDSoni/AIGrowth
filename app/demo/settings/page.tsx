"use client";

import { EmptyLiveState } from "@/components/empty-live-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLiveAnalyze } from "@/lib/client/live-project";

export default function SettingsPage() {
  const { result, ready, hasLive } = useLiveAnalyze();
  if (!ready) return null;
  if (!hasLive || !result) {
    return (
      <EmptyLiveState
        title="No project settings yet"
        description="Analyze a website first. Settings are filled from the live project — never from a fictional demo business."
      />
    );
  }

  const intel = result.intelligence;

  return (
    <>
      <PageHeader
        title="Project settings"
        description="Values below come from your latest live analyze and goal lock."
        action={<Badge variant="secondary">{result.project.domain}</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Business name
            <Input readOnly value={intel?.profile.name ?? result.project.brandGuess} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Website
            <Input readOnly value={result.project.url} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Primary goal focus
            <Input readOnly value={intel?.goals.primary ?? "leads"} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Last analyzed
            <Input readOnly value={new Date(result.analyzedAt).toLocaleString()} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Honesty labels</CardTitle>
          <CardDescription>What this project will and will not claim</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          {(intel?.labels ?? result.guardrails).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

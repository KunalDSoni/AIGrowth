"use client";

import { EmptyLiveState } from "@/components/empty-live-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveAnalyze } from "@/lib/client/live-project";

export default function BusinessGraphPage() {
  const { result, ready, hasLive } = useLiveAnalyze();
  if (!ready) return null;
  if (!hasLive || !result) {
    return <EmptyLiveState title="No live business profile yet" description="Analyze your website first. Brand and service signals are derived from the live crawl — we do not invent a demo business." />;
  }

  return (
    <>
      <PageHeader
        title={`Business signals · ${result.project.brandGuess}`}
        description="Observed from your live crawl (title, domain, pages). Confirm and edit deeper facts come in a later release."
        action={<Badge variant="secondary">{result.project.domain}</Badge>}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Brand</CardTitle>
            <CardDescription>Guessed from homepage title / hostname</CardDescription>
          </CardHeader>
          <CardContent className="text-lg font-semibold">{result.project.brandGuess}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Website</CardTitle>
            <CardDescription>Analyzed URL</CardDescription>
          </CardHeader>
          <CardContent className="break-all text-sm">{result.project.url}</CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Pages observed</CardTitle>
            <CardDescription>Live inventory used for SEO scoring</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {result.seo.pages.filter((p) => p.ok).map((page) => (
              <p key={page.finalUrl} className="break-all text-muted-foreground">
                {page.title ?? page.finalUrl}
              </p>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

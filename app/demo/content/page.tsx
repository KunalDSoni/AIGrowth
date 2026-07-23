"use client";

import { EmptyLiveState } from "@/components/empty-live-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveAnalyze } from "@/lib/client/live-project";

export default function ContentPage() {
  const { result, ready, hasLive } = useLiveAnalyze();
  if (!ready) return null;
  if (!hasLive || !result) {
    return <EmptyLiveState title="No live content opportunities yet" />;
  }

  const inventory = result.intelligence?.contentInventory ?? [];
  const contentActions = result.nextActions.filter(
    (a) => a.source === "ai-visibility" || a.source === "citation" || a.source === "content" || a.source === "search",
  );

  return (
    <>
      <PageHeader
        title={`Content planner · ${result.project.brandGuess}`}
        description="Inventory from live crawl signals. Performance metrics stay at zero until Search Console is connected."
        action={<Badge variant="secondary">{inventory.length} pages</Badge>}
      />

      <div className="grid gap-3">
        {inventory.map((item) => (
          <Card key={item.url}>
            <CardHeader>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{item.status}</Badge>
                <Badge variant="secondary">{item.purpose}</Badge>
                <Badge variant="outline">{item.wordCount} words</Badge>
              </div>
              <CardTitle className="text-base break-all">{item.url}</CardTitle>
              <CardDescription>
                Target: {item.targetQuery} · crawl quality proxy {item.seoValue}/100 · GSC: not connected
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Proof: {item.hasProof ? "yes" : "missing"} · Clear CTA: {item.hasClearCta ? "yes" : "missing"}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Content-related actions</h2>
        {contentActions.length === 0 && (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">No content-related actions in the latest run.</CardContent>
          </Card>
        )}
        {contentActions.map((action) => (
          <Card key={action.id}>
            <CardHeader>
              <Badge variant="outline" className="w-fit">{action.source}</Badge>
              <CardTitle className="text-base">{action.title}</CardTitle>
              <CardDescription>{action.action}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </>
  );
}

"use client";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { recommendations, unifiedGrowthDecisions } from "@/lib/data/demo";
import { RecommendationCard } from "./recommendation-card";
import { SiteScan } from "./site-scan";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function Dashboard() {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">What should I do next?</h1>
          <p className="text-muted-foreground">
            Scan your live website for real, evidence-backed findings — then act on the highest-impact fixes.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/demo/assistant">
            <Sparkles className="size-4" /> Ask your growth assistant
          </Link>
        </Button>
      </div>

      <SiteScan />

      <Separator />
      <div className="flex items-center gap-3">
        <Badge variant="outline">Sample data</Badge>
        <p className="text-sm text-muted-foreground">
          The sections below are an illustrative demo dataset (fictional &ldquo;Northstar Accounting&rdquo;) — not your site.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cross-engine decisions</CardTitle>
          <CardDescription>How multiple engines combine into a single prioritized action (sample).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {unifiedGrowthDecisions.slice(0, 3).map((decision) => (
            <div key={decision.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{decision.title}</span>
                <Badge variant="secondary">{decision.priorityScore}/100</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{decision.sourceSignals.join(", ")}</p>
              <p className="mt-2 text-sm">{decision.whyNow}</p>
              <p className="mt-2 text-xs text-muted-foreground">{decision.nextAction}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold">Example top actions</h2>
        <p className="text-sm text-muted-foreground">Ordered for the sample business&rsquo;s goal: qualified consultation leads.</p>
      </div>
      <div className="recommendation-list">
        {recommendations.map((item) => (
          <RecommendationCard item={item} key={item.id} />
        ))}
      </div>
    </>
  );
}

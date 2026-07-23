"use client";
import Link from "next/link";
import { ArrowLeft, Check, CircleCheck, Clock3, Gauge } from "lucide-react";
import type { Recommendation } from "@/lib/domain/types";
import { GenerationWorkspace } from "./generation-workspace";
import { EvidenceDrawer } from "./evidence-drawer";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics/client";
import { evidenceReferences } from "@/lib/data/demo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const scoreLabels: Array<[keyof Recommendation["scoreComponents"], string]> = [
  ["businessRelevance", "Business relevance"],
  ["conversionPotential", "Conversion potential"],
  ["discoveryOpportunity", "Discovery opportunity"],
  ["severity", "Severity"],
  ["evidenceConfidence", "Evidence confidence"],
  ["effort", "Effort"],
  ["risk", "Risk"],
  ["dependencyReadiness", "Dependency readiness"],
];

const severityClass: Record<string, string> = {
  critical: "border-rose-200 bg-rose-50 text-rose-700",
  high: "border-amber-200 bg-amber-50 text-amber-700",
  "quick-win": "border-emerald-200 bg-emerald-50 text-emerald-700",
  monitor: "border-blue-200 bg-blue-50 text-blue-700",
  ignore: "border-neutral-200 bg-neutral-50 text-neutral-600",
};

export function RecommendationDetail({ item }: { item: Recommendation }) {
  const [done, setDone] = useState(false);
  const evidence = evidenceReferences.filter((reference) => item.evidenceIds.includes(reference.id));

  useEffect(() => {
    setDone(localStorage.getItem(`opengrowth:done:${item.id}`) === "true");
    track("recommendation_viewed", { recommendation: item.id });
  }, [item.id]);

  const complete = () => {
    localStorage.setItem(`opengrowth:done:${item.id}`, "true");
    setDone(true);
    track("recommendation_completed", { recommendation: item.id });
  };

  return (
    <>
      <Link href="/demo/dashboard" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to priorities
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className={severityClass[item.severity]}>{item.severity}</Badge>
            <span>{item.category}</span>
            <span>Priority score {item.priorityScore}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{item.title}</h1>
          <p className="max-w-2xl text-muted-foreground">{item.explanation}</p>
        </div>
        <Button variant={done ? "outline" : "default"} onClick={complete} disabled={done}>
          {done ? <CircleCheck className="size-4" /> : <Check className="size-4" />} {done ? "Completed" : "Mark completed"}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardDescription>Recommended fix</CardDescription>
            <CardTitle className="text-base">{item.action}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{item.outcome}</CardContent>
        </Card>
        <Card>
          <CardContent className="flex justify-between gap-2">
            {[
              [Gauge, "Impact", item.impact],
              [Clock3, "Effort", item.effort],
              [Check, "Confidence", item.confidence],
            ].map(([Icon, label, value]) => {
              const I = Icon as typeof Gauge;
              return (
                <div key={label as string} className="flex flex-col items-center gap-1 text-center">
                  <I className="size-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{label as string}</span>
                  <span className="font-semibold capitalize">{value as string}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardDescription>Why this is prioritized</CardDescription>
              <CardTitle>Decision evidence</CardTitle>
            </div>
            <Badge variant="secondary">Transparent score</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{item.scoreExplanation}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {scoreLabels.map(([key, label]) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold tabular-nums">{item.scoreComponents[key]}/100</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${item.scoreComponents[key]}%` }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardDescription>Evidence provenance</CardDescription>
              <CardTitle>Sources behind the action</CardTitle>
            </div>
            <EvidenceDrawer evidence={evidence} affectedAssets={[item.assetType]} />
          </div>
        </CardHeader>
        <CardContent>
          {evidence.length ? (
            <div className="space-y-2">
              {evidence.map((reference) => (
                <div key={reference.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{reference.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      {reference.source} | {reference.kind.replaceAll("_", " ").toLowerCase()} | reliability {reference.reliability.toLowerCase()}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Badge variant="outline">{reference.isSimulated ? "Simulated" : "Observed"}</Badge>
                    <Badge variant="outline">{reference.isEstimated ? "Estimated" : "Direct"}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No evidence references are attached yet.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Assumptions", item.assumptions],
          ["Dependencies and risk", [`Risk: ${item.risk}`, ...item.dependencies]],
          ["Definition of done", item.completionCriteria],
        ].map(([title, values]) => (
          <Card key={title as string}>
            <CardHeader>
              <CardTitle className="text-base">{title as string}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              {(values as string[]).map((value) => <p key={value}>{value}</p>)}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardDescription>Measurement plan</CardDescription>
          <CardTitle>How to judge the outcome</CardTitle>
          <p className="text-sm text-muted-foreground">{item.measurementPlan.attributionLimits}</p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {[
            ["Baseline", item.measurementPlan.baseline],
            ["Implementation", item.measurementPlan.implementationEvent],
            ["Comparison window", item.measurementPlan.comparisonWindow],
            ["Leading indicators", item.measurementPlan.leadingIndicators.join(", ")],
            ["Success signals", item.measurementPlan.successSignals.join(", ")],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{label}</p>
              <p className="text-muted-foreground">{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Potential outcome</CardDescription>
          <CardTitle>What could change</CardTitle>
          <p className="text-sm text-muted-foreground">Sample projections based on demo assumptions. They are not guaranteed outcomes.</p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-8">
          {item.metrics.map((metric) => (
            <div key={metric.label} className="flex flex-col">
              <span className="text-2xl font-semibold tabular-nums">{metric.value}</span>
              <span className="text-xs text-muted-foreground">{metric.label}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <GenerationWorkspace item={item} />
    </>
  );
}

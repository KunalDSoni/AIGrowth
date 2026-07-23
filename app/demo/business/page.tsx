"use client";

import { useState } from "react";
import { EmptyLiveState } from "@/components/empty-live-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { writeLiveAnalyze, useLiveAnalyze } from "@/lib/client/live-project";
import type { GoalFocus } from "@/lib/engines/live-intelligence";
import type { AnalyzeResult } from "@/lib/analyze/types";

const GOAL_OPTIONS: { id: GoalFocus; label: string }[] = [
  { id: "leads", label: "Leads / conversions" },
  { id: "ai-visibility", label: "AI visibility (GEO)" },
  { id: "technical-health", label: "Technical SEO health" },
  { id: "authority", label: "Authority / citations" },
  { id: "local", label: "Local presence" },
];

export default function BusinessGraphPage() {
  const { result, ready, hasLive, setResult } = useLiveAnalyze();
  const [saving, setSaving] = useState(false);
  const [market, setMarket] = useState("");
  const [industry, setIndustry] = useState("");
  const [goal, setGoal] = useState("");
  const [primary, setPrimary] = useState<GoalFocus>("leads");
  const [message, setMessage] = useState<string | null>(null);

  if (!ready) return null;
  if (!hasLive || !result) {
    return (
      <EmptyLiveState
        title="No live business profile yet"
        description="Analyze your website first. Brand and service signals are derived from the live crawl — we do not invent a demo business."
      />
    );
  }

  const intel = result.intelligence!;

  async function saveProfile() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/business", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          domain: result!.project.domain,
          profile: {
            market: market || intel.profile.market,
            industry: industry || intel.profile.industry,
            goal: goal || intel.profile.goal,
            services: intel.profile.services,
          },
          goals: { primary, weights: { [primary]: 90, leads: primary === "leads" ? 90 : 60 } },
          rerank: true,
        }),
      });
      const data = (await response.json()) as {
        intelligence?: AnalyzeResult["intelligence"];
        nextActions?: AnalyzeResult["nextActions"];
        error?: string;
      };
      if (!response.ok) {
        setMessage(data.error ?? "Save failed");
        setSaving(false);
        return;
      }
      const next: AnalyzeResult = {
        ...result!,
        intelligence: data.intelligence ?? result!.intelligence,
        nextActions: data.nextActions ?? result!.nextActions,
      };
      setResult(next);
      writeLiveAnalyze(next);
      setMessage("Goals locked — Next actions re-ranked.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    }
    setSaving(false);
  }

  async function confirmEntity(entityId: string, action: "confirm" | "reject") {
    if (!result) return;
    const response = await fetch("/api/business", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        domain: result.project.domain,
        confirmation: { entityId, action },
      }),
    });
    const data = (await response.json()) as { intelligence?: AnalyzeResult["intelligence"] };
    if (data.intelligence) {
      const next: AnalyzeResult = { ...result, intelligence: data.intelligence };
      setResult(next);
      writeLiveAnalyze(next);
    }
  }

  return (
    <>
      <PageHeader
        title={`Business graph · ${result.project.brandGuess}`}
        description="Inferred from crawl + your confirmations. Confirmed facts outrank AI guesses in scoring."
        action={<Badge variant="secondary">{result.project.domain}</Badge>}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Brand</CardTitle>
            <CardDescription>From homepage title / hostname</CardDescription>
          </CardHeader>
          <CardContent className="text-lg font-semibold">{intel.profile.name}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Services (inferred)</CardTitle>
            <CardDescription>Confirm or edit below</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {intel.profile.services.map((s) => (
              <Badge key={s} variant="outline">{s}</Badge>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Goal lock (BIZ-010)</CardTitle>
          <CardDescription>Primary goal re-ranks Next actions across SEO, GEO, search, and content.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Market / geography
            <Input
              placeholder={intel.profile.market}
              value={market}
              onChange={(e) => setMarket(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Industry
            <Input
              placeholder={intel.profile.industry}
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
            Outcome goal
            <Input placeholder={intel.profile.goal} value={goal} onChange={(e) => setGoal(e.target.value)} />
          </label>
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            {GOAL_OPTIONS.map((opt) => (
              <Button
                key={opt.id}
                type="button"
                size="sm"
                variant={primary === opt.id ? "default" : "outline"}
                onClick={() => setPrimary(opt.id)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <div className="sm:col-span-2 flex items-center gap-3">
            <Button type="button" onClick={saveProfile} disabled={saving}>
              {saving ? "Saving…" : "Save & re-rank actions"}
            </Button>
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assumption review (BIZ-002)</CardTitle>
          <CardDescription>{intel.pendingReview.length} inferred facts awaiting confirmation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {intel.pendingReview.length === 0 && (
            <p className="text-sm text-muted-foreground">No pending inferences — or all have been reviewed.</p>
          )}
          {intel.pendingReview.slice(0, 12).map((entity) => (
            <div key={entity.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 last:border-0">
              <div>
                <Badge variant="outline" className="mr-2">{entity.type}</Badge>
                <span className="text-sm font-medium">{entity.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">confidence {entity.confidence}</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => confirmEntity(entity.id, "confirm")}>
                  Confirm
                </Button>
                <Button size="sm" variant="ghost" onClick={() => confirmEntity(entity.id, "reject")}>
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Entity graph</CardTitle>
          <CardDescription>
            {intel.graph.entities.length} entities · {intel.graph.relationships.length} relationships
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          {intel.graph.entities.slice(0, 40).map((e) => (
            <Badge key={e.id} variant={e.status === "confirmed" ? "default" : "secondary"}>
              {e.type}: {e.label} ({e.status})
            </Badge>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

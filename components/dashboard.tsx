"use client";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Gauge, Radar, Sparkles, Target, Zap } from "lucide-react";
import { aiVisibilitySummaries, promptOpportunities, recommendations, unifiedGrowthDecisions } from "@/lib/data/demo";
import { RecommendationCard } from "./recommendation-card";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

type Stat = { label: string; value: string; prev: string; current: number; previous: number; Icon: typeof Gauge; suffix?: string };

function pct(current: number, previous: number): number {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function StatCard({ stat }: { stat: Stat }) {
  const change = pct(stat.current, stat.previous);
  const up = change >= 0;
  return (
    <Card className="gap-3 py-5">
      <CardHeader className="px-5">
        <CardDescription>{stat.label}</CardDescription>
        <CardTitle className="text-3xl font-bold tabular-nums">
          {stat.value}
          {stat.suffix && <span className="text-base font-medium text-muted-foreground">{stat.suffix}</span>}
        </CardTitle>
        <CardAction>
          <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <stat.Icon className="size-4" />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 px-5">
        <span className="text-xs text-muted-foreground">{stat.prev} previous period</span>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("gap-1", up ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700")}>
            {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {up ? "+" : ""}{change}%
          </Badge>
          <span className="text-xs text-muted-foreground">vs last period</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const [completed, setCompleted] = useState(0);
  useEffect(() => setCompleted(recommendations.filter((r) => localStorage.getItem(`opengrowth:done:${r.id}`) === "true").length), []);

  const aiMention = Math.round(aiVisibilitySummaries.reduce((sum, s) => sum + s.brandMentionFrequency, 0) / Math.max(1, aiVisibilitySummaries.length));
  const quickWins = recommendations.filter((r) => r.severity === "quick-win").length;
  const opportunities = promptOpportunities.length;

  const stats: Stat[] = [
    { label: "Growth readiness", value: "72", suffix: "/100", prev: "64/100", current: 72, previous: 64, Icon: Gauge },
    { label: "Ranked opportunities", value: String(opportunities), prev: "18", current: opportunities, previous: 18, Icon: Target },
    { label: "AI mention rate", value: `${aiMention}%`, prev: `${Math.max(0, aiMention - 9)}%`, current: aiMention, previous: Math.max(1, aiMention - 9), Icon: Radar },
    { label: "Quick wins ready", value: String(quickWins), prev: "3", current: quickWins, previous: 3, Icon: Zap },
  ];

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Your growth workspace</span>
          <h1 className="serif">What should I do next?</h1>
          <p>Focus on these actions first. They balance business value, effort and confidence.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/demo/assistant"><Sparkles className="size-4" /> Ask your growth assistant</Link>
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => <StatCard key={stat.label} stat={stat} />)}
      </div>

      <div className="context-note">
        <div>
          <b>How priorities are calculated</b>
          <p>Impact score x feasibility score. Evidence confidence, effort, risk and dependencies adjust the business opportunity.</p>
        </div>
        <Link href="/demo/audit">See full audit →</Link>
      </div>

      <section className="surface unified-engine">
        <span className="eyebrow">Unified intelligence engine</span>
        <h2>Cross-engine decisions</h2>
        <div>
          {unifiedGrowthDecisions.slice(0, 3).map((decision) => (
            <article key={decision.id}>
              <b>{decision.title}</b>
              <span>Priority {decision.priorityScore}/100 · {decision.sourceSignals.join(", ")}</span>
              <p>{decision.whyNow}</p>
              <small>{decision.nextAction}</small>
            </article>
          ))}
        </div>
        <p className="fine">Guardrails: no ranking guarantees, no keyword stuffing, no special AI-schema claims, and no low-value page generation.</p>
      </section>

      <div className="list-head">
        <div>
          <h2>Your top five actions</h2>
          <p className="muted">Ordered for Northstar&rsquo;s goal: qualified consultation leads.</p>
        </div>
        <span className="pill">{completed} of {recommendations.length} complete</span>
      </div>
      <div className="recommendation-list">
        {recommendations.map((item) => <RecommendationCard item={item} key={item.id} />)}
      </div>

      <div className="next-week surface">
        <div>
          <span className="pill">Suggested sprint</span>
          <h2 className="serif">A focused 7-day plan</h2>
          <p className="muted">Complete the homepage preview and consultation CTAs first. Then use the new messaging to brief the medical-clinic page.</p>
        </div>
        <Button asChild>
          <Link href="/demo/assistant">Create my 7-day plan</Link>
        </Button>
      </div>
    </>
  );
}

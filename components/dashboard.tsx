"use client";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Gauge, Radar, Sparkles, Target, Zap } from "lucide-react";
import { aiVisibilitySummaries, promptOpportunities, recommendations, unifiedGrowthDecisions } from "@/lib/data/demo";
import { RecommendationCard } from "./recommendation-card";
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
    <div className="stat-card">
      <div className="stat-top">
        <span className="stat-label">{stat.label}</span>
        <span className="stat-icon"><stat.Icon size={16} /></span>
      </div>
      <div className="stat-value">{stat.value}{stat.suffix && <span>{stat.suffix}</span>}</div>
      <span className="stat-prev">{stat.prev} previous period</span>
      <div className="stat-foot">
        <span className={`stat-delta ${up ? "up" : "down"}`}>{up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{up ? "+" : ""}{change}%</span>
        <small>vs last period</small>
      </div>
    </div>
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
        <Link href="/demo/assistant" className="btn btn-secondary"><Sparkles size={16} /> Ask your growth assistant</Link>
      </div>

      <div className="stat-cards">
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
        <Link className="btn btn-primary" href="/demo/assistant">Create my 7-day plan</Link>
      </div>
    </>
  );
}

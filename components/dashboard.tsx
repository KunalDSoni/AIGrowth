"use client";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { recommendations, unifiedGrowthDecisions } from "@/lib/data/demo";
import { RecommendationCard } from "./recommendation-card";
import { SiteScan } from "./site-scan";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";

export function Dashboard() {
  const [completed, setCompleted] = useState(0);
  useEffect(() => setCompleted(recommendations.filter((r) => localStorage.getItem(`opengrowth:done:${r.id}`) === "true").length), []);

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Your growth workspace</span>
          <h1 className="serif">What should I do next?</h1>
          <p>Scan your live website for real, evidence-backed findings — then act on the highest-impact fixes.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/demo/assistant"><Sparkles className="size-4" /> Ask your growth assistant</Link>
        </Button>
      </div>

      <SiteScan />

      <div className="mt-12 flex items-center gap-3 border-t pt-8">
        <Badge variant="outline">Sample data</Badge>
        <p className="text-sm text-muted-foreground">
          The sections below are an illustrative demo dataset (fictional &ldquo;Northstar Accounting&rdquo;) — not your site.
        </p>
      </div>

      <section className="surface unified-engine">
        <span className="eyebrow">Unified intelligence engine · sample</span>
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
          <h2>Example top actions <span className="text-sm font-normal text-muted-foreground">(sample)</span></h2>
          <p className="muted">Ordered for the sample business&rsquo;s goal: qualified consultation leads.</p>
        </div>
        <span className="pill">{completed} of {recommendations.length} complete</span>
      </div>
      <div className="recommendation-list">
        {recommendations.map((item) => <RecommendationCard item={item} key={item.id} />)}
      </div>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { EmptyLiveState } from "@/components/empty-live-state";
import { PageHeader } from "@/components/page-header";
import { useLiveAnalyze } from "@/lib/client/live-project";
import type { ResearchPlan } from "@/lib/engines/research-engine";

export default function ResearchPage() {
  const { result, ready, hasLive } = useLiveAnalyze();
  const [plan, setPlan] = useState<ResearchPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const domain = result?.project.domain;

  useEffect(() => {
    if (!domain) return;
    let active = true;
    setError(null);
    setPlan(null);
    fetch(`/api/research?domain=${encodeURIComponent(domain)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!active) return;
        if (response.ok) setPlan(body.plan as ResearchPlan);
        else setError(body.error ?? "Failed to load the research plan.");
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      active = false;
    };
  }, [domain]);

  if (!ready) return null;
  if (!hasLive || !result) {
    return (
      <EmptyLiveState
        title="No research angles yet"
        description="Analyze your website first. This reads your GEO citation ledger and finds the niche gaps where an original statistic would get cited but no source owns the answer — the angles for a citable, proprietary study."
      />
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Research engine"
        description="Where to manufacture a citable fact: quantitative questions AI answers cite by number, that no source — least of all you — owns yet."
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {plan ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{plan.note}</p>
          {plan.angles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No citable angles in the current ledger. This is an honest empty state — no fabricated
              opportunities.
            </p>
          ) : (
            <ul className="space-y-3">
              {plan.angles.map((angle) => (
                <li
                  key={angle.promptId}
                  className="rounded-lg border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm font-medium text-foreground">{angle.prompt}</p>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      {angle.citationPotential} potential
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{angle.rationale}</p>
                  <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                    <span>Status: {angle.status}</span>
                    <span>Contested by: {angle.contested} source{angle.contested === 1 ? "" : "s"}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {!plan.canCompose && plan.angles.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Composing a study end-to-end needs licensed datasets. Connect a data source (or enable
              real-data mode) to move from angle to a human-approved, schema-marked study.
            </p>
          )}
        </div>
      ) : (
        !error && <p className="text-sm text-muted-foreground">Finding angles…</p>
      )}
    </div>
  );
}

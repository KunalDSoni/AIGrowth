"use client";

import { useEffect, useState } from "react";
import { EmptyLiveState } from "@/components/empty-live-state";
import { GrowthIntelligenceView } from "@/components/growth-intelligence";
import { PageHeader } from "@/components/page-header";
import { useLiveAnalyze } from "@/lib/client/live-project";
import type { GrowthIntelligenceReport } from "@/lib/domain/types";

export default function GrowthIntelligencePage() {
  const { result, ready, hasLive } = useLiveAnalyze();
  const [report, setReport] = useState<GrowthIntelligenceReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const domain = result?.project.domain;

  useEffect(() => {
    if (!domain) return;
    let active = true;
    setError(null);
    fetch(`/api/growth-intelligence?domain=${encodeURIComponent(domain)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!active) return;
        if (response.ok) setReport(body.report as GrowthIntelligenceReport);
        else setError(body.error ?? "Failed to load Growth Intelligence.");
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
        title="No live growth intelligence yet"
        description="Analyze your website first. The six intelligences are derived from your live crawl + GEO evidence — we do not invent a demo project."
      />
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Growth Intelligence"
        description="Search + Technical + Business + Content + AI Visibility + Marketing — fused into ranked, evidence-backed decisions."
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {report ? (
        <GrowthIntelligenceView report={report} />
      ) : (
        !error && <p className="text-sm text-muted-foreground">Composing intelligence…</p>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { EmptyLiveState } from "@/components/empty-live-state";
import { GeoFixReportView } from "@/components/geo-fix-report";
import { PageHeader } from "@/components/page-header";
import { useLiveAnalyze } from "@/lib/client/live-project";
import type { GeoFixReport } from "@/lib/engines/geo-fix-report";

export default function GeoFixesPage() {
  const { result, ready, hasLive } = useLiveAnalyze();
  const [report, setReport] = useState<GeoFixReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const domain = result?.project.domain;

  useEffect(() => {
    if (!domain) return;
    let active = true;
    setError(null);
    fetch(`/api/geo-fixes?domain=${encodeURIComponent(domain)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!active) return;
        if (response.ok) setReport(body.report as GeoFixReport);
        else setError(body.error ?? "Failed to load GEO citation fixes.");
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
        title="No live GEO citation data yet"
        description="Analyze your website first. Citation fixes are derived from your live GEO probes and a crawl of the sources that got cited — we do not invent a demo project."
      />
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="GEO citation fixes"
        description="Where AI answers cite others instead of you — and the specific, evidence-backed fix to earn the citation. Human-gated, directional, never auto-published."
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {report ? (
        <GeoFixReportView report={report} />
      ) : (
        !error && <p className="text-sm text-muted-foreground">Diagnosing citation gaps…</p>
      )}
    </div>
  );
}

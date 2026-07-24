"use client";

import { useEffect, useState } from "react";
import { EmptyLiveState } from "@/components/empty-live-state";
import { GeoLiftReportView } from "@/components/geo-lift-report";
import { PageHeader } from "@/components/page-header";
import { useLiveAnalyze } from "@/lib/client/live-project";
import type { LiftReport } from "@/lib/engines/geo-lift-report";

export default function GeoLiftPage() {
  const { result, ready, hasLive } = useLiveAnalyze();
  const [report, setReport] = useState<LiftReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const domain = result?.project.domain;

  useEffect(() => {
    if (!domain) return;
    let active = true;
    setError(null);
    fetch(`/api/geo-lift?domain=${encodeURIComponent(domain)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!active) return;
        if (response.ok) setReport(body.report as LiftReport);
        else setError(body.error ?? "Failed to load measured lifts.");
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
        title="No measured citation lifts yet"
        description="Ship a GEO citation fix, then measure it. Proven lift is computed from a re-probe against your baseline — causal only when a control is used."
      />
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Proven citation lift"
        description="Before/after citation share for shipped fixes, with confidence intervals and honest causal/directional labels."
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {report ? (
        <GeoLiftReportView report={report} />
      ) : (
        !error && <p className="text-sm text-muted-foreground">Loading measured lifts…</p>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { EmptyLiveState } from "@/components/empty-live-state";
import { IngestionReportView } from "@/components/ingestion-report";
import { PageHeader } from "@/components/page-header";
import { useLiveAnalyze } from "@/lib/client/live-project";
import type { IngestionReport } from "@/lib/engines/ingestion-report";

export default function IngestionPage() {
  const { result, ready, hasLive } = useLiveAnalyze();
  const [report, setReport] = useState<IngestionReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const domain = result?.project.domain;

  useEffect(() => {
    if (!domain) return;
    let active = true;
    setError(null);
    setReport(null);
    fetch(`/api/ingestion?domain=${encodeURIComponent(domain)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!active) return;
        if (response.ok) setReport(body.report as IngestionReport);
        else setError(body.error ?? "Failed to load ingestion report.");
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
        title="No live ingestion report yet"
        description="Analyze your website first. Crawl depth, GEO, performance and authority are derived from your domain — every section is labelled measured, simulated, or estimate."
      />
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Open-source ingestion & data mesh"
        description="Crawlee-style multi-page crawl, Firecrawl-clean corpus, answer-engine GEO, Core Web Vitals, SERP and authority — one report, honestly labelled."
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {report ? (
        <IngestionReportView report={report} />
      ) : (
        !error && <p className="text-sm text-muted-foreground">Running ingestion adapters…</p>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { EmptyLiveState } from "@/components/empty-live-state";
import { CrossEngineLedgerView } from "@/components/cross-engine-ledger";
import { PageHeader } from "@/components/page-header";
import { useLiveAnalyze } from "@/lib/client/live-project";
import type { CrossEngineLedger } from "@/lib/engines/geo-cross-engine-ledger";

export default function GeoEnginesPage() {
  const { result, ready, hasLive } = useLiveAnalyze();
  const [report, setReport] = useState<CrossEngineLedger | null>(null);
  const [error, setError] = useState<string | null>(null);

  const domain = result?.project.domain;

  useEffect(() => {
    if (!domain) return;
    let active = true;
    setError(null);
    setReport(null);
    fetch(`/api/geo-engines?domain=${encodeURIComponent(domain)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!active) return;
        if (response.ok) setReport(body.report as CrossEngineLedger);
        else setError(body.error ?? "Failed to load cross-engine visibility.");
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
        title="No cross-engine visibility yet"
        description="Analyze your website first. This probes your prompt universe across every configured answer engine (ChatGPT, Perplexity, Gemini) — offline it shows a simulated Mock engine, clearly labelled."
      />
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Cross-engine visibility"
        description="Where you're cited vs absent across AI answer engines, who gets cited instead, and cross-engine share of voice."
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {report ? (
        <CrossEngineLedgerView report={report} />
      ) : (
        !error && <p className="text-sm text-muted-foreground">Probing engines…</p>
      )}
    </div>
  );
}

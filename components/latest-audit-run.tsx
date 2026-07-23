"use client";
import { useEffect, useState } from "react";
import { FileSearch } from "lucide-react";

interface StoredAuditRun {
  id?: string;
  capturedAt: string;
  completedAt?: string;
  source?: string;
  url?: string;
  simulatedIssues?: boolean;
  crawlError?: string;
  crawl?: { finalUrl?: string; statusCode?: number; wordCount?: number };
  data?: {
    runId?: string;
    source?: string;
    url?: string;
    simulatedIssues?: boolean;
    crawlError?: string;
    crawl?: { finalUrl?: string; statusCode?: number; wordCount?: number };
  };
}

export function LatestAuditRun() {
  const [run, setRun] = useState<StoredAuditRun | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadServerRun() {
      try {
        const response = await fetch("/api/audit/latest");
        const json = await response.json() as { run?: StoredAuditRun | null };
        if (!cancelled && json.run) {
          setRun(json.run);
          return;
        }
      } catch {
        // Local fallback below keeps the demo usable when the server store is unavailable.
      }
      const raw = localStorage.getItem("opengrowth:lastAuditRun");
      if (!raw || cancelled) return;
      try {
        setRun(JSON.parse(raw) as StoredAuditRun);
      } catch {
        setRun(null);
      }
    }
    loadServerRun();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!run) return <section className="surface latest-audit-run"><FileSearch size={18} /><div><b>No persisted audit run stored yet</b><p className="muted">Run onboarding to capture the latest audit API response.</p></div></section>;

  const data = run.data ?? run;
  const capturedAt = run.completedAt ?? run.capturedAt;
  return <section className="surface latest-audit-run"><FileSearch size={18} /><div><b>Latest persisted audit run</b><p className="muted">{data.source ?? "unknown source"} · {data.url ?? "demo project"} · {capturedAt ? new Date(capturedAt).toLocaleString() : "stored locally"}</p>{data.crawl ? <p className="fine">Crawled {data.crawl.finalUrl} with status {data.crawl.statusCode}; normalized {data.crawl.wordCount} words.</p> : null}{data.crawlError ? <p className="fine">Crawler fallback: {data.crawlError}</p> : null}{run.id || run.data?.runId ? <p className="fine">Run ID: {run.id ?? run.data?.runId}</p> : null}</div><span className="pill">{data.simulatedIssues ? "Simulated issues" : "Live rule issues"}</span></section>;
}

"use client";
import { useEffect, useState } from "react";
import { FileSearch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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

  if (!run)
    return (
      <Card>
        <CardContent className="flex items-center gap-3">
          <FileSearch className="size-5 text-muted-foreground" />
          <div>
            <p className="font-medium">No persisted audit run stored yet</p>
            <p className="text-sm text-muted-foreground">Run onboarding to capture the latest audit API response.</p>
          </div>
        </CardContent>
      </Card>
    );

  const data = run.data ?? run;
  const capturedAt = run.completedAt ?? run.capturedAt;
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3">
        <FileSearch className="size-5 text-muted-foreground" />
        <div className="flex-1">
          <p className="font-medium">Latest persisted audit run</p>
          <p className="text-sm text-muted-foreground">
            {data.source ?? "unknown source"} · {data.url ?? "demo project"} · {capturedAt ? new Date(capturedAt).toLocaleString() : "stored locally"}
          </p>
          {data.crawl ? (
            <p className="text-xs text-muted-foreground">Crawled {data.crawl.finalUrl} with status {data.crawl.statusCode}; normalized {data.crawl.wordCount} words.</p>
          ) : null}
          {data.crawlError ? <p className="text-xs text-muted-foreground">Crawler fallback: {data.crawlError}</p> : null}
          {run.id || run.data?.runId ? <p className="text-xs text-muted-foreground">Run ID: {run.id ?? run.data?.runId}</p> : null}
        </div>
        <Badge variant="secondary">{data.simulatedIssues ? "Simulated issues" : "Live rule issues"}</Badge>
      </CardContent>
    </Card>
  );
}

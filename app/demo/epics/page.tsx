"use client";

import { useEffect, useState } from "react";
import { EmptyLiveState } from "@/components/empty-live-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveAnalyze } from "@/lib/client/live-project";

type EpicRow = { epicId: string; status: string; summary: string };

export default function EpicsPage() {
  const { result, ready, hasLive } = useLiveAnalyze();
  const [rows, setRows] = useState<EpicRow[]>([]);
  const [counts, setCounts] = useState<{ completed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!result?.project.domain) return;
    fetch(`/api/epics?domain=${encodeURIComponent(result.project.domain)}`)
      .then(async (r) => {
        const data = (await r.json()) as {
          epics?: EpicRow[];
          completedCount?: number;
          totalCount?: number;
          error?: string;
        };
        if (!r.ok) throw new Error(data.error ?? "Failed");
        setRows(data.epics ?? []);
        setCounts({ completed: data.completedCount ?? 0, total: data.totalCount ?? 0 });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load epics"));
  }, [result?.project.domain]);

  if (!ready) return null;
  if (!hasLive || !result) {
    return <EmptyLiveState title="Epic registry needs a live analyze" />;
  }

  const groups = rows.reduce<Record<string, EpicRow[]>>((acc, row) => {
    const prefix = row.epicId.split("-")[0] ?? "OTHER";
    acc[prefix] = [...(acc[prefix] ?? []), row];
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Epic registry — all EPIC_INDEX items"
        description="Every blueprint epic runs against your live analyze. No Northstar demo shortcuts."
        action={
          <Badge variant="secondary">
            {counts ? `${counts.completed}/${counts.total} done` : result.epicSuite ? `${result.epicSuite.completedCount}/${result.epicSuite.totalCount}` : "…"}
          </Badge>
        }
      />

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="grid gap-4">
        {Object.entries(groups).map(([prefix, items]) => (
          <Card key={prefix}>
            <CardHeader>
              <CardTitle className="text-base">{prefix}</CardTitle>
              <CardDescription>{items.length} epics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.map((item) => (
                <div key={item.epicId} className="flex flex-wrap items-start justify-between gap-2 border-b border-border py-2 last:border-0">
                  <div>
                    <Badge variant="outline" className="mr-2">{item.epicId}</Badge>
                    <span className="text-sm font-medium">{item.summary}</span>
                  </div>
                  <Badge>{item.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

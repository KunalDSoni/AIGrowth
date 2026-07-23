"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EvidenceReference } from "@/lib/domain/types";
import { summarizeEvidence, type EvidenceView } from "@/lib/engines/evidence";

export function EvidenceDrawer({
  evidence,
  references,
  evidenceIds,
  title = "Evidence drawer",
  affectedAssets,
}: {
  evidence?: EvidenceReference[];
  /** @deprecated Prefer `evidence` */
  references?: EvidenceReference[];
  evidenceIds?: string[];
  title?: string;
  affectedAssets?: string[];
}) {
  const pool = evidence ?? references ?? [];
  const filtered = evidenceIds?.length ? pool.filter((e) => evidenceIds.includes(e.id)) : pool;
  const summary = summarizeEvidence(filtered);

  if (summary.total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>No evidence linked.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          {summary.total} item(s) · {summary.strong} strong · {summary.simulated} simulated · {summary.stale} stale
          {affectedAssets?.length ? ` · assets: ${affectedAssets.join(", ")}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {summary.views.map((view: EvidenceView) => (
          <div key={view.id} className="border-b border-border pb-3 last:border-0">
            <div className="mb-1 flex flex-wrap gap-1.5">
              <Badge variant="outline">{view.strength}</Badge>
              <Badge variant="secondary">{view.provenance}</Badge>
              <Badge variant="outline">{view.freshness}</Badge>
              <Badge variant="outline">{view.sourceEngine}</Badge>
            </div>
            <p className="text-sm">{view.summary}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {view.id}
              {view.ageDays !== null ? ` · ${view.ageDays}d old` : ""}
              {view.observedAt ? ` · ${new Date(view.observedAt).toLocaleString()}` : ""}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

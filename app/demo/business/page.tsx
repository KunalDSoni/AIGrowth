"use client";
import { useMemo, useState } from "react";
import { Check, PencilLine, X } from "lucide-react";
import {
  applyConfirmation,
  pendingReview,
  rankedEntities,
  type BusinessEntityType,
  type BusinessGraph,
} from "@/lib/engines/business-graph";
import { businessGraph as seedGraph } from "@/lib/data/demo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const TYPES: [BusinessEntityType, string][] = [
  ["service", "Services"],
  ["audience", "Audiences"],
  ["geography", "Geographies"],
  ["differentiator", "Differentiators"],
  ["competitor", "Competitors"],
];

const statusClass: Record<string, string> = {
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  "user-supplied": "border-blue-200 bg-blue-50 text-blue-700",
  observed: "border-teal-200 bg-teal-50 text-teal-700",
  "ai-inferred": "border-amber-200 bg-amber-50 text-amber-700",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
};

const dotClass: Record<string, string> = {
  confirmed: "bg-emerald-500",
  "user-supplied": "bg-blue-500",
  observed: "bg-teal-500",
  "ai-inferred": "bg-amber-500",
  rejected: "bg-rose-500",
};

export default function BusinessGraphPage() {
  const [graph, setGraph] = useState<BusinessGraph>(seedGraph);
  const [log, setLog] = useState<string[]>([]);

  const pending = useMemo(() => pendingReview(graph), [graph]);

  const decide = (entityId: string, action: "confirm" | "reject" | "edit", label?: string) => {
    const result = applyConfirmation(graph, {
      entityId,
      action,
      label,
      at: new Date().toISOString().slice(0, 19).replace("T", " "),
    });
    setGraph(result.graph);
    setLog((prev) => [result.audit, ...prev].slice(0, 8));
  };

  const edit = (entityId: string, current: string) => {
    const next = typeof window !== "undefined" ? window.prompt("Edit and confirm this fact:", current) : null;
    if (next && next.trim()) decide(entityId, "edit", next.trim());
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Confirm what we believe about your business</h1>
          <p className="max-w-2xl text-muted-foreground">
            AI-inferred facts must be reviewed before they influence recommendations. Confirmed facts outrank inferred ones in every score.
          </p>
        </div>
        <Badge variant="secondary">{pending.length} awaiting review</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Why this matters</CardTitle>
          <CardDescription>
            Nothing the AI guesses about your business is treated as truth until you confirm it. Reject anything wrong and it stops
            affecting scoring immediately.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Review queue</CardTitle>
          <CardDescription>Inferred facts to confirm, edit or reject.</CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing left to review — every inferred fact has a decision.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pending.map((entity) => (
                <div key={entity.id} className="flex flex-col gap-2 rounded-lg border p-4">
                  <Badge variant="outline" className={statusClass[entity.status]}>{entity.type} · inferred</Badge>
                  <p className="font-medium">{entity.label}</p>
                  <p className="text-xs text-muted-foreground">Confidence {entity.confidence}%</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Button size="sm" type="button" onClick={() => decide(entity.id, "confirm")}>
                      <Check className="size-3.5" /> Confirm
                    </Button>
                    <Button size="sm" variant="outline" type="button" onClick={() => edit(entity.id, entity.label)}>
                      <PencilLine className="size-3.5" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" type="button" onClick={() => decide(entity.id, "reject")}>
                      <X className="size-3.5" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Knowledge graph</CardTitle>
          <CardDescription>What we know, ranked by trust.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TYPES.map(([type, label]) => {
            const entities = rankedEntities(graph, type);
            if (entities.length === 0) return null;
            return (
              <div key={type} className="space-y-2">
                <h3 className="text-sm font-semibold">{label}</h3>
                {entities.map((entity) => (
                  <div key={entity.id} className="flex items-center gap-2 text-sm">
                    <span className={`size-2 shrink-0 rounded-full ${dotClass[entity.status] ?? "bg-neutral-400"}`} />
                    <span>{entity.label}</span>
                    <span className="text-xs text-muted-foreground">— {entity.status}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {log.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Audit trail</CardTitle>
            <CardDescription>Recent decisions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {log.map((entry, index) => (
              <p key={index} className="text-sm text-muted-foreground">{entry}</p>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}

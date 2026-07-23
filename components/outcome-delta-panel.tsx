"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { AnalyzeDelta } from "@/lib/engines/analyze-delta";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function OutcomeDeltaPanel({ delta }: { delta: AnalyzeDelta }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>What changed since last analyze</CardTitle>
          <Badge variant="secondary">{delta.confidence} confidence</Badge>
        </div>
        <CardDescription>
          {new Date(delta.baselineAt).toLocaleString()} → {new Date(delta.comparisonAt).toLocaleString()} · {delta.domain}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">{delta.summary}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {delta.metrics.map((m) => (
            <div key={m.key} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium">{m.label}</p>
                <p className="text-xs text-muted-foreground">
                  {m.before}
                  {m.unit} → {m.after}
                  {m.unit}
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "gap-1 tabular-nums",
                  m.improved && "border-emerald-200 bg-emerald-50 text-emerald-700",
                  m.direction !== "flat" && !m.improved && "border-red-200 bg-red-50 text-red-700",
                )}
              >
                {m.direction === "up" ? <ArrowUpRight className="size-3" /> : m.direction === "down" ? <ArrowDownRight className="size-3" /> : <Minus className="size-3" />}
                {m.delta > 0 ? "+" : ""}
                {m.delta}
                {m.unit}
              </Badge>
            </div>
          ))}
        </div>
        {(delta.actionsResolved.length > 0 || delta.actionsNew.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <p className="font-medium">Actions no longer queued</p>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {delta.actionsResolved.length === 0 && <li>None</li>}
                {delta.actionsResolved.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
            <div>
              <p className="font-medium">New actions appeared</p>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {delta.actionsNew.length === 0 && <li>None</li>}
                {delta.actionsNew.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">{delta.attributionLimits}</p>
        <p className="text-sm"><span className="font-medium">Follow-up: </span>{delta.followUp}</p>
      </CardContent>
    </Card>
  );
}

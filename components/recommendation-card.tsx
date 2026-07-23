"use client";
import Link from "next/link";
import { ArrowRight, CircleCheck, Clock3, Sparkles } from "lucide-react";
import type { Recommendation } from "@/lib/domain/types";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const severityClass: Record<string, string> = {
  critical: "border-rose-200 bg-rose-50 text-rose-700",
  high: "border-amber-200 bg-amber-50 text-amber-700",
  "quick-win": "border-emerald-200 bg-emerald-50 text-emerald-700",
  monitor: "border-blue-200 bg-blue-50 text-blue-700",
  ignore: "border-neutral-200 bg-neutral-50 text-neutral-600",
};

export function RecommendationCard({ item }: { item: Recommendation }) {
  const [done, setDone] = useState(false);
  useEffect(() => setDone(localStorage.getItem(`opengrowth:done:${item.id}`) === "true"), [item.id]);

  return (
    <Card className={cn(done && "opacity-70")}>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex w-14 shrink-0 flex-col items-center">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            {done ? <CircleCheck className="size-4" /> : <span className="font-semibold">{item.rank}</span>}
          </div>
          <span className="mt-1 text-xs text-muted-foreground">Priority</span>
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className={severityClass[item.severity]}>{item.severity.replace("-", " ")}</Badge>
            <span>{item.category}</span>
            <span>·</span>
            <span>{item.confidence} confidence</span>
          </div>
          <h3 className="font-semibold">{item.title}</h3>
          <p className="text-sm text-muted-foreground">{item.explanation}</p>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2 text-sm">
            <Sparkles className="size-4 shrink-0 text-muted-foreground" />
            <span><span className="font-medium">Potential outcome:</span> {item.outcome}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span><span className="font-semibold">{item.impact}</span> impact</span>
            <span className="flex items-center gap-1"><Clock3 className="size-3.5" /><span className="font-semibold">{item.effort}</span> effort</span>
            <span><span className="font-semibold">{item.priorityScore}</span> priority</span>
            <span className="text-xs text-muted-foreground">Decision-support estimate</span>
          </div>
        </div>

        <Button asChild variant="outline" className="shrink-0">
          <Link href={`/demo/recommendations/${item.id}`}>
            {done ? "Review result" : item.assetType.startsWith("SEO") ? "Generate fix" : "Open action"}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

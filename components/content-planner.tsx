"use client";
import { useState } from "react";
import { ArrowRight, FileText, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { evidenceReferences, opportunities } from "@/lib/data/demo";
import { opportunityScore, rankOpportunities } from "@/lib/engines/priority";
import { track } from "@/lib/analytics/client";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ContentPlanner() {
  const [selected, setSelected] = useState<(typeof opportunities)[0] | null>(null);
  const selectedEvidence = selected ? evidenceReferences.filter((reference) => selected.evidenceIds.includes(reference.id)) : [];

  return (
    <>
      <PageHeader
        title="Create content with a job to do"
        description="Ranked by business relevance, coverage gaps and conversion fit — not volume alone."
        action={<Button variant="outline"><SlidersHorizontal className="size-4" /> Ranking method</Button>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business-aware gap engine</CardTitle>
          <p className="text-sm text-muted-foreground">
            These opportunities compare Northstar&rsquo;s services and audiences against the current demo page inventory. Search values
            remain directional estimates.
          </p>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rankOpportunities(opportunities).map((opportunity, index) => (
          <Card key={opportunity.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">{index + 1}</div>
                <Badge variant="secondary">Fit score {opportunityScore(opportunity)}</Badge>
              </div>
              <CardTitle className="text-base">{opportunity.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              <p className="text-sm text-muted-foreground">{opportunity.reason}</p>
              <p className="text-xs text-muted-foreground">{opportunity.scoreExplanation}</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">{opportunity.intent}</Badge>
                <Badge variant="outline">{opportunity.funnel}</Badge>
                <Badge variant="outline">{opportunity.type}</Badge>
                <Badge variant="outline">{opportunity.evidenceIds.length} evidence refs</Badge>
              </div>
              <dl className="grid gap-2 text-sm">
                <div className="flex gap-2"><dt className="w-28 shrink-0 text-muted-foreground">Audience</dt><dd>{opportunity.audience}</dd></div>
                <div className="flex gap-2"><dt className="w-28 shrink-0 text-muted-foreground">Suggested CTA</dt><dd>{opportunity.cta}</dd></div>
              </dl>
              <Button
                variant="outline"
                className="mt-auto"
                onClick={() => {
                  setSelected(opportunity);
                  track("content_opportunity_opened", { opportunity: opportunity.id });
                }}
              >
                Generate content brief <ArrowRight className="size-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelected(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-xl border bg-card p-6 shadow-lg" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between">
              <Badge variant="secondary"><FileText className="size-3.5" /> Evidence-backed brief</Badge>
              <Button variant="ghost" size="icon" onClick={() => setSelected(null)}><X className="size-4" /></Button>
            </div>
            <h2 className="mt-2 text-xl font-semibold">{selected.title}</h2>
            <p className="mt-3 text-sm"><span className="font-medium">Objective: </span>{selected.brief.objective}</p>
            <p className="text-sm"><span className="font-medium">Angle: </span>{selected.brief.angle}</p>
            <h3 className="mt-4 font-semibold">Recommended structure</h3>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              {selected.brief.sections.map((section) => <li key={section}>{section}</li>)}
            </ol>
            <h3 className="mt-4 font-semibold">Evidence used</h3>
            <div className="mt-1 space-y-2">
              {selectedEvidence.map((reference) => (
                <div key={reference.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{reference.source}</p>
                  <p className="text-muted-foreground">{reference.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {reference.kind.replaceAll("_", " ").toLowerCase()} | {reference.isSimulated ? "simulated" : "observed"} | reliability {reference.reliability.toLowerCase()}
                  </p>
                </div>
              ))}
            </div>
            <h3 className="mt-4 font-semibold">Claims to verify before publishing</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {selected.brief.factsToVerify.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <p className="mt-3 text-sm"><span className="font-medium">Related pages: </span>{selected.brief.internalLinks.join(", ")}</p>
            <p className="text-sm"><span className="font-medium">Measurement: </span>{selected.brief.measurementPlan.join(" ")}</p>
            <Button className="mt-4"><Sparkles className="size-4" /> Generate first draft</Button>
          </div>
        </div>
      )}
    </>
  );
}

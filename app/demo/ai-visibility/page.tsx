import { Bot, ExternalLink } from "lucide-react";
import {
  aiVisibilityObservations,
  aiVisibilitySummaries,
  citationGapActions,
  citationIntelligence,
  evidenceReferences,
  latestObservationRun,
} from "@/lib/data/demo";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xl font-semibold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export default function AIVisibilityPage() {
  return (
    <>
      <PageHeader
        title="How AI answers mention Northstar"
        description="Timestamped simulated observations. This is not a permanent ranking and sample size is always shown."
        action={<Badge variant="secondary">Mock observations · 23 Jul 2026</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Observation guardrail</CardTitle>
          <CardDescription>
            AI answers vary by prompt, platform, geography and run. Use this as directional evidence, not a ranking guarantee.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardDescription>Latest observation run · {latestObservationRun.id}</CardDescription>
              <CardTitle>Reproducible run metrics</CardTitle>
            </div>
            <Badge variant="secondary">{latestObservationRun.status} · sample {latestObservationRun.sampleSize}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-10">
            <Metric value={latestObservationRun.sampleSize} label="Observations" />
            <Metric value={latestObservationRun.cost.tokens} label="Est. tokens" />
            <Metric value={`$${latestObservationRun.cost.estimatedUsd}`} label="Est. cost" />
          </div>
          <p className="text-sm text-muted-foreground">
            Seed {latestObservationRun.seed} — re-running with the same seed reproduces these observations exactly, so variability is
            measured, not accidental.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Citation mix</h3>
              <p className="text-sm text-muted-foreground">First-party: {citationIntelligence.firstPartyShare}%</p>
              <p className="text-sm text-muted-foreground">Competitor: {citationIntelligence.competitorShare}%</p>
              <p className="text-sm text-muted-foreground">Third-party: {citationIntelligence.thirdPartyShare}%</p>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Top cited domains</h3>
              {citationIntelligence.byDomain.slice(0, 5).map((domain) => (
                <p key={domain.domain} className="text-sm text-muted-foreground">{domain.domain} ({domain.classification}): {domain.count}</p>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Citation gap actions</CardTitle>
          <CardDescription>Turn source gaps into useful work.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {citationGapActions.map((action) => (
            <div key={action.id} className="rounded-lg border p-4">
              <Badge variant="secondary">{action.confidence} confidence</Badge>
              <p className="mt-2 font-medium">{action.title}</p>
              <p className="text-sm text-muted-foreground">{action.explanation}</p>
              <p className="mt-2 text-sm"><span className="font-medium">Action: </span>{action.recommendedAction}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="outline">{action.gapType}</Badge>
                <Badge variant="outline">{action.missingFirstPartyCitation ? "Missing first-party citation" : "First-party cited"}</Badge>
                <Badge variant="outline">{action.evidenceIds.length} evidence refs</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Measurement: {action.measurementPlan.join(" ")}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {aiVisibilitySummaries.map((summary) => {
          const observations = aiVisibilityObservations.filter((observation) => observation.familyId === summary.familyId);
          const evidence = evidenceReferences.filter((reference) => summary.evidenceIds.includes(reference.id));
          return (
            <Card key={summary.familyId}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardDescription>Prompt family</CardDescription>
                    <CardTitle className="text-base">{summary.topic}</CardTitle>
                  </div>
                  <Badge variant="secondary">Sample size {summary.sampleSize}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-8">
                  <Metric value={`${summary.brandMentionFrequency}%`} label="Brand mention freq." />
                  <Metric value={`${summary.answerConsistency}%`} label="Answer consistency" />
                  <Metric value={`${summary.citationStability}%`} label="Citation stability" />
                </div>
                <p className="text-sm text-muted-foreground">{summary.conclusion}</p>
                <p className="text-sm"><span className="font-medium">Recommended action: </span>{summary.recommendedAction}</p>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold">Competitor mentions</h3>
                    {Object.entries(summary.competitorMentionFrequency).map(([name, count]) => (
                      <p key={name} className="text-sm text-muted-foreground">{name}: {count}/{summary.sampleSize}</p>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold">Cited domains</h3>
                    {Object.entries(summary.citedDomainFrequency).map(([domain, count]) => (
                      <p key={domain} className="text-sm text-muted-foreground">{domain}: {count}/{summary.sampleSize}</p>
                    ))}
                  </div>
                </div>
                <details className="group">
                  <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                    <Bot className="size-4" /> View observations and evidence
                  </summary>
                  <div className="mt-3 space-y-3">
                    {observations.map((observation) => (
                      <div key={observation.id} className="rounded-lg border p-3">
                        <p className="font-medium">{observation.exactPrompt}</p>
                        <p className="text-sm text-muted-foreground">{observation.rawResponse}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge variant="outline">{observation.platform}</Badge>
                          <Badge variant="outline">{observation.locale}</Badge>
                          <Badge variant="outline">{observation.brandMentions.length ? "Northstar mentioned" : "No Northstar mention"}</Badge>
                          <Badge variant="outline">Confidence {observation.extractionConfidence}%</Badge>
                        </div>
                        {observation.citations.map((citation) => (
                          <a key={citation.url} href={citation.url} className="mt-1 flex items-center gap-1 text-sm text-primary hover:underline">
                            <ExternalLink className="size-3" />
                            {citation.domain}
                          </a>
                        ))}
                      </div>
                    ))}
                    <h3 className="text-sm font-semibold">Evidence records</h3>
                    {evidence.map((reference) => (
                      <p key={reference.id} className="text-sm text-muted-foreground">{reference.source}: {reference.summary}</p>
                    ))}
                  </div>
                </details>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}

import { competitorGaps, competitorRecords, competitors } from "@/lib/data/demo";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const fields = [
  ["service", "Service coverage"],
  ["content", "Content coverage"],
  ["technical", "Technical health"],
  ["trust", "Trust signals"],
  ["local", "Local visibility"],
  ["conversion", "Conversion clarity"],
  ["authority", "Topic authority"],
] as const;

export default function CompetitorsPage() {
  return (
    <>
      <PageHeader
        title="Where Northstar can win"
        description="Simulated directional comparison. Backlinks and social data are placeholders."
        action={<Badge variant="secondary">2 demo competitors</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Competitor types are kept separate</CardTitle>
          <CardDescription>Business, organic, local, AI-answer and citation competitors are never mixed in scoring.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          {competitorRecords.map((record) => (
            <Badge key={record.name} variant="outline">{record.name}: {record.type} ({record.confidence}%)</Badge>
          ))}
        </CardContent>
      </Card>

      {competitorGaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Visibility gaps</CardTitle>
            <CardDescription>Where competitors appear and Northstar is absent.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {competitorGaps.map((gap) => (
              <div key={gap.id} className="rounded-lg border p-3">
                <Badge variant="secondary">{gap.gapType} · {gap.confidence}</Badge>
                <p className="mt-2 font-medium">{gap.competitor}</p>
                <p className="text-sm text-muted-foreground">{gap.detail}</p>
                <p className="mt-1 text-xs text-muted-foreground">Sample size {gap.sampleSize} · competitor {gap.competitorRate}% vs you {gap.userRate}%</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/20 bg-muted/40">
        <CardHeader>
          <CardTitle>Competitors cover more topics, but Northstar has clearer service specialization.</CardTitle>
          <CardDescription>
            The fastest opportunity is to turn that specialization into three industry-specific service pages — starting with medical clinics.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Signal comparison</CardTitle>
          <CardDescription>Directional scores out of 100.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-[160px_1fr_1fr] items-center gap-4 border-b pb-2 text-sm font-medium">
            <span>Signal</span>
            {competitors.map((competitor) => (
              <span key={competitor.name}>
                {competitor.name} <span className="text-xs font-normal text-muted-foreground">{competitor.type}</span>
              </span>
            ))}
          </div>
          {fields.map(([key, label]) => (
            <div key={key} className="grid grid-cols-[160px_1fr_1fr] items-center gap-4 text-sm">
              <span className="text-muted-foreground">{label}</span>
              {competitors.map((competitor) => (
                <div key={competitor.name} className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${competitor[key]}%` }} />
                  </div>
                  <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{competitor[key]}/100</span>
                </div>
              ))}
            </div>
          ))}
          {(["Backlink strength", "Social activity"] as const).map((label) => (
            <div key={label} className="grid grid-cols-[160px_1fr_1fr] items-center gap-4 text-sm">
              <span className="text-muted-foreground">{label}</span>
              {competitors.map((competitor) => (
                <span key={competitor.name} className="text-xs text-muted-foreground">Provider not connected</span>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Defend", "Service depth", "Northstar already communicates broader operational accounting expertise."],
          ["Close the gap", "Content coverage", "Create specialist pages and a useful Australian tax resource."],
          ["Do not chase yet", "Raw backlink counts", "Connect a trusted provider before making link-building decisions."],
        ].map(([eyebrow, title, body]) => (
          <Card key={title}>
            <CardHeader>
              <CardDescription>{eyebrow}</CardDescription>
              <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{body}</CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

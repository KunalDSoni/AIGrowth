import { Target } from "lucide-react";
import { promptOpportunities } from "@/lib/data/demo";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const intentClass: Record<string, string> = {
  informational: "border-slate-200 bg-slate-50 text-slate-700",
  commercial: "border-blue-200 bg-blue-50 text-blue-700",
  comparison: "border-violet-200 bg-violet-50 text-violet-700",
  transactional: "border-emerald-200 bg-emerald-50 text-emerald-700",
  local: "border-amber-200 bg-amber-50 text-amber-700",
  navigational: "border-teal-200 bg-teal-50 text-teal-700",
};

function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-lg font-semibold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export default function OpportunitiesPage() {
  const top = promptOpportunities.slice(0, 16);
  return (
    <>
      <PageHeader
        title="Ranked growth opportunities"
        description="Prompt and topic opportunities scored by a demand proxy that blends estimated volume, competition and business relevance."
        action={<Badge variant="secondary">Demo provider · estimated</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estimate guardrail</CardTitle>
          <CardDescription>
            Volume and competition are simulated estimates from the demo provider. Connect Search Console or a keyword provider to
            replace them with measured data.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {top.map((opportunity) => (
          <Card key={opportunity.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardDescription>{opportunity.service}</CardDescription>
                  <CardTitle className="text-base">{opportunity.query}</CardTitle>
                </div>
                <Badge variant="secondary">Demand {opportunity.demandProxy}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Metric value={opportunity.demandProxy} label="Demand proxy" />
                <Metric value={opportunity.businessRelevance} label="Relevance" />
                <div className="flex flex-col">
                  <Badge variant="outline" className={`w-fit capitalize ${intentClass[opportunity.intent] ?? ""}`}>{opportunity.intent}</Badge>
                  <span className="mt-1 text-xs text-muted-foreground">Intent</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="gap-1"><Target className="size-3" /> {opportunity.funnelStage}</Badge>
                <Badge variant="outline">{opportunity.topic}</Badge>
                {opportunity.labels.map((label) => <Badge key={label} variant="outline">{label}</Badge>)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

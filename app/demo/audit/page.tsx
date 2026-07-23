import { additionalRecommendations, auditIssues, evidenceReferences } from "@/lib/data/demo";
import { LatestAuditRun } from "@/components/latest-audit-run";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const severityClass: Record<string, string> = {
  critical: "border-rose-200 bg-rose-50 text-rose-700",
  high: "border-amber-200 bg-amber-50 text-amber-700",
  "quick-win": "border-emerald-200 bg-emerald-50 text-emerald-700",
  monitor: "border-blue-200 bg-blue-50 text-blue-700",
  ignore: "border-neutral-200 bg-neutral-50 text-neutral-600",
};

export default function AuditPage() {
  return (
    <>
      <PageHeader
        title="A clear view of what matters"
        description="Technical rules now connect each issue to observed evidence and a recommended action."
        action={<Badge variant="secondary">Simulated audit · 23 Jul 2026</Badge>}
      />

      <LatestAuditRun />

      <Card className="border-primary/20 bg-muted/40">
        <CardHeader>
          <CardDescription>Executive summary</CardDescription>
          <CardTitle>Northstar has a credible offer, but search demand cannot see its specialization yet.</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-xl bg-primary text-2xl font-bold text-primary-foreground">72</div>
          <div className="text-sm">
            <p className="font-medium">Growth readiness</p>
            <p className="text-muted-foreground">Good foundation. Largest gap is missing commercial coverage, not a broken tag.</p>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold">Issues worth acting on</h2>
      </div>
      <div className="grid gap-3">
        {auditIssues.map((issue) => {
          const evidence = evidenceReferences.filter((reference) => issue.evidenceIds.includes(reference.id));
          return (
            <Card key={issue.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={severityClass[issue.severity]}>{issue.severity.replace("-", " ")}</Badge>
                  <Badge variant="secondary">{issue.impactArea}</Badge>
                  <span className="text-xs text-muted-foreground">rule: {issue.ruleId}</span>
                </div>
                <CardTitle className="text-base">{issue.title}</CardTitle>
                <CardDescription>{issue.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><span className="font-medium">Recommended action: </span>{issue.recommendedAction}</p>
                {evidence.map((reference) => (
                  <p key={reference.id} className="text-xs text-muted-foreground">{reference.source}: {reference.summary}</p>
                ))}
                <p className="text-xs text-muted-foreground">{issue.affectedPages} page{issue.affectedPages === 1 ? "" : "s"} affected</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Planned after the top five</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {additionalRecommendations.map((recommendation, index) => (
            <div key={recommendation} className="flex items-center gap-3 rounded-lg border p-3">
              <span className="flex size-6 items-center justify-center rounded-md bg-muted text-xs font-semibold">{index + 6}</span>
              <span className="flex-1 text-sm">{recommendation}</span>
              <Badge variant="outline">Queued</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

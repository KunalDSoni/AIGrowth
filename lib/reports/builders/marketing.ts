import type { AnalysisSpine } from "@/lib/reports/spine";
import type { ReportBlock, ReportModel, ReportSection } from "@/lib/reports/types";

export function buildMarketingReport(spine: AnalysisSpine): ReportModel {
  const base = {
    slug: "marketing" as const,
    title: "Marketing Report",
    domain: spine.domain,
    brand: spine.brand,
    generatedAt: spine.generatedAt,
    status: spine.marketing.status,
  };

  const ws = spine.marketing.data;
  if (!ws?.report || spine.marketing.status === "not_run") {
    return {
      ...base,
      sections: [
        {
          id: "mkt-empty",
          title: "Position & next best actions",
          blocks: [{ kind: "insufficient", reason: "No marketing workspace has been generated for this domain yet." }],
        },
      ],
    };
  }

  const report = ws.report;
  const summaryBlocks: ReportBlock[] = [
    {
      kind: "kpis",
      items: report.kpis.slice(0, 4).map((k) => ({ label: k.label, value: k.value, hint: k.hint })),
    },
    ...report.chapters.map(
      (c): ReportBlock => ({ kind: "chapter", title: c.title, body: c.body, bullets: c.bullets }),
    ),
  ];

  const planBlock: ReportBlock = {
    kind: "table",
    title: "Fix / Publish / Promote / Measure",
    columns: ["Bucket", "Action", "Effort", "Detail"],
    rows: report.improvisation.map((s) => [s.bucket, s.title, `${s.effortHours}h`, s.detail]),
  };

  const sections: ReportSection[] = [
    { id: "mkt-position", title: "Position summary", blocks: summaryBlocks },
    { id: "mkt-plan", title: "Next best actions", blocks: [planBlock] },
  ];

  return { ...base, sections };
}

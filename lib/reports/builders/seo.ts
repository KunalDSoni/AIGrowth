import type { AnalysisSpine } from "@/lib/reports/spine";
import type { ReportBlock, ReportModel } from "@/lib/reports/types";

export function buildSeoReport(spine: AnalysisSpine): ReportModel {
  const base = {
    slug: "seo" as const,
    title: "SEO Report",
    domain: spine.domain,
    brand: spine.brand,
    generatedAt: spine.generatedAt,
    status: spine.seo.status,
  };

  const seo = spine.seo.data;
  if (!seo || spine.seo.status === "not_run") {
    return {
      ...base,
      sections: [
        {
          id: "seo-empty",
          title: "Technical & on-page audit",
          blocks: [{ kind: "insufficient", reason: "No SEO crawl has been run for this domain yet." }],
        },
      ],
    };
  }

  // On the insufficient path the crawl returned no pages, so the readiness
  // score is a real-but-meaningless number. Suppressing it (rather than
  // showing "Readiness 72" beside "Pages scanned 0") upholds the no-fake-scores
  // rule; the honest counts still render.
  const insufficient = spine.seo.status === "insufficient";
  const blocks: ReportBlock[] = [];
  if (insufficient) {
    blocks.push({ kind: "insufficient", reason: "Crawl returned no pages — findings below are directional only." });
  }
  blocks.push({
    kind: "kpis",
    items: [
      {
        label: "Readiness",
        value: insufficient ? "—" : String(seo.site.score),
        hint: insufficient ? "insufficient data" : seo.site.band,
      },
      { label: "Pages scanned", value: String(seo.site.pagesScanned) },
      { label: "Critical / High", value: `${seo.site.critical} / ${seo.site.high}` },
      { label: "Total issues", value: String(seo.site.totalIssues) },
    ],
  });
  blocks.push({
    kind: "table",
    title: "Ranked issues",
    columns: ["Issue", "Severity", "Pages", "Recommended action"],
    rows: seo.siteIssues
      .slice(0, 25)
      .map((i) => [i.title, i.severity, String(i.affectedPages), i.recommendedAction]),
  });

  return { ...base, sections: [{ id: "seo-main", title: "Technical & on-page audit", blocks }] };
}

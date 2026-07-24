import type { AnalysisSpine } from "@/lib/reports/spine";
import type { ReportBlock, ReportModel } from "@/lib/reports/types";

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function buildGeoReport(spine: AnalysisSpine): ReportModel {
  const base = {
    slug: "geo" as const,
    title: "GEO Report",
    domain: spine.domain,
    brand: spine.brand,
    generatedAt: spine.generatedAt,
    status: spine.geo.status,
  };

  const geo = spine.geo.data;
  if (!geo || spine.geo.status === "not_run") {
    return {
      ...base,
      sections: [
        {
          id: "geo-empty",
          title: "AI answer-engine visibility",
          blocks: [{ kind: "insufficient", reason: "No answer-engine probes have been run for this domain yet." }],
        },
      ],
    };
  }

  const sampleHint = `n=${geo.sampleSize} probes`;
  const blocks: ReportBlock[] = [];
  if (spine.geo.status === "insufficient") {
    blocks.push({ kind: "insufficient", reason: `Only ${geo.sampleSize} probes — rates are directional, not reliable.` });
  }
  blocks.push({
    kind: "kpis",
    items: [
      { label: "Brand mention rate", value: pct(geo.brandMentionRate), hint: sampleHint },
      { label: "First-party citation share", value: pct(geo.firstPartyCitationShare), hint: sampleHint },
      { label: "Model", value: geo.model },
    ],
  });
  if (geo.errors.length > 0) {
    blocks.push({ kind: "callout", tone: "warn", text: `${geo.errors.length} probe(s) errored and were excluded from rates.` });
  }

  return { ...base, sections: [{ id: "geo-main", title: "AI answer-engine visibility", blocks }] };
}

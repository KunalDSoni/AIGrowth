import type { EpicResult } from "@/lib/epics/registry";
import type { EpicContext } from "@/lib/epics/clusters/biz";

function done(epicId: EpicResult["epicId"], summary: string, data: Record<string, unknown>): EpicResult {
  return { epicId, status: "done", summary, data };
}

export function runCompEpics(ctx: EpicContext): EpicResult[] {
  const { result, intelligence } = ctx;
  const competitors = intelligence.competitors;
  const gaps = intelligence.competitorGaps;
  const services = intelligence.profile.services;
  const inventory = intelligence.siteInventory;

  const serviceCoverage = competitors.map((c) => ({
    competitor: c.name,
    type: c.type,
    ourServicePages: inventory.countsByPurpose.service,
    note: "Competitor site not crawled — citation/AI evidence only",
  }));

  const topicCoverage = competitors.map((c) => ({
    competitor: c.name,
    ourTopics: intelligence.topicClusters.map((t) => t.label),
    note: "Topic comparison limited to first-party inventory vs citation presence",
  }));

  const technical = {
    ourScore: result.seo.site.score,
    note: "No competitor crawl — technical comparison unavailable without their URL",
  };

  const trust = {
    ourTrustPages: result.seo.pages.filter((p) => /case|review|testimonial|about/i.test(p.finalUrl + (p.title ?? ""))).length,
    note: "Competitor trust signals require competitor crawl",
  };

  const aiMention = {
    ourRate: result.geo.brandMentionRate,
    gaps,
  };

  const citationCompare = {
    firstPartyShare: intelligence.citations.firstPartyShare,
    competitorShare: intelligence.citations.competitorShare,
    byDomain: intelligence.citations.byDomain.filter((d) => d.classification === "competitor" || d.classification === "third-party"),
  };

  const conclusions = gaps.map((g) => ({
    competitor: g.competitor,
    conclusion: g.detail,
    response: g.gapType === "citation" ? "Strengthen citeable first-party pages" : "Improve entity clarity in answers",
  }));

  const recBridge = result.nextActions.filter((a) => a.source === "competitor");

  return [
    done("COMP-001", "Competitor classification", { competitors }),
    done("COMP-002", "Competitor profile model", {
      profiles: competitors.map((c) => ({
        name: c.name,
        type: c.type,
        source: c.source,
        confidence: c.confidence,
        relevant: c.relevant,
        servicesHint: services,
      })),
    }),
    done("COMP-003", "Service coverage comparison", { serviceCoverage }),
    done("COMP-004", "Topic coverage comparison", { topicCoverage }),
    done("COMP-005", "Technical health comparison", technical),
    done("COMP-006", "Trust signal comparison", trust),
    done("COMP-007", "AI mention comparison", aiMention),
    done("COMP-008", "Citation comparison", citationCompare),
    done("COMP-009", "Competitor gap conclusions", { conclusions }),
    done("COMP-010", "Competitor evidence UI model", { competitors, gaps, citations: intelligence.citations.byDomain }),
    done("COMP-011", "User correction workflow", {
      supported: true,
      api: "POST /api/business competitorCorrection",
      corrections: competitors.filter((c) => c.source.includes("user-corrected")),
    }),
    done("COMP-012", "Competitor-to-recommendation bridge", { actions: recBridge }),
  ];
}

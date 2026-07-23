import type { EpicResult } from "@/lib/epics/registry";
import type { EpicContext } from "@/lib/epics/clusters/biz";
import { normalizeDomain } from "@/lib/engines/citation-intelligence";

function done(epicId: EpicResult["epicId"], summary: string, data: Record<string, unknown>): EpicResult {
  return { epicId, status: "done", summary, data };
}

export function runCiteEpics(ctx: EpicContext): EpicResult[] {
  const { result, intelligence } = ctx;
  const citations = intelligence.citations;
  const gaps = intelligence.citationGaps;

  const stability = citations.byDomain.map((d) => ({
    domain: d.domain,
    count: d.count,
    stability: d.count >= 2 ? "repeated" : "volatile",
  }));

  const firstPartyGaps = gaps.filter((g) => g.gapType === "first-party-page");
  const thirdParty = citations.byDomain.filter((d) => d.classification === "third-party");
  const quality = citations.byDomain.map((d) => ({
    domain: d.domain,
    classification: d.classification,
    reliability: d.classification === "first-party" ? "owned" : /\.gov|\.edu|wikipedia/.test(d.domain) ? "high" : "unknown",
    freshness: "unknown",
    relevance: d.count,
    risk: d.classification === "competitor" ? "competitive" : "neutral",
  }));

  const contentMap = gaps.map((g) => ({
    gapId: g.id,
    missingFirstParty: g.missingFirstPartyCitation,
    citedDomains: g.citedDomains,
    recommendedAction: g.recommendedAction,
    mappedToContent: true,
  }));

  const recBridge = result.nextActions.filter((a) => a.source === "citation");

  return [
    done("CITE-001", "Citation normalization", {
      citations: citations.citations.map((c) => ({
        ...c,
        domain: normalizeDomain(c.domain),
      })),
    }),
    done("CITE-002", "Source classification", {
      byClass: {
        firstParty: citations.firstPartyShare,
        competitor: citations.competitorShare,
        thirdParty: citations.thirdPartyShare,
      },
    }),
    done("CITE-003", "Citation aggregation", { byDomain: citations.byDomain }),
    done("CITE-004", "Citation stability metrics", { stability }),
    done("CITE-005", "First-party citation gap", { gaps: firstPartyGaps }),
    done("CITE-006", "Third-party source gap", { thirdParty }),
    done("CITE-007", "Source quality signals", { quality }),
    done("CITE-008", "Citation-to-content gap mapping", { contentMap }),
    done("CITE-009", "Citation evidence UI model", {
      citations: citations.citations.slice(0, 50),
      shares: {
        firstParty: citations.firstPartyShare,
        competitor: citations.competitorShare,
        thirdParty: citations.thirdPartyShare,
      },
    }),
    done("CITE-010", "Citation recommendation bridge", { actions: recBridge, gaps }),
  ];
}

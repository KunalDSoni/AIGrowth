import type { EpicResult } from "@/lib/epics/registry";
import type { EpicContext } from "@/lib/epics/clusters/biz";
import { buildBrief } from "@/lib/engines/brief-builder";

function done(epicId: EpicResult["epicId"], summary: string, data: Record<string, unknown>): EpicResult {
  return { epicId, status: "done", summary, data };
}

function normalizeQuery(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function runSearchEpics(ctx: EpicContext): EpicResult[] {
  const { result, intelligence } = ctx;
  const opps = intelligence.searchOpportunities;
  const normalized = opps.map((o) => ({ ...o, normalizedQuery: normalizeQuery(o.query) }));
  const intents = intelligence.intentByQuery;
  const clusters = intelligence.topicClusters;

  const pageQueryMap = result.seo.pages
    .filter((p) => p.ok)
    .map((p) => {
      const hay = `${p.title ?? ""} ${p.finalUrl}`.toLowerCase();
      const matches = opps.filter((o) =>
        o.query
          .toLowerCase()
          .split(/\s+/)
          .some((token) => token.length > 3 && hay.includes(token)),
      );
      return { url: p.finalUrl, title: p.title, queries: matches.map((m) => m.query) };
    });

  const cannibalization = pageQueryMap
    .flatMap((p) => p.queries.map((q) => ({ query: q, url: p.url })))
    .reduce<Record<string, string[]>>((acc, row) => {
      acc[row.query] = [...new Set([...(acc[row.query] ?? []), row.url])];
      return acc;
    }, {});
  const cannibal = Object.entries(cannibalization)
    .filter(([, urls]) => urls.length > 1)
    .map(([query, urls]) => ({ query, urls }));

  const local = opps.filter((o) => o.intent === "local" || /near me|local|in /i.test(o.query));
  const commercial = opps
    .map((o) => ({
      ...o,
      commercialScore: Math.round(o.demandProxy * 0.5 + o.businessRelevance * 0.5),
    }))
    .sort((a, b) => b.commercialScore - a.commercialScore);

  const briefSeeds = commercial.slice(0, 3).map((o) =>
    buildBrief({
      recommendationId: o.id,
      contentType: o.intent === "comparison" ? "comparison" : o.intent === "informational" ? "article" : "service",
      objective: `Cover opportunity: ${o.query}`,
      audience: intelligence.profile.audienceSegments[0] ?? "Buyers",
      intent: o.intent,
      evidence: result.evidence.slice(0, 1),
      internalLinks: result.seo.pages.filter((p) => p.ok).map((p) => p.finalUrl).slice(0, 3),
      cta: "Contact / book",
    }),
  );

  const recBridge = result.nextActions.filter((a) => a.source === "search");

  return [
    done("SEARCH-001", "Search evidence provider contract", {
      sources: [...new Set(opps.map((o) => o.source))],
      estimated: opps.filter((o) => o.isEstimated).length,
      labels: opps.flatMap((o) => o.labels),
    }),
    done("SEARCH-002", "Query normalization", { normalized: normalized.slice(0, 20) }),
    done("SEARCH-003", "Intent classification", { intents: intents.slice(0, 20) }),
    done("SEARCH-004", "Topic clustering", { clusters }),
    done("SEARCH-005", "Page-query mapping", { mappings: pageQueryMap }),
    done("SEARCH-006", "Content gap detection", { coverageGaps: intelligence.siteInventory.coverageGaps }),
    done("SEARCH-007", "Cannibalization signals", { cannibalization: cannibal }),
    done("SEARCH-008", "Local search opportunities", { local }),
    done("SEARCH-009", "Commercial opportunity scoring", { commercial: commercial.slice(0, 20) }),
    done("SEARCH-010", "Search opportunity UI model", {
      opportunities: opps.slice(0, 20),
      honesty: "Crawl-derived estimates — not Search Console",
    }),
    done("SEARCH-011", "Search-to-recommendation bridge", { actions: recBridge }),
    done("SEARCH-012", "Search opportunity brief seeds", { briefs: briefSeeds }),
  ];
}

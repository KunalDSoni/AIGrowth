import type { EpicResult } from "@/lib/epics/registry";
import type { EpicContext } from "@/lib/epics/clusters/biz";
import { detectRefreshCandidates } from "@/lib/engines/content-inventory";
import { buildActionBrief } from "@/lib/engines/action-brief";
import { classifyIntent } from "@/lib/engines/search-intent";

function done(epicId: EpicResult["epicId"], summary: string, data: Record<string, unknown>): EpicResult {
  return { epicId, status: "done", summary, data };
}

export function runContentEpics(ctx: EpicContext): EpicResult[] {
  const { result, intelligence } = ctx;
  const inventory = intelligence.contentInventory;
  const refresh = detectRefreshCandidates(inventory);

  const intentSatisfaction = inventory.map((item) => {
    const intent = classifyIntent(item.targetQuery);
    const satisfied =
      item.wordCount >= 300 && item.status !== "thin" && item.hasClearCta;
    return {
      url: item.url,
      intent: intent.intent,
      satisfied,
      reason: satisfied ? "Adequate length + CTA proxy" : "Thin, missing CTA, or weak coverage",
    };
  });

  const entityCoverage = intelligence.profile.services.map((service) => {
    const covered = inventory.some((i) => i.url.toLowerCase().includes(service.toLowerCase().split(/\s+/)[0]) || i.targetQuery.toLowerCase().includes(service.toLowerCase().split(/\s+/)[0]));
    return { service, covered };
  });

  const originality = inventory.map((item) => ({
    url: item.url,
    genericRisk: item.wordCount < 400 || item.status === "duplicate",
    note: item.status === "duplicate" ? "Overlapping target query" : item.wordCount < 400 ? "Possibly thin/generic" : "Ok",
  }));

  const trust = inventory.map((item) => ({
    url: item.url,
    hasProof: item.hasProof,
    status: item.hasProof ? "ok" : "missing-proof",
  }));

  const conversion = inventory.map((item) => ({
    url: item.url,
    hasClearCta: item.hasClearCta,
    status: item.hasClearCta ? "clear" : "unclear",
  }));

  const qualityExplain = inventory.map((item) => ({
    url: item.url,
    status: item.status,
    dimensions: {
      depth: Math.min(100, Math.round(item.wordCount / 10)),
      freshness: item.status === "stale" ? 20 : 80,
      proof: item.hasProof ? 80 : 20,
      cta: item.hasClearCta ? 80 : 20,
      uniqueness: item.status === "duplicate" ? 20 : 70,
    },
    explanation: `Status ${item.status}: depth from word count, proof/CTA from crawl proxies, GSC metrics unavailable.`,
  }));

  const contentActions = result.nextActions.filter((a) => a.source === "content" || a.source === "search");
  const briefInputs = contentActions.slice(0, 3).map((a) => buildActionBrief(result, a));

  return [
    done("CONTENT-001", "Content analysis contract", {
      dimensions: ["depth", "freshness", "proof", "cta", "uniqueness"],
      inventoryCount: inventory.length,
      performanceSource: "unavailable-until-gsc",
    }),
    done("CONTENT-002", "Page purpose detection", { purposes: intelligence.siteInventory.countsByPurpose }),
    done("CONTENT-003", "Intent satisfaction analysis", { intentSatisfaction }),
    done("CONTENT-004", "Entity and topic coverage", { entityCoverage }),
    done("CONTENT-005", "Original contribution review", { originality }),
    done("CONTENT-006", "Trust and proof analysis", { trust }),
    done("CONTENT-007", "Conversion clarity analysis", { conversion }),
    done("CONTENT-008", "Freshness and decay signals", {
      stale: inventory.filter((i) => i.status === "stale"),
      refresh,
    }),
    done("CONTENT-009", "Content consolidation signals", {
      duplicates: inventory.filter((i) => i.status === "duplicate"),
    }),
    done("CONTENT-010", "Content quality score explanation", { qualityExplain }),
    done("CONTENT-011", "Content-to-recommendation bridge", { actions: contentActions }),
    done("CONTENT-012", "Content brief input builder", { briefs: briefInputs.map((b) => b.brief) }),
  ];
}

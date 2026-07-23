import type { BusinessProfileSnapshot } from "@/lib/domain/types";
import type { DemandSignal } from "@/lib/providers/search";
import { classifyIntent, type FunnelStage, type SearchIntent } from "@/lib/engines/search-intent";

/**
 * Demand Proxy Engine (EPIC SEARCH-001).
 *
 * Turns raw provider demand signals into ranked prompt/topic opportunities,
 * combining a volume proxy, competition and business relevance. Real provider
 * data and demo estimates are kept distinguishable via source and label fields —
 * the product never presents an estimate as a measurement.
 */

export interface PromptOpportunity {
  id: string;
  query: string;
  topic: string;
  service: string;
  intent: SearchIntent;
  funnelStage: FunnelStage;
  demandProxy: number;
  businessRelevance: number;
  source: DemandSignal["source"];
  isEstimated: boolean;
  labels: string[];
}

const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

const slug = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);

function volumeScore(monthlySearches?: number): number {
  if (monthlySearches === undefined) return 40; // unknown volume: neutral prior
  // Log-ish scaling so a 900/mo query doesn't dwarf a 300/mo one entirely.
  return clamp(Math.min(100, (Math.log10(monthlySearches + 1) / 3) * 100));
}

function relevanceScore(signal: DemandSignal, business: BusinessProfileSnapshot): number {
  const declared = business.services.some((s) => s.toLowerCase() === signal.service.toLowerCase());
  const audienceHit = business.audienceSegments.some((a) => signal.query.toLowerCase().includes(a.toLowerCase().split(/\s+/)[0]));
  return clamp((declared ? 80 : 55) + (audienceHit ? 15 : 0));
}

function labelsFor(signal: DemandSignal): string[] {
  const labels: string[] = [];
  labels.push(
    signal.source === "demo"
      ? "Demo data"
      : signal.source === "crawl-derived"
        ? "Crawl-derived estimate"
        : signal.source,
  );
  if (signal.isEstimated) labels.push("Estimated");
  return labels;
}

export function buildDemandProxy(input: {
  signals: DemandSignal[];
  business: BusinessProfileSnapshot;
}): PromptOpportunity[] {
  const opportunities = input.signals.map((signal): PromptOpportunity => {
    const classification = classifyIntent(signal.query);
    const relevance = relevanceScore(signal, input.business);
    const volume = volumeScore(signal.monthlySearches);
    const competition = signal.competitionIndex ?? 50;
    const demandProxy = clamp(relevance * 0.4 + volume * 0.35 + (100 - competition) * 0.25);

    return {
      id: `opp-${slug(signal.query)}`,
      query: signal.query,
      topic: signal.topic,
      service: signal.service,
      intent: classification.intent,
      funnelStage: classification.funnelStage,
      demandProxy,
      businessRelevance: relevance,
      source: signal.source,
      isEstimated: signal.isEstimated,
      labels: labelsFor(signal),
    };
  });

  return opportunities.sort((a, b) => b.demandProxy - a.demandProxy);
}

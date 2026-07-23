/**
 * Search Opportunity Providers (EPIC SEARCH-001).
 *
 * A provider-neutral contract for prompt/topic demand discovery. The demo
 * provider returns deterministic, clearly-labelled estimates so the product is
 * useful immediately; the Search Console and keyword/SERP adapters are honest
 * placeholders that fail fast with NOT_CONFIGURED rather than fabricating data.
 */

export type DemandSource = "demo" | "search-console" | "keyword-provider" | "serp";

export interface DemandSignal {
  query: string;
  topic: string;
  service: string;
  source: DemandSource;
  isEstimated: boolean;
  monthlySearches?: number;
  /** 0-100; higher means more competitive. */
  competitionIndex?: number;
}

export interface DiscoverInput {
  services: string[];
  audiences: string[];
  market: string;
}

export interface SearchOpportunityProvider {
  readonly source: DemandSource;
  discover(input: DiscoverInput): Promise<DemandSignal[]>;
}

export class ProviderNotConfiguredError extends Error {
  readonly code = "NOT_CONFIGURED";
  constructor(provider: string) {
    super(`${provider} is not configured. Connect it to replace demo estimates with real data.`);
    this.name = "ProviderNotConfiguredError";
  }
}

// Deterministic hash so demo numbers are stable across runs but vary per query.
function stableHash(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

const INTENT_TEMPLATES: { suffix: (service: string, market: string) => string; topic: (service: string) => string }[] = [
  { suffix: (s) => `best ${s.toLowerCase()} providers`, topic: (s) => `${s} providers` },
  { suffix: (s, m) => `${s.toLowerCase()} services in ${m.toLowerCase()}`, topic: (s) => `${s} services` },
  { suffix: (s) => `how much does ${s.toLowerCase()} cost`, topic: (s) => `${s} pricing` },
  { suffix: (s) => `${s.toLowerCase()} vs doing it in-house`, topic: (s) => `${s} comparison` },
];

export class DemoSearchProvider implements SearchOpportunityProvider {
  readonly source = "demo" as const;

  async discover(input: DiscoverInput): Promise<DemandSignal[]> {
    const signals: DemandSignal[] = [];
    for (const service of input.services) {
      for (const template of INTENT_TEMPLATES) {
        const query = template.suffix(service, input.market);
        const hash = stableHash(query);
        signals.push({
          query,
          topic: template.topic(service),
          service,
          source: "demo",
          isEstimated: true,
          monthlySearches: 50 + (hash % 950),
          competitionIndex: hash % 100,
        });
      }
    }
    return signals;
  }
}

/** Placeholder — a real implementation would call the Search Console API. */
export class SearchConsoleAdapter implements SearchOpportunityProvider {
  readonly source = "search-console" as const;
  async discover(): Promise<DemandSignal[]> {
    throw new ProviderNotConfiguredError("Google Search Console");
  }
}

/** Placeholder — a real implementation would call a keyword/SERP provider. */
export class KeywordProviderAdapter implements SearchOpportunityProvider {
  readonly source = "keyword-provider" as const;
  async discover(): Promise<DemandSignal[]> {
    throw new ProviderNotConfiguredError("Keyword provider");
  }
}

/**
 * Search Opportunity Providers (EPIC SEARCH-001).
 *
 * Provider-neutral contract for prompt/topic demand discovery.
 * - Demo: deterministic labelled estimates for local/demo use.
 * - Search Console: live Search Analytics when GSC credentials are set.
 * - Keyword provider: HTTP adapter for any keyword/SERP API that matches the
 *   documented JSON shape.
 */

export type DemandSource = "demo" | "search-console" | "keyword-provider" | "serp" | "crawl-derived";

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

/** Synchronous, deterministic signal generation — safe to call at module scope. */
export function demoDemandSignals(input: DiscoverInput): DemandSignal[] {
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

export class DemoSearchProvider implements SearchOpportunityProvider {
  readonly source = "demo" as const;

  async discover(input: DiscoverInput): Promise<DemandSignal[]> {
    return demoDemandSignals(input);
  }
}

function matchService(query: string, services: string[]): string {
  const lower = query.toLowerCase();
  return (
    services.find((service) => lower.includes(service.toLowerCase().split(/\s+/)[0] ?? service.toLowerCase())) ??
    services[0] ??
    "service"
  );
}

function isoDateDaysAgo(days: number, now = new Date()) {
  const d = new Date(now.getTime() - days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export type SearchConsoleConfig = {
  siteUrl?: string;
  accessToken?: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  rowLimit?: number;
};

export type EnvLike = Record<string, string | undefined>;

export function isSearchConsoleConfigured(env: EnvLike = process.env) {
  return Boolean(env.GSC_SITE_URL?.trim() && env.GSC_ACCESS_TOKEN?.trim());
}

type GscRow = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };

/** Live Google Search Console Search Analytics adapter. */
export class SearchConsoleAdapter implements SearchOpportunityProvider {
  readonly source = "search-console" as const;

  constructor(private readonly config: SearchConsoleConfig = {}) {}

  async discover(input: DiscoverInput): Promise<DemandSignal[]> {
    const siteUrl = this.config.siteUrl ?? process.env.GSC_SITE_URL;
    const accessToken = this.config.accessToken ?? process.env.GSC_ACCESS_TOKEN;
    if (!siteUrl?.trim() || !accessToken?.trim()) {
      throw new ProviderNotConfiguredError("Google Search Console");
    }

    const now = this.config.now?.() ?? new Date();
    const fetchImpl = this.config.fetchImpl ?? fetch;
    const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: isoDateDaysAgo(28, now),
        endDate: isoDateDaysAgo(1, now),
        dimensions: ["query"],
        rowLimit: this.config.rowLimit ?? 50,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Search Console API error ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
    }

    const payload = (await response.json()) as { rows?: GscRow[] };
    const rows = payload.rows ?? [];
    const signals: DemandSignal[] = [];
    for (const row of rows) {
      const query = row.keys?.[0]?.trim();
      if (!query) continue;
      const service = matchService(query, input.services);
      const impressions = row.impressions ?? 0;
      const position = row.position ?? 50;
      signals.push({
        query,
        topic: service,
        service,
        source: "search-console",
        isEstimated: false,
        monthlySearches: Math.max(1, Math.round(impressions / 4)),
        competitionIndex: Math.min(100, Math.max(0, Math.round(position))),
      });
    }
    return signals;
  }
}

export type KeywordProviderConfig = {
  endpointUrl?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
};

export function isKeywordProviderConfigured(env: EnvLike = process.env) {
  return Boolean(env.KEYWORD_PROVIDER_URL?.trim());
}

type KeywordApiSignal = {
  query?: string;
  keyword?: string;
  topic?: string;
  service?: string;
  monthlySearches?: number;
  volume?: number;
  competitionIndex?: number;
  competition?: number;
};

/**
 * HTTP keyword/SERP adapter.
 * POST `KEYWORD_PROVIDER_URL` with `{ services, audiences, market }`.
 * Expected JSON: `{ signals: [{ query|keyword, topic?, service?, monthlySearches|volume?, competitionIndex|competition? }] }`.
 */
export class KeywordProviderAdapter implements SearchOpportunityProvider {
  readonly source = "keyword-provider" as const;

  constructor(private readonly config: KeywordProviderConfig = {}) {}

  async discover(input: DiscoverInput): Promise<DemandSignal[]> {
    const endpointUrl = this.config.endpointUrl ?? process.env.KEYWORD_PROVIDER_URL;
    const apiKey = this.config.apiKey ?? process.env.KEYWORD_PROVIDER_API_KEY;
    if (!endpointUrl?.trim()) {
      throw new ProviderNotConfiguredError("Keyword provider");
    }

    const fetchImpl = this.config.fetchImpl ?? fetch;
    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
    if (apiKey?.trim()) headers.Authorization = `Bearer ${apiKey}`;

    const response = await fetchImpl(endpointUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Keyword provider error ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
    }

    const payload = (await response.json()) as { signals?: KeywordApiSignal[] };
    const rows = payload.signals ?? [];
    const signals: DemandSignal[] = [];
    for (const row of rows) {
      const query = (row.query ?? row.keyword)?.trim();
      if (!query) continue;
      const service = row.service?.trim() || matchService(query, input.services);
      const monthly = row.monthlySearches ?? row.volume;
      const competition = row.competitionIndex ?? row.competition;
      signals.push({
        query,
        topic: row.topic?.trim() || service,
        service,
        source: "keyword-provider",
        isEstimated: true,
        monthlySearches: typeof monthly === "number" ? monthly : undefined,
        competitionIndex: typeof competition === "number" ? Math.min(100, Math.max(0, Math.round(competition))) : undefined,
      });
    }
    return signals;
  }
}

export type SearchProviderMode = "auto" | "demo" | "search-console" | "keyword-provider";

export function resolveSearchProviderMode(env: EnvLike = process.env): SearchProviderMode {
  const raw = (env.OPENGROWTH_SEARCH_PROVIDER ?? "auto").trim().toLowerCase();
  if (raw === "demo" || raw === "search-console" || raw === "keyword-provider" || raw === "auto") return raw;
  return "auto";
}

/** Select demo / GSC / keyword provider from env. `auto` prefers GSC, then keyword, then demo. */
export function getSearchOpportunityProvider(
  env: EnvLike = process.env,
  overrides: { gsc?: SearchConsoleConfig; keyword?: KeywordProviderConfig } = {},
): SearchOpportunityProvider {
  const mode = resolveSearchProviderMode(env);

  if (mode === "demo") return new DemoSearchProvider();
  if (mode === "search-console") return new SearchConsoleAdapter(overrides.gsc);
  if (mode === "keyword-provider") return new KeywordProviderAdapter(overrides.keyword);

  if (isSearchConsoleConfigured(env) || overrides.gsc?.siteUrl || overrides.gsc?.accessToken) {
    return new SearchConsoleAdapter({
      siteUrl: overrides.gsc?.siteUrl ?? env.GSC_SITE_URL,
      accessToken: overrides.gsc?.accessToken ?? env.GSC_ACCESS_TOKEN,
      ...overrides.gsc,
    });
  }
  if (isKeywordProviderConfigured(env) || overrides.keyword?.endpointUrl) {
    return new KeywordProviderAdapter({
      endpointUrl: overrides.keyword?.endpointUrl ?? env.KEYWORD_PROVIDER_URL,
      apiKey: overrides.keyword?.apiKey ?? env.KEYWORD_PROVIDER_API_KEY,
      ...overrides.keyword,
    });
  }
  return new DemoSearchProvider();
}

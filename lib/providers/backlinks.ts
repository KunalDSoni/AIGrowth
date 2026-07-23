/**
 * BacklinkProvider (MDM-006) — authority + backlink signals from open data.
 *
 *  - `mock`          : deterministic offline authority; zero dependencies (default).
 *  - `open-pagerank` : Open PageRank free API (domain authority proxy).
 *  - `common-crawl`  : Common Crawl index presence (freshness/coverage proxy).
 *
 * Authority derived from open data is always labelled `estimate` — never `measured`.
 */

import type { MeasurementLabel } from "@/lib/providers/measurement";

export interface BacklinkEdge {
  from: string;
  to: string;
  anchor?: string;
}

export interface AuthorityResult {
  domain: string;
  authorityScore?: number; // 0-100
  backlinks: BacklinkEdge[];
  source: string;
  measurement: MeasurementLabel;
  observedAt: string;
  note?: string;
}

export interface BacklinkProvider {
  readonly source: string;
  authority(domain: string): Promise<AuthorityResult>;
}

function normalizeDomain(domain: string): string {
  return domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "").toLowerCase();
}

function stableHash(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

export class MockBacklinkProvider implements BacklinkProvider {
  readonly source = "mock";

  async authority(domain: string): Promise<AuthorityResult> {
    const d = normalizeDomain(domain);
    return {
      domain: d,
      authorityScore: stableHash(d) % 100,
      backlinks: [{ from: `https://ref-${stableHash(d) % 50}.example.com`, to: `https://${d}`, anchor: d }],
      source: "mock",
      measurement: "estimate",
      observedAt: new Date(0).toISOString(),
    };
  }
}

export class OpenPageRankProvider implements BacklinkProvider {
  readonly source = "open-pagerank";
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async authority(domain: string): Promise<AuthorityResult> {
    const d = normalizeDomain(domain);
    const url = new URL("https://openpagerank.com/api/v1.0/getPageRank");
    url.searchParams.append("domains[]", d);
    const res = await this.fetchImpl(url, { headers: { "API-OPR": this.apiKey } });
    if (!res.ok) throw new Error(`Open PageRank returned ${res.status}`);
    const data = (await res.json()) as { response?: Array<{ page_rank_decimal?: number }> };
    const rank = data.response?.[0]?.page_rank_decimal;
    return {
      domain: d,
      authorityScore: rank !== undefined ? Math.round(rank * 10) : undefined,
      backlinks: [],
      source: "open-pagerank",
      measurement: "estimate",
      observedAt: new Date().toISOString(),
      note: "Authority proxy from Open PageRank; backlink edges not enumerated by this source.",
    };
  }
}

export class CommonCrawlBacklinkProvider implements BacklinkProvider {
  readonly source = "common-crawl";
  constructor(
    private readonly indexUrl = "https://index.commoncrawl.org/CC-MAIN-2024-10-index",
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async authority(domain: string): Promise<AuthorityResult> {
    const d = normalizeDomain(domain);
    const url = new URL(this.indexUrl);
    url.searchParams.set("url", `${d}/*`);
    url.searchParams.set("output", "json");
    url.searchParams.set("limit", "50");
    const res = await this.fetchImpl(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`Common Crawl index returned ${res.status}`);
    const text = await res.text();
    const captures = text.trim() ? text.trim().split(/\r?\n/).length : 0;
    return {
      domain: d,
      authorityScore: Math.min(100, captures * 2),
      backlinks: [],
      source: "common-crawl",
      measurement: "estimate",
      observedAt: new Date().toISOString(),
      note: `Coverage proxy: ${captures} Common Crawl captures. Not a link-graph authority score.`,
    };
  }
}

export function getBacklinkProvider(env: Record<string, string | undefined> = process.env): BacklinkProvider {
  switch (env.OPENGROWTH_BACKLINKS) {
    case "open-pagerank":
      if (env.OPEN_PAGERANK_API_KEY) return new OpenPageRankProvider(env.OPEN_PAGERANK_API_KEY);
      break;
    case "common-crawl":
      return new CommonCrawlBacklinkProvider(env.COMMON_CRAWL_INDEX_URL);
  }
  return new MockBacklinkProvider();
}

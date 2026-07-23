/**
 * SerpProvider (MDM-005) — SERP positions + citation verification.
 *
 *  - `mock`    : deterministic offline results; zero dependencies (default).
 *  - `searxng` : self-hosted SearXNG metasearch (JSON format); no vendor keys.
 *
 * Used to verify that an answer-engine citation actually ranks, and as the
 * derivation path for Google AI Overviews (labelled `estimate`).
 */

import type { MeasurementLabel } from "@/lib/providers/measurement";

export interface SerpResultItem {
  url: string;
  title: string;
  rank: number;
  snippet?: string;
}

export interface SerpResult {
  query: string;
  results: SerpResultItem[];
  source: string;
  measurement: MeasurementLabel;
  observedAt: string;
}

export interface SerpProvider {
  readonly source: string;
  search(query: string, opts?: { market?: string; num?: number }): Promise<SerpResult>;
}

function stableHash(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

export class MockSerpProvider implements SerpProvider {
  readonly source = "mock";

  async search(query: string, opts: { num?: number } = {}): Promise<SerpResult> {
    const num = Math.min(opts.num ?? 5, 10);
    const seed = stableHash(query);
    return {
      query,
      results: Array.from({ length: num }, (_, i) => ({
        url: `https://result-${(seed + i) % 97}.example.com/${encodeURIComponent(query).slice(0, 20)}`,
        title: `${query} — result ${i + 1}`,
        rank: i + 1,
        snippet: "Deterministic mock SERP snippet.",
      })),
      source: "mock",
      measurement: "simulated",
      observedAt: new Date(0).toISOString(),
    };
  }
}

export class SearxngSerpProvider implements SerpProvider {
  readonly source = "searxng";
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async search(query: string, opts: { num?: number } = {}): Promise<SerpResult> {
    const url = new URL("/search", this.baseUrl);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    const res = await this.fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`SearXNG returned ${res.status}`);
    const data = (await res.json()) as { results?: Array<{ url: string; title: string; content?: string }> };
    const num = opts.num ?? 10;
    return {
      query,
      results: (data.results ?? []).slice(0, num).map((r, i) => ({
        url: r.url,
        title: r.title,
        rank: i + 1,
        snippet: r.content,
      })),
      source: "searxng",
      measurement: "measured",
      observedAt: new Date().toISOString(),
    };
  }
}

/** True when `url`'s host appears in the SERP; returns its rank if so. */
export function verifyCitation(serp: SerpResult, url: string): { present: boolean; rank?: number } {
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    return { present: false };
  }
  const hit = serp.results.find((r) => {
    try {
      return new URL(r.url).host === host;
    } catch {
      return false;
    }
  });
  return hit ? { present: true, rank: hit.rank } : { present: false };
}

export function getSerpProvider(env: Record<string, string | undefined> = process.env): SerpProvider {
  if (env.OPENGROWTH_SERP === "searxng" && env.SEARXNG_URL) {
    return new SearxngSerpProvider(env.SEARXNG_URL);
  }
  return new MockSerpProvider();
}

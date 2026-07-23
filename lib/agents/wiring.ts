/**
 * Binds agents to the real engines. This is the only file that knows both the
 * agent contract and the concrete providers, which keeps agents testable.
 */

import { createHash } from "node:crypto";
import { createObserverAgent } from "@/lib/agents/impl/observer";
import type { ObservedGeo, ObservedSeo } from "@/lib/agents/impl/observer";
import { createRegistry } from "@/lib/agents/registry";
import type { AgentRegistry } from "@/lib/agents/registry";
import type { AgentName } from "@/lib/agents/types";
import { runSeoScan } from "@/lib/engines/run-seo-scan";
import { runGeoProbes } from "@/lib/engines/run-geo";
import { GeminiVisibilityProvider } from "@/lib/providers/gemini-visibility";

/** Agents registered so far. Extended as the remaining six land. */
export const LIVE_PIPELINE: AgentName[] = ["observer"];

export function hashPages(pages: { url: string; title: string | null }[]): string {
  const canonical = pages
    .map((page) => `${page.url} ${page.title ?? ""}`)
    .sort()
    .join("");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 32);
}

async function scan(url: string): Promise<ObservedSeo> {
  const result = await runSeoScan(url);
  return {
    score: result.site.score,
    pagesScanned: result.site.pagesScanned,
    contentHash: hashPages(result.pages.map((page) => ({ url: page.url, title: page.title }))),
    issues: result.siteIssues.map((issue) => issue.title),
  };
}

/**
 * Services are empty until the Onboarding agent supplies them from the Vertical
 * Model; runGeoProbes falls back to derived prompts. A missing GEMINI_API_KEY
 * throws GeminiNotConfiguredError, which the Observer degrades to a skip.
 */
async function probe(input: { brand: string; domain: string }): Promise<ObservedGeo> {
  const result = await runGeoProbes({
    brandGuess: input.brand,
    domain: input.domain,
    services: [],
    provider: new GeminiVisibilityProvider(),
  });

  return {
    mentionRate: result.brandMentionRate,
    sampleSize: result.sampleSize,
    model: result.model,
    citedOthers: result.observations
      .flatMap((observation) => observation.citations)
      .filter((citation) => citation.classification === "other")
      .map((citation) => citation.domain),
  };
}

export function buildLiveRegistry(): AgentRegistry {
  return createRegistry([createObserverAgent({ scan, probe })]);
}

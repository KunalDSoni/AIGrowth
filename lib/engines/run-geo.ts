import { deriveGeoPrompts } from "@/lib/engines/prompt-derive";
import { extractBrandSignals } from "@/lib/engines/geo-extract";
import type { GeoObservation, GeoResult } from "@/lib/analyze/types";
import type { GeminiVisibilityProvider } from "@/lib/providers/gemini-visibility";

const MAX_PROMPTS = 8;
const CONCURRENCY = 2;
const TIMEOUT_MS = 20_000;

export interface RunGeoInput {
  brandGuess: string;
  domain: string;
  services: string[];
  provider: GeminiVisibilityProvider;
  runId?: string;
  maxPrompts?: number;
}

async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

export async function runGeoProbes(input: RunGeoInput): Promise<GeoResult> {
  const prompts = deriveGeoPrompts({
    brandGuess: input.brandGuess,
    domain: input.domain,
    services: input.services,
  }).slice(0, input.maxPrompts ?? MAX_PROMPTS);

  const runId = input.runId ?? `geo-${Date.now()}`;
  const errors: string[] = [];
  let tokens = 0;

  const observations = await mapLimit(prompts, CONCURRENCY, async (prompt): Promise<GeoObservation> => {
    const id = `${runId}-${Buffer.from(prompt).toString("base64url").slice(0, 12)}`;
    try {
      const answer = await input.provider.answer(prompt, { timeoutMs: TIMEOUT_MS });
      tokens += (answer.usage?.promptTokens ?? 0) + (answer.usage?.completionTokens ?? Math.ceil(answer.rawText.length / 4));
      const extracted = extractBrandSignals(answer.rawText, input.brandGuess, input.domain);
      return {
        id,
        prompt,
        rawResponse: answer.rawText,
        brandMentioned: extracted.brandMentioned,
        citations: extracted.citations,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "GEO probe failed";
      errors.push(`${prompt}: ${message}`);
      return {
        id,
        prompt,
        rawResponse: "",
        brandMentioned: false,
        citations: [],
        error: message,
      };
    }
  });

  const answered = observations.filter((o) => !o.error && o.rawResponse);
  const mentionRate = answered.length
    ? Math.round((answered.filter((o) => o.brandMentioned).length / answered.length) * 100)
    : 0;
  const allCitations = answered.flatMap((o) => o.citations);
  const firstPartyShare = allCitations.length
    ? Math.round((allCitations.filter((c) => c.classification === "first-party").length / allCitations.length) * 100)
    : 0;

  // Rough flash pricing heuristic for display only (~$0.10 / 1M tokens blended).
  const estimatedUsd = Number(((tokens / 1_000_000) * 0.1).toFixed(6));

  return {
    runId,
    model: input.provider.model,
    sampleSize: answered.length,
    brandMentionRate: mentionRate,
    firstPartyCitationShare: firstPartyShare,
    observations,
    errors,
    cost: { provider: "gemini", estimatedUsd, tokens },
  };
}

import { buildPromptUniverse } from "@/lib/engines/prompt-universe";
import { extractBrandSignals } from "@/lib/engines/geo-extract";
import type { GeoObservation, GeoResult } from "@/lib/analyze/types";

const TARGET_PROMPTS = 24;
const CONCURRENCY = 4;
const TIMEOUT_MS = 25_000;

/** Structural provider interface so sampling is testable with an injected fake. */
export interface GeoAnswerProvider {
  model: string;
  answer(
    prompt: string,
    opts?: { timeoutMs?: number; retries?: number },
  ): Promise<{ rawText: string; usage?: { promptTokens?: number; completionTokens?: number } }>;
}

export interface RunGeoInput {
  brandGuess: string;
  domain: string;
  services: string[];
  audiences?: string[];
  provider: GeoAnswerProvider;
  runId?: string;
  maxPrompts?: number;
  /** When set, use these exact prompts instead of buildPromptUniverse. */
  prompts?: string[];
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
  const prompts = (
    input.prompts ??
    buildPromptUniverse({
      brandGuess: input.brandGuess,
      domain: input.domain,
      services: input.services,
      audiences: input.audiences,
    })
  ).slice(0, input.maxPrompts ?? TARGET_PROMPTS);

  const runId = input.runId ?? `geo-${Date.now()}`;
  const errors: string[] = [];
  let tokens = 0;

  const observations = await mapLimit(
    prompts.map((prompt, index) => ({ prompt, index })),
    CONCURRENCY,
    async ({ prompt, index }): Promise<GeoObservation> => {
      const id = `${runId}-${index}-${Buffer.from(prompt).toString("base64url").slice(0, 24)}`;
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
    },
  );

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

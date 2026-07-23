import type { AIVisibilityObservation, AIVisibilityPromptFamily } from "@/lib/domain/types";

/**
 * Timestamped AI Observation Runner (EPIC AIV-002).
 *
 * Executes a mock AI-visibility provider across a prompt family and stores every
 * answer as a timestamped observation inside a run with status, errors and cost
 * metadata. Variation is driven by a seeded PRNG so runs are *reproducible*:
 * the same seed yields identical observations, while a different seed produces
 * controlled variation — which is exactly what lets the product report variance
 * instead of pretending one answer is a stable ranking.
 */

export type RunStatus = "queued" | "running" | "completed" | "failed";

export interface RunCost {
  provider: string;
  estimatedUsd: number;
  tokens: number;
}

export interface ObservationRun {
  id: string;
  familyId: string;
  status: RunStatus;
  seed: number;
  startedAt: string;
  completedAt?: string;
  sampleSize: number;
  observations: AIVisibilityObservation[];
  errors: string[];
  cost: RunCost;
}

const PLATFORMS: AIVisibilityObservation["platform"][] = ["ChatGPT", "Gemini", "Claude"];

// Deterministic PRNG (mulberry32) — same seed, same sequence, on every machine.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface AIAnswerProvider {
  readonly name: string;
  answer(prompt: string, ctx: { platform: AIVisibilityObservation["platform"]; mentionsBrand: boolean; competitor: string; brand: string; firstPartyDomain: string }): {
    rawResponse: string;
    citations: AIVisibilityObservation["citations"];
    sentiment: AIVisibilityObservation["sentiment"];
  };
}

export interface RunInput {
  family: AIVisibilityPromptFamily;
  runId: string;
  observedAt: string;
  seed: number;
  brand: string;
  firstPartyDomain: string;
  competitors: string[];
  /** Required. The engine never fabricates answers on its own. */
  provider: AIAnswerProvider;
  /** Per-observation token cost estimate; defaults to a small mock number. */
  tokensPerAnswer?: number;
  usdPerThousandTokens?: number;
}

/**
 * Run observations for a prompt family. Never throws for a single-answer
 * failure — an errored answer is recorded and the run continues; the run status
 * becomes "failed" only if the provider is entirely unusable.
 */
export function runObservations(input: RunInput): ObservationRun {
  const provider = input.provider;
  const rand = mulberry32(input.seed);
  const tokensPerAnswer = input.tokensPerAnswer ?? 220;
  const usdPerThousand = input.usdPerThousandTokens ?? 0.5;

  const run: ObservationRun = {
    id: input.runId,
    familyId: input.family.id,
    status: "running",
    seed: input.seed,
    startedAt: input.observedAt,
    sampleSize: 0,
    observations: [],
    errors: [],
    cost: { provider: provider.name, estimatedUsd: 0, tokens: 0 },
  };

  input.family.prompts.forEach((prompt, index) => {
    const platform = PLATFORMS[Math.floor(rand() * PLATFORMS.length) % PLATFORMS.length];
    const mentionsBrand = rand() > 0.5;
    const competitor = input.competitors[Math.floor(rand() * Math.max(1, input.competitors.length)) % Math.max(1, input.competitors.length)] ?? "Competitor";

    try {
      const answer = provider.answer(prompt, {
        platform,
        mentionsBrand,
        competitor,
        brand: input.brand,
        firstPartyDomain: input.firstPartyDomain,
      });
      run.observations.push({
        id: `${input.runId}-${index + 1}`,
        familyId: input.family.id,
        exactPrompt: prompt,
        platform,
        model: `${platform.toLowerCase()}-mock`,
        locale: input.family.geography,
        runId: input.runId,
        observedAt: input.observedAt,
        rawResponse: answer.rawResponse,
        brandMentions: mentionsBrand ? [input.brand] : [],
        competitorMentions: [competitor],
        citations: answer.citations,
        sentiment: answer.sentiment,
        extractionConfidence: mentionsBrand ? 86 : 78,
        isSimulated: true,
      });
      run.cost.tokens += tokensPerAnswer;
    } catch (error) {
      run.errors.push(`Prompt ${index + 1} failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  });

  run.sampleSize = run.observations.length;
  run.cost.estimatedUsd = Math.round((run.cost.tokens / 1000) * usdPerThousand * 10000) / 10000;
  run.completedAt = input.observedAt;
  run.status = run.observations.length === 0 ? "failed" : "completed";
  return run;
}

/** Compare two runs of the same family to quantify answer variability. */
export function runVariance(a: ObservationRun, b: ObservationRun): { mentionRateDelta: number; identical: boolean } {
  const mentionRate = (run: ObservationRun) =>
    run.sampleSize === 0 ? 0 : Math.round((run.observations.filter((o) => o.brandMentions.length > 0).length / run.sampleSize) * 100);
  const identical =
    a.observations.length === b.observations.length &&
    a.observations.every((obs, i) => obs.rawResponse === b.observations[i]?.rawResponse && obs.platform === b.observations[i]?.platform);
  return { mentionRateDelta: Math.abs(mentionRate(a) - mentionRate(b)), identical };
}

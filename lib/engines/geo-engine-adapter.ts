/**
 * GIL-ME-1 — Engine adapters.
 *
 * Present any AnswerEngineProvider as the GeoAnswerProvider that runGeoProbes
 * already consumes, so every engine (Gemini, ChatGPT, Perplexity, Mock) drives
 * the same tested probe → ledger path. Native citation URLs are folded into the
 * answer text so the existing extractBrandSignals classifies them.
 */

import type { AnswerEngineProvider, AnswerObservation } from "@/lib/providers/answer-engine";
import type { GeoAnswerProvider } from "@/lib/engines/run-geo";
import { GeminiVisibilityProvider } from "@/lib/providers/gemini-visibility";

export function answerEngineAsGeoProvider(
  engine: AnswerEngineProvider,
  name: string,
  brand?: string,
): GeoAnswerProvider {
  return {
    model: name,
    async answer(prompt: string) {
      const obs = await engine.ask(prompt, { brand });
      if (obs.error) throw new Error(obs.error);
      const rawText = [obs.answer, ...obs.citations.map((c) => c.url)].filter(Boolean).join("\n");
      return { rawText };
    },
  };
}

interface GeminiLike {
  answer(prompt: string, opts?: { timeoutMs?: number; retries?: number }): Promise<{ rawText: string }>;
}

/** Wrap the Gemini visibility provider as an AnswerEngineProvider for the registry. */
export class GeminiAnswerEngine implements AnswerEngineProvider {
  readonly engines = ["gemini"];
  private provider: GeminiLike;

  constructor(provider?: GeminiLike) {
    this.provider = provider ?? new GeminiVisibilityProvider();
  }

  async ask(prompt: string, opts: { brand?: string } = {}): Promise<AnswerObservation> {
    const { rawText } = await this.provider.answer(prompt);
    return {
      prompt,
      answer: rawText,
      citations: [],
      engine: "gemini",
      source: "gemini",
      measurement: "measured",
      measuredAt: new Date().toISOString(),
      brandMentioned: opts.brand ? rawText.toLowerCase().includes(opts.brand.toLowerCase()) : undefined,
    };
  }
}

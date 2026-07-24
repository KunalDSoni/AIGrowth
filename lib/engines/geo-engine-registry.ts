/**
 * GIL-ME-4 — Configured-engine registry.
 *
 * The single honest source of truth for "which answer engines can we actually
 * measure right now". Mock is always present (and always labelled simulated) so
 * the surface is never empty; live engines are added only when their API key is
 * configured, and are labelled measured.
 */

import {
  MockAnswerEngineProvider,
  OpenAIAnswerEngine,
  PerplexityAnswerEngine,
} from "@/lib/providers/answer-engine";
import { GeminiAnswerEngine } from "@/lib/engines/geo-engine-adapter";
import type { EngineSpec } from "@/lib/engines/geo-multi-engine";

export function getConfiguredEngines(env: Record<string, string | undefined> = process.env): EngineSpec[] {
  const engines: EngineSpec[] = [
    { name: "mock", provider: new MockAnswerEngineProvider(), measurement: "simulated" },
  ];
  if (env.PERPLEXITY_API_KEY) {
    engines.push({
      name: "perplexity",
      provider: new PerplexityAnswerEngine(env.PERPLEXITY_API_KEY),
      measurement: "measured",
    });
  }
  if (env.OPENAI_API_KEY) {
    engines.push({
      name: "openai",
      provider: new OpenAIAnswerEngine(env.OPENAI_API_KEY),
      measurement: "measured",
    });
  }
  if (env.GEMINI_API_KEY) {
    engines.push({ name: "gemini", provider: new GeminiAnswerEngine(), measurement: "measured" });
  }
  return engines;
}

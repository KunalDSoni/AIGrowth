/**
 * GIL-ME-2 — Multi-engine probe orchestrator.
 *
 * Run the prompt universe across each configured engine via the existing
 * runGeoProbes (through the ME-1 adapter), producing one GeoResult per engine.
 * A per-probe failure is already handled inside runGeoProbes (recorded as an
 * unanswered probe); a whole-engine failure is isolated here so one engine can
 * never sink the others.
 */

import type { GeoResult } from "@/lib/analyze/types";
import type { AnswerEngineProvider } from "@/lib/providers/answer-engine";
import { runGeoProbes } from "@/lib/engines/run-geo";
import { answerEngineAsGeoProvider } from "@/lib/engines/geo-engine-adapter";

export interface EngineSpec {
  name: string;
  provider: AnswerEngineProvider;
  measurement: "measured" | "simulated" | "estimate";
}

export interface EngineGeoResult {
  engine: string;
  measurement: EngineSpec["measurement"];
  geo: GeoResult;
  error?: string;
}

function emptyGeo(name: string): GeoResult {
  return {
    runId: `geo-${name}-empty`,
    model: name,
    sampleSize: 0,
    brandMentionRate: 0,
    firstPartyCitationShare: 0,
    observations: [],
    errors: [],
    cost: { provider: "gemini", estimatedUsd: 0, tokens: 0 },
  };
}

export async function runMultiEngineProbes(input: {
  engines: EngineSpec[];
  prompts: string[];
  brandGuess: string;
  domain: string;
  maxPrompts?: number;
}): Promise<EngineGeoResult[]> {
  const results: EngineGeoResult[] = [];
  for (const spec of input.engines) {
    try {
      const geo = await runGeoProbes({
        brandGuess: input.brandGuess,
        domain: input.domain,
        services: [],
        provider: answerEngineAsGeoProvider(spec.provider, spec.name, input.brandGuess),
        prompts: input.prompts,
        maxPrompts: input.maxPrompts,
        runId: `geo-${spec.name}-${Date.now()}`,
      });
      results.push({ engine: spec.name, measurement: spec.measurement, geo });
    } catch (error) {
      const message = error instanceof Error ? error.message : "engine failed";
      results.push({ engine: spec.name, measurement: spec.measurement, geo: emptyGeo(spec.name), error: message });
    }
  }
  return results;
}

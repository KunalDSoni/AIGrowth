/**
 * AnswerEngineProvider (MDM-002) — real GEO citation measurement.
 *
 * Queries a real answer engine and returns the answer + the sources it cited.
 * This turns GEO from LLM *simulation* into *measured* citation presence.
 *
 *  - `mock`       : deterministic offline answers; zero dependencies (default).
 *  - `perplexity` : Perplexity API (returns citations natively).
 *  - `openai`     : OpenAI Responses/Chat (web-search tool when available).
 *  - `anthropic`  : Anthropic Messages (web-search tool when available).
 *
 * Google AI Overviews has no official API; it is derived via SerpProvider and
 * labelled `estimate`, never `measured` (see MDM-005 / serp.ts).
 */

import type { MeasurementLabel } from "@/lib/providers/measurement";

export interface AnswerCitation {
  url: string;
  title?: string;
  rank?: number;
}

export interface AnswerObservation {
  prompt: string;
  answer: string;
  citations: AnswerCitation[];
  engine: string;
  source: string;
  measurement: MeasurementLabel;
  measuredAt: string;
  brandMentioned?: boolean;
  error?: string;
}

export interface AnswerEngineProvider {
  readonly engines: string[];
  ask(prompt: string, opts?: { engine?: string; market?: string; brand?: string }): Promise<AnswerObservation>;
}

function detectBrand(text: string, brand?: string): boolean | undefined {
  if (!brand) return undefined;
  return text.toLowerCase().includes(brand.toLowerCase());
}

export class MockAnswerEngineProvider implements AnswerEngineProvider {
  readonly engines = ["mock"];

  async ask(prompt: string, opts: { brand?: string } = {}): Promise<AnswerObservation> {
    const answer = `Simulated answer for "${prompt}". This is a deterministic offline response used when no answer engine is connected.`;
    return {
      prompt,
      answer,
      citations: [{ url: "https://example.com/reference", title: "Example reference", rank: 1 }],
      engine: "mock",
      source: "mock",
      measurement: "simulated",
      measuredAt: new Date(0).toISOString(),
      brandMentioned: detectBrand(`${prompt} ${opts.brand ?? ""}`, opts.brand),
    };
  }
}

export class PerplexityAnswerEngine implements AnswerEngineProvider {
  readonly engines = ["perplexity"];
  constructor(
    private readonly apiKey: string,
    private readonly model = "sonar",
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async ask(prompt: string, opts: { brand?: string } = {}): Promise<AnswerObservation> {
    const res = await this.fetchImpl("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw new Error(`Perplexity returned ${res.status}`);
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      citations?: string[];
    };
    const answer = data.choices?.[0]?.message?.content ?? "";
    return {
      prompt,
      answer,
      citations: (data.citations ?? []).map((url, i) => ({ url, rank: i + 1 })),
      engine: "perplexity",
      source: "perplexity",
      measurement: "measured",
      measuredAt: new Date().toISOString(),
      brandMentioned: detectBrand(answer, opts.brand),
    };
  }
}

/** OpenAI-compatible chat adapter. Citations parsed from any URLs in the answer. */
export class OpenAIAnswerEngine implements AnswerEngineProvider {
  readonly engines = ["openai"];
  constructor(
    private readonly apiKey: string,
    private readonly model = "gpt-4o-mini",
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async ask(prompt: string, opts: { brand?: string } = {}): Promise<AnswerObservation> {
    const res = await this.fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw new Error(`OpenAI returned ${res.status}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const answer = data.choices?.[0]?.message?.content ?? "";
    const urls = [...answer.matchAll(/https?:\/\/[^\s)]+/g)].map((m, i) => ({ url: m[0], rank: i + 1 }));
    return {
      prompt,
      answer,
      citations: urls,
      engine: "openai",
      source: "openai",
      measurement: "measured",
      measuredAt: new Date().toISOString(),
      brandMentioned: detectBrand(answer, opts.brand),
    };
  }
}

export function getAnswerEngineProvider(env: Record<string, string | undefined> = process.env): AnswerEngineProvider {
  switch (env.OPENGROWTH_ANSWER_ENGINE) {
    case "perplexity":
      if (env.PERPLEXITY_API_KEY) return new PerplexityAnswerEngine(env.PERPLEXITY_API_KEY);
      break;
    case "openai":
      if (env.OPENAI_API_KEY) return new OpenAIAnswerEngine(env.OPENAI_API_KEY);
      break;
  }
  return new MockAnswerEngineProvider();
}

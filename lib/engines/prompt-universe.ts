/**
 * Structured buyer-intent prompt universe for answer-engine sampling. Generic
 * questions only — never bio prompts, never invented company specifics. Only
 * real services and audiences from the profile are interpolated.
 */

import { isHallucinationPronePrompt } from "@/lib/engines/prompt-derive";

export interface PromptUniverseInput {
  brandGuess: string;
  domain: string;
  services: string[];
  audiences?: string[];
}

const INTENT_TEMPLATES: ((service: string) => string)[] = [
  (s) => `Best ${s} providers`,
  (s) => `Best ${s} companies to hire`,
  (s) => `Top ${s} companies`,
  (s) => `Which company should I hire for ${s}?`,
  (s) => `How do I choose a ${s} provider?`,
  (s) => `What should I look for in a ${s} provider?`,
  (s) => `How much does ${s} cost?`,
  (s) => `Recommended ${s} providers for small businesses`,
];

const MAX_PROMPTS = 40;

export function buildPromptUniverse(input: PromptUniverseInput): string[] {
  const brand = input.brandGuess.trim() || input.domain;
  const domain = input.domain.replace(/^www\./, "");
  const services = (input.services.length ? input.services : ["professional services"]).slice(0, 3);
  const audiences = (input.audiences ?? []).slice(0, 2);

  const prompts: string[] = [];

  for (const service of services) {
    for (const template of INTENT_TEMPLATES) prompts.push(template(service));
    prompts.push(`${brand} (${domain}) vs alternatives for ${service}`);
  }

  for (const service of services.slice(0, 2)) {
    for (const audience of audiences) prompts.push(`Best ${service} providers for ${audience}`);
  }

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const prompt of prompts) {
    const key = prompt.toLowerCase();
    if (seen.has(key) || isHallucinationPronePrompt(prompt)) continue;
    seen.add(key);
    deduped.push(prompt);
  }

  return deduped.slice(0, MAX_PROMPTS);
}

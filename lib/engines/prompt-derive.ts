/**
 * Derive a thin GEO prompt set from crawl signals (no LLM required).
 *
 * Important: do NOT use "Who is {brand}?" style prompts. Models invent confident
 * company bios from the name alone (e.g. DiligenceOS → fake due-diligence SaaS).
 * GEO probes should mimic buyer questions used to measure organic AI visibility.
 */

export interface PromptDeriveInput {
  brandGuess: string;
  domain: string;
  services: string[];
}

const MAX_PROMPTS = 8;

export function guessBrandFromTitle(title: string | null | undefined, hostname: string): string {
  const hostLabel = hostname.replace(/^www\./, "").split(".")[0] ?? hostname;
  if (!title?.trim()) return capitalize(hostLabel);
  const cleaned = title.split(/[|\-–—]/)[0]?.trim() ?? title.trim();
  if (cleaned.length >= 2 && cleaned.length <= 60) return cleaned;
  return capitalize(hostLabel);
}

export function extractServicePhrases(texts: string[], limit = 3): string[] {
  const stop = new Set(["the", "and", "for", "with", "your", "our", "from", "this", "that", "home", "page", "welcome"]);
  const scores = new Map<string, number>();
  for (const text of texts) {
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stop.has(w));
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      scores.set(bigram, (scores.get(bigram) ?? 0) + 2);
      scores.set(words[i], (scores.get(words[i]) ?? 0) + 1);
    }
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([phrase]) => phrase)
    .filter((phrase) => phrase.includes(" ") || phrase.length > 5)
    .slice(0, limit);
}

export function deriveGeoPrompts(input: PromptDeriveInput): string[] {
  const brand = input.brandGuess.trim() || input.domain;
  const domain = input.domain.replace(/^www\./, "");
  const brandRef = `${brand} (${domain})`;
  const services = input.services.length ? input.services.slice(0, 3) : ["professional services"];
  const primary = services[0];

  // Buyer-intent / visibility prompts only — never "Who is {brand}?" bios.
  const prompts = [
    `Best ${primary} providers`,
    `Best ${primary} companies to hire`,
    `Which company should I hire for ${primary}?`,
    `Recommended options for ${primary}`,
    `${brandRef} vs alternatives for ${primary}`,
    `Providers similar to ${brandRef} for ${primary}`,
  ];
  if (services[1]) prompts.push(`Best ${services[1]} providers`);
  if (services[2]) prompts.push(`Top ${services[2]} recommendations`);

  return [...new Set(prompts)].slice(0, MAX_PROMPTS);
}

/** True when a prompt is a bio-style question we no longer emit (kept for tests/guards). */
export function isHallucinationPronePrompt(prompt: string): boolean {
  return /^\s*who is\b/i.test(prompt) || /^\s*what is\b/i.test(prompt);
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

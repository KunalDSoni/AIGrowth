import { GeminiNotConfiguredError, GeminiVisibilityProvider } from "@/lib/providers/gemini-visibility";
import type { ActionBriefPackage } from "@/lib/engines/action-brief";
import { generateDraft, type DraftAsset } from "@/lib/engines/brief-builder";

/**
 * Generate a claim-aware draft from an evidence-grounded brief via Gemini.
 */
export async function draftFromBrief(
  pkg: ActionBriefPackage,
  provider: GeminiVisibilityProvider,
): Promise<DraftAsset> {
  const prompt = [
    "Write a first draft web page section for the business below.",
    "Rules:",
    "- Use ONLY the site facts and brief. Do not invent clients, stats, awards, or guarantees.",
    "- If a fact is unknown, write a clear placeholder like [CONFIRM: …].",
    "- Plain professional tone. Markdown with H2/H3.",
    "- Include the suggested title as H1 and end with the CTA.",
    "",
    `Suggested title: ${pkg.suggestedTitle}`,
    `Suggested meta: ${pkg.suggestedMetaDescription}`,
    `Objective: ${pkg.brief.objective}`,
    `Audience: ${pkg.brief.audience}`,
    `CTA: ${pkg.brief.cta}`,
    "",
    "Site facts:",
    ...pkg.siteFacts.map((f) => `- ${f}`),
    "",
    "Outline:",
    ...pkg.outline.map((o, i) => `${i + 1}. ${o}`),
    "",
    "Claims to avoid inventing:",
    ...pkg.brief.claimsToVerify.map((c) => `- ${c}`),
    "",
    pkg.citedOtherDomains.length
      ? `Other domains often cited in AI answers (do not attack; differentiate honestly): ${pkg.citedOtherDomains.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const answer = await provider.answer(prompt, { timeoutMs: 45_000 });
  const body = answer.rawText.trim() || `# ${pkg.suggestedTitle}\n\n[Draft unavailable — empty model response]`;
  return generateDraft(pkg.brief, body, 1);
}

export { GeminiNotConfiguredError };

/**
 * GIL-08 — Answer-optimized draft + claim-check.
 *
 * Turns a GIL-07 ContentBrief into a gated DraftAsset. Rather than fabricate
 * company specifics (forbidden), it assembles a structured, claim-safe scaffold
 * from the brief — the buyer question to answer, the proof the page must include,
 * the CTA, the claims to verify, and the measurement plan — for the crew or a
 * human to fill with verifiable content. The result runs through the existing
 * claim-checker and starts in "draft": external publishing always needs approval.
 *
 * An LLM-authored body can be substituted via `assembleFixDraft(brief, body)`;
 * it goes through the same claim-check gate.
 */

import { generateDraft, type ContentBrief, type DraftAsset } from "@/lib/engines/brief-builder";

export function scaffoldFromBrief(brief: ContentBrief): string {
  const checklist = (items: string[]) =>
    items.length ? items.map((i) => `- [ ] ${i}`).join("\n") : "- [ ] (none)";

  return [
    `# ${brief.objective}`,
    "",
    "_Draft scaffold — fill each section with verifiable specifics. Do not add unsupported claims._",
    "",
    `**Audience:** ${brief.audience}`,
    `**Search intent:** ${brief.intent}`,
    "",
    "## What this page must include",
    checklist(brief.proofRequirements),
    "",
    "## Call to action",
    brief.cta,
    "",
    "## Verify before publishing",
    checklist(brief.claimsToVerify),
    "",
    "## Measurement",
    brief.measurementPlan.map((m) => `- ${m}`).join("\n"),
    "",
  ].join("\n");
}

/** Assemble a gated draft from an explicit body (e.g. crew/LLM output). */
export function assembleFixDraft(brief: ContentBrief, body: string, version = 1): DraftAsset {
  return generateDraft(brief, body, version);
}

/** Assemble a gated draft from the claim-safe scaffold. */
export function draftFixAsset(brief: ContentBrief): DraftAsset {
  return generateDraft(brief, scaffoldFromBrief(brief));
}

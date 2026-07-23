/**
 * Deterministic metadata pack from a brief (GEN-003) — no LLM required.
 */

import type { ActionBriefPackage } from "@/lib/engines/action-brief";

export interface MetadataPack {
  title: string;
  description: string;
  h1: string;
  rationale: string[];
  assetType: "metadata" | "service" | "article" | "faq" | "social" | "email";
  claimsFlagged: string[];
}

export function buildMetadataPack(pkg: ActionBriefPackage, assetType: MetadataPack["assetType"] = "metadata"): MetadataPack {
  const title = pkg.suggestedTitle.slice(0, 60);
  const description = pkg.suggestedMetaDescription.slice(0, 155);
  const h1 = pkg.outline[0]?.replace(/^H1:\s*/i, "") || title;
  return {
    title,
    description,
    h1,
    rationale: [
      "Title and description derived from the evidence-grounded brief only.",
      "No fabricated statistics or competitor claims were added.",
      ...pkg.brief.claimsToVerify.slice(0, 3).map((c) => `Verify before publish: ${c}`),
    ],
    assetType,
    claimsFlagged: pkg.brief.claimsToVerify,
  };
}

export function buildRepurposePack(pkg: ActionBriefPackage): {
  linkedin: string;
  emailSubject: string;
  emailBody: string;
  gbp: string;
} {
  const topic = pkg.suggestedTitle;
  return {
    linkedin: `New resource: ${topic}\n\n${pkg.brief.objective}\n\nBuilt from live site evidence — not generic AI filler.`,
    emailSubject: topic.slice(0, 60),
    emailBody: `Hi,\n\nWe published guidance on: ${topic}.\n\n${pkg.brief.objective}\n\nKey points:\n${pkg.outline.slice(0, 4).map((l) => `- ${l}`).join("\n")}\n`,
    gbp: `${topic} — ${pkg.brief.objective}`.slice(0, 280),
  };
}

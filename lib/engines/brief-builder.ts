import type { EvidenceReference } from "@/lib/domain/types";

/**
 * Evidence-Grounded Brief Builder + Claim-Safe Draft (EPIC GEN-001 / GEN-002).
 *
 * A brief is assembled from a recommendation and its evidence chain, never from a
 * generic prompt. Drafts generated from a brief flag unsupported claims and start
 * in a "draft" state — external publishing always requires human approval.
 */

export type ContentType = "service" | "local" | "comparison" | "faq" | "how-to" | "article";

export interface ContentBrief {
  id: string;
  recommendationId: string;
  contentType: ContentType;
  objective: string;
  audience: string;
  intent: string;
  evidenceIds: string[];
  proofRequirements: string[];
  internalLinks: string[];
  cta: string;
  measurementPlan: string[];
  claimsToVerify: string[];
}

const PROOF_BY_TYPE: Record<ContentType, string[]> = {
  service: ["Concrete description of what the service includes", "At least one client outcome or case reference", "Pricing or engagement model clarity"],
  local: ["Genuine local presence or service coverage", "Local proof (reviews, projects, team)", "Location-specific FAQ"],
  comparison: ["Fair, accurate comparison of each option", "Sources for any factual claims", "Clear statement of which option fits which need"],
  faq: ["Questions taken from real customer interactions", "Accurate, current answers"],
  "how-to": ["Steps that actually work end to end", "Screenshots or examples where helpful"],
  article: ["Original insight beyond generic summaries", "Citations for statistics or external claims"],
};

const CTA_BY_TYPE: Record<ContentType, string> = {
  service: "Book a consultation",
  local: "Request a local consultation",
  comparison: "Get an expert recommendation",
  faq: "Ask us your question",
  "how-to": "Get help implementing this",
  article: "Talk to a specialist",
};

export function buildBrief(input: {
  recommendationId: string;
  contentType: ContentType;
  objective: string;
  audience: string;
  intent: string;
  evidence: EvidenceReference[];
  internalLinks?: string[];
  cta?: string;
}): ContentBrief {
  // Any estimated or simulated evidence becomes an explicit claim to verify
  // before the asset can be trusted or published.
  const claimsToVerify = input.evidence
    .filter((e) => e.isEstimated || e.isSimulated || e.kind === "AI_INFERENCE")
    .map((e) => `Verify: ${e.summary}`);

  return {
    id: `brief-${input.recommendationId}`,
    recommendationId: input.recommendationId,
    contentType: input.contentType,
    objective: input.objective,
    audience: input.audience,
    intent: input.intent,
    evidenceIds: input.evidence.map((e) => e.id),
    proofRequirements: PROOF_BY_TYPE[input.contentType],
    internalLinks: input.internalLinks ?? [],
    cta: input.cta ?? CTA_BY_TYPE[input.contentType],
    measurementPlan: [
      "Record publish date as the implementation event.",
      "Compare a 30-90 day window after indexing against the prior baseline.",
      "Track leading indicators (impressions, clicks, enquiries) without claiming guaranteed causation.",
    ],
    claimsToVerify,
  };
}

export type ApprovalState = "draft" | "in-review" | "approved" | "rejected";

export interface ClaimFlag {
  text: string;
  reason: string;
}

export interface DraftAsset {
  id: string;
  briefId: string;
  version: number;
  body: string;
  claimFlags: ClaimFlag[];
  approvalState: ApprovalState;
  requiresApprovalToPublish: boolean;
}

// Patterns that assert authority the system cannot verify on its own.
const UNSUPPORTED_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /\b(guarantee|guaranteed|guarantees)\b/i, reason: "Guarantee claims cannot be substantiated." },
  { re: /\bnumber one\b|#\s?1\b|\bbest in (the )?(world|country|market)\b/i, reason: "Superlative ranking claim needs evidence." },
  { re: /\b(the )?(leading|top-rated|award-winning)\b/i, reason: "Authority claim needs a verifiable source." },
  { re: /\b\d+%\s+(more|better|faster|increase|growth)\b/i, reason: "Quantified performance claim needs a source." },
  { re: /\b(certified|accredited|licensed)\b/i, reason: "Credential claim must be confirmed before publishing." },
];

export function flagClaims(body: string): ClaimFlag[] {
  const flags: ClaimFlag[] = [];
  for (const sentence of body.split(/(?<=[.!?])\s+/)) {
    for (const pattern of UNSUPPORTED_PATTERNS) {
      if (pattern.re.test(sentence)) {
        flags.push({ text: sentence.trim(), reason: pattern.reason });
      }
    }
  }
  return flags;
}

export function generateDraft(brief: ContentBrief, body: string, version = 1): DraftAsset {
  return {
    id: `${brief.id}-v${version}`,
    briefId: brief.id,
    version,
    body,
    claimFlags: flagClaims(body),
    approvalState: "draft",
    requiresApprovalToPublish: true,
  };
}

export function transitionApproval(asset: DraftAsset, next: ApprovalState): DraftAsset {
  // A draft with unresolved claim flags cannot jump straight to approved.
  if (next === "approved" && asset.claimFlags.length > 0) {
    throw new Error(`Cannot approve ${asset.id}: ${asset.claimFlags.length} unresolved claim flag(s) must be reviewed first.`);
  }
  return { ...asset, approvalState: next };
}

export function diffVersions(previous: DraftAsset, next: DraftAsset): { added: string[]; removed: string[] } {
  const prevLines = new Set(previous.body.split("\n"));
  const nextLines = new Set(next.body.split("\n"));
  return {
    added: [...nextLines].filter((line) => !prevLines.has(line) && line.trim() !== ""),
    removed: [...prevLines].filter((line) => !nextLines.has(line) && line.trim() !== ""),
  };
}

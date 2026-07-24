/**
 * GIL-07 — Fix → crew-brief adapter.
 *
 * Maps a GIL-05 CitationFix onto the existing evidence-grounded ContentBrief
 * (brief-builder.ts) so the agent crew drafts against a structured brief, never
 * a generic prompt. Thin and pure — it chooses the content type and frames the
 * objective/intent, then delegates to `buildBrief` (which derives proof
 * requirements, measurement plan, and claims-to-verify from the evidence chain).
 */

import type { EvidenceReference } from "@/lib/domain/types";
import { buildBrief, type ContentBrief, type ContentType } from "@/lib/engines/brief-builder";
import type { CitationFix } from "@/lib/engines/geo-citation-fix";
import type { FixTypeId } from "@/lib/engines/geo-fix-taxonomy";

/** Documented mapping from a fix type to the brief's content type. */
const CONTENT_TYPE_BY_FIX: Record<FixTypeId, ContentType> = {
  "direct-answer": "article",
  "faq-block": "faq",
  "comparison-page": "comparison",
  "pricing-page": "service",
  "freshness-refresh": "article",
  "structured-data": "article",
  "proof-block": "service",
};

export interface FixBriefContext {
  evidence: EvidenceReference[];
  audience?: string;
  internalLinks?: string[];
}

export function citationFixToBrief(fix: CitationFix, ctx: FixBriefContext): ContentBrief {
  const contentType = CONTENT_TYPE_BY_FIX[fix.fixTypeId];
  const relevantEvidence = ctx.evidence.filter((e) => fix.evidenceIds.includes(e.id));

  const intent = fix.affectedPrompts.length
    ? `Be citable in AI answers for prompts like: ${fix.affectedPrompts.slice(0, 3).join("; ")}`
    : `Become citable for the "${fix.feature}" answer-fitness signal`;

  return buildBrief({
    recommendationId: fix.id,
    contentType,
    objective: `${fix.title}: ${fix.whatToCreate}`,
    audience: ctx.audience ?? "prospective buyers evaluating providers",
    intent,
    evidence: relevantEvidence,
    internalLinks: ctx.internalLinks,
  });
}

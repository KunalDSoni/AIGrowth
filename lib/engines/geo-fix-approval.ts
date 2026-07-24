/**
 * GIL-09 — Approval + provenance.
 *
 * The human approval gate for a fix draft, plus the provenance record that links
 * an approved asset back to the fix, the affected prompts, and the evidence — the
 * link the change ledger (GIL-10) and lift attribution (GIL-11) consume.
 *
 * Approval is never anonymous and never automatic: an approver identity is
 * required, and a draft with unresolved claim flags cannot be approved (the
 * existing `transitionApproval` gate enforces this).
 */

import { transitionApproval, type DraftAsset } from "@/lib/engines/brief-builder";
import type { CitationFix } from "@/lib/engines/geo-citation-fix";
import type { AnswerFitnessFlag } from "@/lib/engines/geo-brand-gap-diff";
import type { FixTypeId } from "@/lib/engines/geo-fix-taxonomy";

export interface FixProvenance {
  assetId: string;
  briefId: string;
  fixId: string;
  fixTypeId: FixTypeId;
  feature: AnswerFitnessFlag;
  affectedPrompts: string[];
  evidenceIds: string[];
  approvedAt: string;
  approvedBy: string;
}

export interface ApprovedFixAsset {
  asset: DraftAsset;
  provenance: FixProvenance;
}

export function approveFixAsset(input: {
  asset: DraftAsset;
  fix: CitationFix;
  approvedBy: string;
  now?: Date;
}): ApprovedFixAsset {
  const approvedBy = input.approvedBy.trim();
  if (!approvedBy) {
    throw new Error("Approval requires an approver identity — fixes are never auto-approved.");
  }

  // Enforces the claim-flag gate; throws if unresolved claims remain.
  const asset = transitionApproval(input.asset, "approved");

  const provenance: FixProvenance = {
    assetId: asset.id,
    briefId: asset.briefId,
    fixId: input.fix.id,
    fixTypeId: input.fix.fixTypeId,
    feature: input.fix.feature,
    affectedPrompts: [...input.fix.affectedPrompts],
    evidenceIds: [...input.fix.evidenceIds],
    approvedAt: (input.now ?? new Date()).toISOString(),
    approvedBy,
  };

  return { asset, provenance };
}

/**
 * MLE-6b — Correction Playbook (Machine Legibility Engine, Frontier 4).
 *
 * Turns correctable gaps into concrete, sourced correction drafts and gates them
 * behind human approval. The integrity guard is absolute:
 *
 *  - Only a gap backed by a source (verified truth or a published Frontier-3
 *    study) becomes a draft; unsourced/unconfirmed gaps are skipped with a
 *    reason, never drafted as a claim.
 *  - Corrections to third-party properties carry an honest disclaimer — "we can
 *    prepare this edit, but the platform decides." The engine never auto-submits.
 *  - Approval requires a named human; an unsourced draft cannot be approved.
 *
 * This mirrors the GEO fix-approval gate: nothing outward-facing happens without
 * a named human and a defensible source.
 */

import type {
  AnswerEngineLensReport,
  AnswerEngineLensItem,
  CorrectionChannel,
} from "@/lib/engines/legibility-answer-engine-lens";

/** Channels the account owns vs third-party properties it can only request edits on. */
const THIRD_PARTY_CHANNELS = new Set<CorrectionChannel>([
  "wikidata",
  "wikipedia",
  "review-sites",
  "reddit",
]);

export interface CorrectionDraft {
  id: string;
  attribute: string;
  /** The value machines currently believe (absent for a missing-fact gap). */
  from?: string;
  /** The verified value to publish. */
  to: string;
  channels: CorrectionChannel[];
  sourced: boolean;
  fueledByStudy?: string;
  /** True when any target channel is a third-party property. */
  touchesThirdParty: boolean;
  disclaimer: string;
  status: "proposed";
}

export interface CorrectionPlaybook {
  subject: string;
  drafts: CorrectionDraft[];
  skipped: { attribute: string; reason: string }[];
}

export interface ApprovedCorrection {
  draft: CorrectionDraft;
  approvedBy: string;
  approvedAt: string;
  /** Honest statement of what approval does and does not guarantee. */
  note: string;
}

export const PLAYBOOK_VERSION = 1;

function draftFor(item: AnswerEngineLensItem, index: number): CorrectionDraft | null {
  // No source, or nothing to publish → not a draftable correction.
  if (!item.correctable || !item.truth || !item.truth.trim()) return null;

  const touchesThirdParty = item.channels.some((c) => THIRD_PARTY_CHANNELS.has(c));
  const disclaimer = touchesThirdParty
    ? "We can prepare this edit, but the third-party platform decides whether it lands. Nothing is submitted automatically."
    : "This correction lands on properties you control. Nothing is submitted automatically.";

  return {
    id: `correction:${item.attribute}:${index}`,
    attribute: item.attribute,
    from: item.machineBelief,
    to: item.truth,
    channels: item.channels,
    sourced: true,
    fueledByStudy: item.fueledByStudy,
    touchesThirdParty,
    disclaimer,
    status: "proposed",
  };
}

/** Build the playbook from the answer-engine lens report. */
export function buildCorrectionPlaybook(lens: AnswerEngineLensReport): CorrectionPlaybook {
  const drafts: CorrectionDraft[] = [];
  const skipped: { attribute: string; reason: string }[] = [];

  lens.items.forEach((item, i) => {
    const draft = draftFor(item, i);
    if (draft) drafts.push(draft);
    else {
      skipped.push({
        attribute: item.attribute,
        reason: item.correctable
          ? "No verified value to publish."
          : "Not backed by a source — substantiate the fact before correcting.",
      });
    }
  });

  return { subject: lens.subject, drafts, skipped };
}

/**
 * Human-gated approval. Requires a named approver and a sourced draft; throws
 * otherwise. Approval authorizes *preparation and submission by a human* — it
 * never itself edits a third-party property.
 */
export function approveCorrection(
  draft: CorrectionDraft,
  input: { approvedBy: string; now?: Date },
): ApprovedCorrection {
  const approvedBy = input.approvedBy.trim();
  if (!approvedBy) {
    throw new Error("Approving a correction requires a named approver — corrections are never auto-approved.");
  }
  if (!draft.sourced) {
    throw new Error("Cannot approve an unsourced correction — substantiate the fact first.");
  }

  const note = draft.touchesThirdParty
    ? "Approved for a human to submit. The third-party platform makes the final call; we will not claim it landed until it does."
    : "Approved for a human to publish on owned properties.";

  return {
    draft,
    approvedBy,
    approvedAt: (input.now ?? new Date()).toISOString(),
    note,
  };
}

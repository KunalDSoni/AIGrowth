/**
 * GIL-10 — Change ledger (intervention record).
 *
 * When an approved fix ships, record what changed, when, on which prompts — plus
 * a baseline snapshot of the citation state on the *affected* prompts at ship
 * time. That baseline is what GIL-11 measures the post-change re-probe against to
 * attribute lift. Pure record construction; a durable store can persist it.
 */

import type { CitationLedger } from "@/lib/analyze/types";
import type { FixProvenance } from "@/lib/engines/geo-fix-approval";
import type { AnswerFitnessFlag } from "@/lib/engines/geo-brand-gap-diff";
import type { FixTypeId } from "@/lib/engines/geo-fix-taxonomy";

export interface CitationBaseline {
  runId: string;
  targetPromptCount: number; // how many prompts the fix targets
  answered: number;          // of those, how many probes were answered at baseline
  brandCited: number;        // of the answered, how many already cited the brand
  citedShare: number;        // brandCited / answered (0 when answered is 0), 0..1 2dp
}

export interface InterventionRecord {
  id: string;
  assetId: string;
  fixId: string;
  fixTypeId: FixTypeId;
  feature: AnswerFitnessFlag;
  affectedPrompts: string[];
  shippedAt: string;
  baseline: CitationBaseline;
}

export function recordIntervention(input: {
  provenance: FixProvenance;
  ledger: CitationLedger;
  shippedAt?: Date;
}): InterventionRecord {
  const { provenance, ledger } = input;
  const targeted = new Set(provenance.affectedPrompts);

  const answeredRecords = ledger.records.filter(
    (r) => targeted.has(r.promptId) && r.status !== "unanswered",
  );
  const answered = answeredRecords.length;
  const brandCited = answeredRecords.filter((r) => r.brandCited).length;
  const citedShare = answered ? Math.round((brandCited / answered) * 100) / 100 : 0;

  return {
    id: `intervention-${provenance.assetId}`,
    assetId: provenance.assetId,
    fixId: provenance.fixId,
    fixTypeId: provenance.fixTypeId,
    feature: provenance.feature,
    affectedPrompts: [...provenance.affectedPrompts],
    shippedAt: (input.shippedAt ?? new Date()).toISOString(),
    baseline: {
      runId: ledger.runId,
      targetPromptCount: provenance.affectedPrompts.length,
      answered,
      brandCited,
      citedShare,
    },
  };
}

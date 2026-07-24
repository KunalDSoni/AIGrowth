/**
 * OPS-2 — Ship a fix (compose).
 *
 * Runs the Draft+Gate→record chain for one approved fix, without I/O:
 *   brief (GIL-07) → claim-safe scaffold draft (GIL-08) → human approval +
 *   provenance (GIL-09) → intervention record with baseline (GIL-10).
 *
 * The route persists the returned intervention. Approval still enforces its gate
 * (no anonymous approver, no unresolved claim flags), so shipping is never silent.
 */

import type { AnalyzeResult } from "@/lib/analyze/types";
import { buildCitationLedger } from "@/lib/engines/geo-citation-ledger";
import { citationFixToBrief } from "@/lib/engines/geo-fix-brief";
import { draftFixAsset } from "@/lib/engines/geo-fix-draft";
import { approveFixAsset, type ApprovedFixAsset } from "@/lib/engines/geo-fix-approval";
import { recordIntervention, type InterventionRecord } from "@/lib/engines/geo-intervention";
import type { CitationFix } from "@/lib/engines/geo-citation-fix";

export function shipFix(input: {
  result: AnalyzeResult;
  fix: CitationFix;
  approvedBy: string;
  now?: Date;
}): { intervention: InterventionRecord; asset: ApprovedFixAsset } {
  const evidenceIds = (input.result.evidence ?? []).map((e) => e.id).slice(0, 6);
  const ledger = buildCitationLedger(input.result.geo, { evidenceIds });

  const brief = citationFixToBrief(input.fix, { evidence: input.result.evidence ?? [] });
  const draft = draftFixAsset(brief);
  const asset = approveFixAsset({ asset: draft, fix: input.fix, approvedBy: input.approvedBy, now: input.now });

  const intervention = recordIntervention({ provenance: asset.provenance, ledger, shippedAt: input.now });
  return { intervention, asset };
}

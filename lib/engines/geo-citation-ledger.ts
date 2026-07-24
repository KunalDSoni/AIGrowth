import type {
  CitationLedger,
  GeoResult,
  PromptCitationRecord,
  PromptCitationStatus,
} from "@/lib/analyze/types";

const MIN_SAMPLE = 3;

/**
 * Turn a GeoResult into a per-prompt citation ledger (GIL-01).
 *
 * Pure derivation over already-persisted probe results — no store, no network.
 * Separates brand *mention* (name in text) from brand *citation* (first-party
 * link), and preserves each prompt's cited competitor sources so later Influence
 * Loop stages can diagnose "who beat us on this exact prompt".
 */
export function buildCitationLedger(
  geo: GeoResult,
  opts?: { evidenceIds?: string[] },
): CitationLedger {
  const records: PromptCitationRecord[] = geo.observations.map((o) => {
    const unanswered = Boolean(o.error) || !o.rawResponse;
    const brandCited = o.citations.some((c) => c.classification === "first-party");
    const brandMentioned = o.brandMentioned;
    const competitorDomains = [
      ...new Set(o.citations.filter((c) => c.classification === "other").map((c) => c.domain)),
    ];

    let status: PromptCitationStatus;
    if (unanswered) status = "unanswered";
    else if (brandCited) status = "cited";
    else if (brandMentioned) status = "mentioned-not-cited";
    else status = "absent";

    return {
      promptId: o.id,
      prompt: o.prompt,
      status,
      brandMentioned,
      brandCited,
      competitorDomains,
      citedSources: o.citations,
    };
  });

  const answered = records.filter((r) => r.status !== "unanswered");
  const sampleSize = answered.length;

  const freq = new Map<string, number>();
  for (const r of answered) {
    for (const domain of r.competitorDomains) {
      freq.set(domain, (freq.get(domain) ?? 0) + 1);
    }
  }
  const competitorFrequency = [...freq.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain));

  const coverage = {
    cited: records.filter((r) => r.status === "cited").length,
    mentionedNotCited: records.filter((r) => r.status === "mentioned-not-cited").length,
    absent: records.filter((r) => r.status === "absent").length,
    unanswered: records.filter((r) => r.status === "unanswered").length,
  };

  return {
    runId: geo.runId,
    model: geo.model,
    sampleSize,
    records,
    competitorFrequency,
    coverage,
    reliable: sampleSize >= MIN_SAMPLE,
    evidenceIds: opts?.evidenceIds ?? [],
  };
}

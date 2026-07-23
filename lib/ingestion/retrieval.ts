/**
 * Retrieval-backed evidence (OSI-012).
 *
 * Thin helpers over the EvidenceIndex for citation-matching, RAG lookups, and
 * the "insufficient evidence" check. Retrieval never manufactures a citation it
 * cannot evidence: when the top score is below threshold we say so explicitly.
 */

import type { EvidenceHit, EvidenceIndex, EvidenceQuery } from "@/lib/providers/evidence-index";

export interface RetrievalResult {
  query: string;
  hits: EvidenceHit[];
  sufficient: boolean;
  topScore: number;
  /** Honest label when evidence is thin. */
  verdict: "sufficient" | "insufficient" | "directional";
}

export async function retrieveEvidence(
  index: EvidenceIndex,
  query: string,
  opts: { k?: number; filters?: EvidenceQuery["filters"]; threshold?: number } = {},
): Promise<RetrievalResult> {
  const k = opts.k ?? 5;
  const threshold = opts.threshold ?? 0.35;
  const hits = await index.search({ text: query, filters: opts.filters, k });
  const topScore = hits[0]?.score ?? 0;
  let verdict: RetrievalResult["verdict"];
  if (!hits.length || topScore < threshold * 0.5) verdict = "insufficient";
  else if (topScore < threshold) verdict = "directional";
  else verdict = "sufficient";
  return { query, hits, sufficient: verdict === "sufficient", topScore, verdict };
}

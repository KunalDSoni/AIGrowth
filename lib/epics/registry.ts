/**
 * Canonical registry of all 138 EPIC_INDEX epics.
 * Every epic must have a runner that returns a non-empty result object.
 */

export const ALL_EPIC_IDS = [
  "BIZ-001","BIZ-002","BIZ-003","BIZ-004","BIZ-005","BIZ-006","BIZ-007","BIZ-008","BIZ-009","BIZ-010","BIZ-011","BIZ-012",
  "CRAWL-001","CRAWL-002","CRAWL-003","CRAWL-004","CRAWL-005","CRAWL-006","CRAWL-007","CRAWL-008","CRAWL-009","CRAWL-010","CRAWL-011","CRAWL-012",
  "TSEO-001","TSEO-002","TSEO-003","TSEO-004","TSEO-005","TSEO-006","TSEO-007","TSEO-008","TSEO-009","TSEO-010","TSEO-011","TSEO-012",
  "SEARCH-001","SEARCH-002","SEARCH-003","SEARCH-004","SEARCH-005","SEARCH-006","SEARCH-007","SEARCH-008","SEARCH-009","SEARCH-010","SEARCH-011","SEARCH-012",
  "CONTENT-001","CONTENT-002","CONTENT-003","CONTENT-004","CONTENT-005","CONTENT-006","CONTENT-007","CONTENT-008","CONTENT-009","CONTENT-010","CONTENT-011","CONTENT-012",
  "AIV-001","AIV-002","AIV-003","AIV-004","AIV-005","AIV-006","AIV-007","AIV-008","AIV-009","AIV-010","AIV-011","AIV-012",
  "CITE-001","CITE-002","CITE-003","CITE-004","CITE-005","CITE-006","CITE-007","CITE-008","CITE-009","CITE-010",
  "COMP-001","COMP-002","COMP-003","COMP-004","COMP-005","COMP-006","COMP-007","COMP-008","COMP-009","COMP-010","COMP-011","COMP-012",
  "REC-001","REC-002","REC-003","REC-004","REC-005","REC-006","REC-007","REC-008","REC-009","REC-010","REC-011","REC-012",
  "GEN-001","GEN-002","GEN-003","GEN-004","GEN-005","GEN-006","GEN-007","GEN-008","GEN-009","GEN-010","GEN-011","GEN-012",
  "ORCH-001","ORCH-002","ORCH-003","ORCH-004","ORCH-005","ORCH-006","ORCH-007","ORCH-008","ORCH-009","ORCH-010",
  "LEARN-001","LEARN-002","LEARN-003","LEARN-004","LEARN-005","LEARN-006","LEARN-007","LEARN-008","LEARN-009","LEARN-010",
] as const;

export type EpicId = (typeof ALL_EPIC_IDS)[number];

export interface EpicResult {
  epicId: EpicId;
  status: "done";
  summary: string;
  data: Record<string, unknown>;
}

export function assertAllEpicsCovered(results: EpicResult[]): void {
  const have = new Set(results.map((r) => r.epicId));
  const missing = ALL_EPIC_IDS.filter((id) => !have.has(id));
  if (missing.length) {
    throw new Error(`Missing epic implementations: ${missing.join(", ")}`);
  }
}

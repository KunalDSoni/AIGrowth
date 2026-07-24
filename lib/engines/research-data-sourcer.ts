/**
 * PRE-4 — Data Sourcer (Proprietary Research Engine, Frontier 3).
 *
 * Admits data into a study only when its licence and provenance are defensible,
 * and records source + licence + retrieval provenance for everything it accepts.
 * The policy is **default-deny**: a dataset passes only when it carries an
 * explicitly open licence (public sources) or is a properly de-identified
 * first-party contribution. Unlicensed, unknown, non-commercial, or
 * insufficiently anonymised data is refused with a logged reason — never
 * silently used.
 *
 * This is an integrity gate, not a fetcher: it decides *whether* a candidate may
 * fuel a public study. The actual retrieval is the existing ingestion stack's
 * job; candidates arrive already described.
 */

export type DatasetOrigin = "public" | "first-party";

/** A dataset offered to a study, before the licence/provenance gate. */
export interface DatasetCandidate {
  id: string;
  title: string;
  origin: DatasetOrigin;
  /** Publisher or owning system. */
  source: string;
  url?: string;
  /** SPDX-ish id or licence name; undefined/empty means unlicensed. */
  license?: string;
  recordCount: number;
  /** ISO timestamp the data was retrieved (provenance). */
  retrievedAt?: string;
  /** First-party guardrails — required for first-party public use. */
  anonymized?: boolean;
  aggregated?: boolean;
}

/** A dataset that cleared the gate, with normalised provenance. */
export interface SourcedDataset {
  id: string;
  title: string;
  origin: DatasetOrigin;
  source: string;
  url?: string;
  license: string;
  recordCount: number;
  retrievedAt: string;
  /** Plain-English provenance statement for the methodology appendix. */
  provenance: string;
}

export interface SourcingDecision {
  accepted: SourcedDataset[];
  rejected: { id: string; title: string; reason: string }[];
}

/**
 * The allowlist of open licences usable in a public, commercial study. Anything
 * not here is refused. Non-commercial (…-NC) and no-derivatives (…-ND) licences
 * are deliberately excluded — a commercial study cannot rely on them.
 */
export const ALLOWED_LICENSES = new Set<string>([
  "cc0",
  "cc0-1.0",
  "cc-by",
  "cc-by-4.0",
  "cc-by-3.0",
  "cc-by-sa",
  "cc-by-sa-4.0",
  "pddl",
  "odc-by",
  "odbl",
  "ogl", // UK Open Government Licence
  "us-public-domain",
  "public-domain",
]);

/** The synthetic licence a first-party dataset carries once de-identified. */
export const FIRST_PARTY_LICENSE = "first-party-deidentified";

export const DATA_SOURCER_VERSION = 1;

function normalizeLicense(license?: string): string {
  return (license ?? "").trim().toLowerCase();
}

export function isLicenseUsable(license?: string): boolean {
  return ALLOWED_LICENSES.has(normalizeLicense(license));
}

/**
 * Run the gate over candidate datasets. `opts.now` stamps a retrieval time when
 * a candidate omits one, so provenance is never blank. Returns accepted datasets
 * (with provenance) and rejected ones (with reasons).
 */
export function sourceDatasets(
  candidates: DatasetCandidate[],
  opts?: { now?: string },
): SourcingDecision {
  const accepted: SourcedDataset[] = [];
  const rejected: { id: string; title: string; reason: string }[] = [];

  for (const c of candidates) {
    const reject = (reason: string) => rejected.push({ id: c.id, title: c.title, reason });

    if (!Number.isFinite(c.recordCount) || c.recordCount <= 0) {
      reject("Dataset has no records.");
      continue;
    }

    const retrievedAt = (c.retrievedAt ?? opts?.now ?? "").trim();
    if (!retrievedAt) {
      reject("Retrieval provenance is missing (no retrieval date).");
      continue;
    }

    if (c.origin === "first-party") {
      if (!c.anonymized || !c.aggregated) {
        reject("First-party data must be anonymised and aggregated before public use.");
        continue;
      }
      accepted.push({
        id: c.id,
        title: c.title,
        origin: "first-party",
        source: c.source,
        url: c.url,
        license: FIRST_PARTY_LICENSE,
        recordCount: c.recordCount,
        retrievedAt,
        provenance: `First-party dataset from ${c.source}, anonymised and aggregated, retrieved ${retrievedAt}.`,
      });
      continue;
    }

    // Public source: require an explicitly open licence.
    const norm = normalizeLicense(c.license);
    if (!norm) {
      reject("Public dataset is unlicensed — excluded.");
      continue;
    }
    if (!ALLOWED_LICENSES.has(norm)) {
      reject(`Licence "${c.license}" is not an approved open licence — excluded.`);
      continue;
    }

    accepted.push({
      id: c.id,
      title: c.title,
      origin: "public",
      source: c.source,
      url: c.url,
      license: norm,
      recordCount: c.recordCount,
      retrievedAt,
      provenance: `Public dataset from ${c.source} under ${norm}${c.url ? ` (${c.url})` : ""}, retrieved ${retrievedAt}.`,
    });
  }

  return { accepted, rejected };
}

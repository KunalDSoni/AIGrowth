/**
 * PRE-5 — Study Composer (Proprietary Research Engine, Frontier 3).
 *
 * Packages the citable asset: a headline stat, the supporting findings, a
 * methodology appendix, dataset provenance, and `schema.org/Dataset` JSON-LD so
 * machines index the study as a data source. Two non-negotiables are enforced
 * structurally, not by convention:
 *
 *  1. A finding the data cannot defend (strength "insufficient") is excluded from
 *     the study — recorded with a reason, never quietly published.
 *  2. Publishing is human-gated. `composeStudy` only ever produces a *draft*;
 *     `publishStudy` requires a named approver and refuses to publish a study
 *     with no defensible finding. There is no auto-publish path.
 */

import type { StatFinding } from "@/lib/engines/research-analysis";
import type { SourcedDataset } from "@/lib/engines/research-data-sourcer";
import {
  STRENGTH_ORDER,
  type ClaimStrength,
  type MethodologyVerdict,
} from "@/lib/engines/research-methodology-guard";

export interface Study {
  id: string;
  title: string;
  brand: string;
  anglePromptId: string;
  /** The strongest publishable finding; absent when nothing is defensible. */
  headline?: StatFinding;
  /** Publishable findings only (insufficient ones excluded). */
  findings: StatFinding[];
  /** Findings dropped because the data could not defend them. */
  excludedFindings: { id: string; reason: string }[];
  /** Plain-English methodology appendix from the Methodology Guard. */
  methodologyStatement: string;
  /** Datasets behind the study, each with licence + provenance. */
  datasets: SourcedDataset[];
  /** Overall strength = the headline's strength ("insufficient" if none). */
  strength: ClaimStrength;
  /** schema.org/Dataset JSON-LD. */
  datasetMarkup: Record<string, unknown>;
  /** A study is publishable only with a publishable methodology AND a finding. */
  publishable: boolean;
  status: "draft" | "published";
}

export interface PublishedStudy {
  study: Study;
  publishedAt: string;
  publishedBy: string;
}

export const STUDY_COMPOSER_VERSION = 1;

/** Rank publishable findings: stronger first, then larger sample. */
function pickHeadline(findings: StatFinding[]): StatFinding | undefined {
  return [...findings].sort(
    (a, b) => STRENGTH_ORDER.indexOf(b.strength) - STRENGTH_ORDER.indexOf(a.strength) || b.n - a.n,
  )[0];
}

function buildDatasetMarkup(input: {
  title: string;
  brand: string;
  description: string;
  datasets: SourcedDataset[];
  findings: StatFinding[];
  datePublished?: string;
}): Record<string, unknown> {
  const licenses = Array.from(new Set(input.datasets.map((d) => d.license)));
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: input.title,
    description: input.description,
    creator: { "@type": "Organization", name: input.brand },
    ...(licenses.length ? { license: licenses } : {}),
    ...(input.datePublished ? { datePublished: input.datePublished } : {}),
    variableMeasured: input.findings.map((f) => ({
      "@type": "PropertyValue",
      name: f.headline,
      value: f.value,
      unitText: f.unit,
      // Provenance travels with every published number.
      measurementTechnique: f.method,
      description: `n=${f.n}; sources: ${f.sources.join(", ")}; strength: ${f.strength}`,
    })),
    ...(input.datasets.length
      ? {
          isBasedOn: input.datasets.map((d) => ({
            "@type": "Dataset",
            name: d.title,
            ...(d.url ? { url: d.url } : {}),
            license: d.license,
          })),
        }
      : {}),
  };
}

/**
 * Build a study *draft* from findings, the methodology verdict, and the sourced
 * datasets. Never publishes — the returned study is always status "draft".
 */
export function composeStudy(input: {
  id: string;
  title: string;
  brand: string;
  anglePromptId: string;
  findings: StatFinding[];
  methodology: MethodologyVerdict;
  datasets: SourcedDataset[];
}): Study {
  const publishableFindings: StatFinding[] = [];
  const excludedFindings: { id: string; reason: string }[] = [];

  for (const f of input.findings) {
    if (f.strength === "insufficient") {
      excludedFindings.push({
        id: f.id,
        reason: "Data cannot defend this finding (insufficient) — excluded from the study.",
      });
    } else {
      publishableFindings.push(f);
    }
  }

  const headline = pickHeadline(publishableFindings);
  const strength: ClaimStrength = headline?.strength ?? "insufficient";
  const publishable = input.methodology.publishable && publishableFindings.length > 0;
  const description = headline?.headline ?? `${input.title} — no defensible finding.`;

  return {
    id: input.id,
    title: input.title,
    brand: input.brand,
    anglePromptId: input.anglePromptId,
    headline,
    findings: publishableFindings,
    excludedFindings,
    methodologyStatement: input.methodology.statement,
    datasets: input.datasets,
    strength,
    datasetMarkup: buildDatasetMarkup({
      title: input.title,
      brand: input.brand,
      description,
      datasets: input.datasets,
      findings: publishableFindings,
    }),
    publishable,
    status: "draft",
  };
}

/**
 * Human-gated publish. Requires a named approver and a publishable study.
 * Stamps `datePublished` into the markup. Throws — never silently no-ops — when
 * the gate is not satisfied, mirroring the GEO fix-approval gate.
 */
export function publishStudy(draft: Study, input: { approvedBy: string; now?: Date }): PublishedStudy {
  const approvedBy = input.approvedBy.trim();
  if (!approvedBy) {
    throw new Error("Publishing a study requires a named approver — studies are never auto-published.");
  }
  if (draft.status === "published") {
    throw new Error("Study is already published.");
  }
  if (!draft.publishable) {
    throw new Error(
      "Cannot publish: the study has no defensible finding or its methodology is insufficient.",
    );
  }

  const publishedAt = (input.now ?? new Date()).toISOString();
  const study: Study = {
    ...draft,
    status: "published",
    datasetMarkup: { ...draft.datasetMarkup, datePublished: publishedAt },
  };

  return { study, publishedAt, publishedBy: approvedBy };
}

import type { AuditIssue, EvidenceReference } from "@/lib/domain/types";
import type { PageAudit, SiteSummary } from "@/lib/engines/site-audit";
import type { RankedCandidate } from "@/lib/engines/recommendation-bus";
import type { AnalyzeDelta } from "@/lib/engines/analyze-delta";

export interface AnalyzeProject {
  id: string;
  domain: string;
  brandGuess: string;
  url: string;
}

export interface GeoCitation {
  url: string;
  domain: string;
  classification: "first-party" | "other";
}

export interface GeoObservation {
  id: string;
  prompt: string;
  rawResponse: string;
  brandMentioned: boolean;
  citations: GeoCitation[];
  error?: string;
}

export interface GeoResult {
  runId: string;
  model: string;
  sampleSize: number;
  brandMentionRate: number;
  firstPartyCitationShare: number;
  observations: GeoObservation[];
  errors: string[];
  cost: { provider: "gemini"; estimatedUsd: number; tokens: number };
}

export interface SeoResult {
  site: SiteSummary;
  pages: PageAudit[];
  siteIssues: AuditIssue[];
  scannedAt: string;
  finalUrl: string;
  origin: string;
}

export interface AnalyzeResult {
  project: AnalyzeProject;
  seo: SeoResult;
  geo: GeoResult;
  evidence: EvidenceReference[];
  nextActions: RankedCandidate[];
  guardrails: string[];
  analyzedAt: string;
  /** Present when a prior run exists for this domain. */
  delta?: AnalyzeDelta | null;
}

/**
 * Minimal synthetic input builder for engine tests.
 *
 * This is deliberately NOT a fictional company. It is a parameterised builder
 * that produces the smallest valid `AnalyzeResult` an engine needs, using
 * neutral placeholders on the RFC 2606 reserved `.invalid` TLD — a domain that
 * can never resolve and can never be mistaken for a real customer.
 *
 * Tests that care about a value must pass it in explicitly, so each test states
 * its own preconditions instead of inheriting them from a shared dataset.
 */

import type { AnalyzeResult } from "@/lib/analyze/types";
import type { PageAudit, SiteSummary } from "@/lib/engines/site-audit";
import { bandFor } from "@/lib/engines/readiness";
import type { ReadinessMetrics } from "@/lib/engines/readiness";

export interface AnalyzeInputOptions {
  domain?: string;
  brand?: string;
  score?: number;
  pages?: { path: string; title: string; words?: number }[];
  services?: string[];
  brandMentionRate?: number;
  geoSampleSize?: number;
  citedDomains?: string[];
  /** Issue counts, so tests can exercise remediation paths. */
  critical?: number;
  high?: number;
}

function metrics(score: number): ReadinessMetrics {
  return {
    score,
    band: bandFor(score),
    total: 0,
    critical: 0,
    high: 0,
    monitor: 0,
    quickWins: 0,
  };
}

export function makeAnalyzeResult(options: AnalyzeInputOptions = {}): AnalyzeResult {
  const domain = options.domain ?? "example.invalid";
  const brand = options.brand ?? "Test Brand";
  const score = options.score ?? 80;
  const origin = `https://${domain}`;
  const at = "2026-07-23T00:00:00.000Z";

  const pageSpecs = options.pages ?? [
    { path: "/", title: "Home", words: 900 },
    { path: "/services/", title: "Services", words: 700 },
    { path: "/contact/", title: "Contact", words: 300 },
  ];

  const pages: PageAudit[] = pageSpecs.map((spec) => ({
    url: `${origin}${spec.path}`,
    finalUrl: `${origin}${spec.path}`,
    title: spec.title,
    ok: true,
    metrics: metrics(score),
    issues: [],
    observation: {
      url: `${origin}${spec.path}`,
      title: spec.title,
      wordCount: spec.words ?? 500,
      headings: [spec.title],
      hasStructuredData: false,
      internalLinkCount: 3,
      imageCount: 1,
    } as never,
  }));

  const critical = options.critical ?? 0;
  const high = options.high ?? 0;

  const site: SiteSummary = {
    score,
    band: bandFor(score),
    pagesScanned: pages.length,
    pagesFailed: 0,
    totalIssues: critical + high,
    critical,
    high,
    quickWins: 0,
    worstPages: [],
    topIssues: [],
  };

  const cited = options.citedDomains ?? [];
  const sampleSize = options.geoSampleSize ?? 4;
  const mentionRate = options.brandMentionRate ?? 0;

  return {
    project: { id: `proj-${domain}`, domain, brandGuess: brand, url: `${origin}/` },
    seo: {
      site,
      pages,
      siteIssues: [],
      scannedAt: at,
      finalUrl: `${origin}/`,
      origin,
      robotsTxt: "User-agent: *\nAllow: /",
      sitemapFound: true,
    },
    geo: {
      runId: `geo-${domain}`,
      model: "test-model",
      sampleSize,
      brandMentionRate: mentionRate,
      firstPartyCitationShare: 0,
      observations: Array.from({ length: sampleSize }, (_, i) => ({
        id: `obs-${i}`,
        prompt: `Question ${i + 1}`,
        rawResponse: "",
        brandMentioned: i < Math.round(sampleSize * mentionRate),
        citations: cited.map((d) => ({
          url: `https://${d}/`,
          domain: d,
          classification: "other" as const,
        })),
      })),
      errors: [],
      cost: { provider: "gemini", estimatedUsd: 0, tokens: 0 },
    },
    evidence: [],
    nextActions: [],
    guardrails: [],
    analyzedAt: at,
  };
}

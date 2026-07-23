import type { AIVisibilityObservation } from "@/lib/domain/types";

/**
 * Citation Extraction and Domain Intelligence (EPIC CITE-001).
 *
 * Normalizes cited URLs/domains from AI observations, classifies each as
 * first-party, competitor or third-party, and aggregates by domain and page so
 * downstream engines can reason about who the answers actually cite.
 */

export type CitationClass = "first-party" | "competitor" | "third-party";

export interface NormalizedCitation {
  url: string;
  domain: string;
  path: string;
  classification: CitationClass;
  observationId: string;
  familyId: string;
  platform: string;
}

export interface DomainAggregate {
  domain: string;
  classification: CitationClass;
  count: number;
  pages: string[];
}

export interface CitationIntelligence {
  citations: NormalizedCitation[];
  byDomain: DomainAggregate[];
  firstPartyShare: number;
  competitorShare: number;
  thirdPartyShare: number;
}

/** Reduce a hostname to its registrable-ish form (drops www and lowercases). */
export function normalizeDomain(input: string): string {
  let host = input.trim().toLowerCase();
  if (host.includes("://")) {
    try {
      host = new URL(host).hostname;
    } catch {
      /* fall through to manual cleanup */
    }
  }
  host = host.replace(/^https?:\/\//, "").split("/")[0];
  return host.replace(/^www\./, "");
}

function normalizePath(url: string): string {
  try {
    const parsed = new URL(url.includes("://") ? url : `https://${url}`);
    return parsed.pathname.replace(/\/+$/, "") || "/";
  } catch {
    return "/";
  }
}

function classify(domain: string, firstPartyDomain: string, competitors: string[]): CitationClass {
  const normalizedFirst = normalizeDomain(firstPartyDomain);
  if (domain === normalizedFirst || domain.endsWith(`.${normalizedFirst}`)) return "first-party";
  const compact = domain.replace(/[^a-z0-9]/g, "");
  if (competitors.some((c) => compact.includes(c.toLowerCase().replace(/[^a-z0-9]/g, "")))) return "competitor";
  return "third-party";
}

export function extractCitations(input: {
  observations: AIVisibilityObservation[];
  firstPartyDomain: string;
  competitors: string[];
}): CitationIntelligence {
  const citations: NormalizedCitation[] = [];

  for (const observation of input.observations) {
    for (const citation of observation.citations) {
      const domain = normalizeDomain(citation.domain || citation.url);
      if (!domain) continue;
      citations.push({
        url: citation.url,
        domain,
        path: normalizePath(citation.url),
        classification: classify(domain, input.firstPartyDomain, input.competitors),
        observationId: observation.id,
        familyId: observation.familyId,
        platform: observation.platform,
      });
    }
  }

  const domainMap = new Map<string, DomainAggregate>();
  for (const citation of citations) {
    const existing = domainMap.get(citation.domain);
    if (existing) {
      existing.count += 1;
      if (!existing.pages.includes(citation.path)) existing.pages.push(citation.path);
    } else {
      domainMap.set(citation.domain, {
        domain: citation.domain,
        classification: citation.classification,
        count: 1,
        pages: [citation.path],
      });
    }
  }

  const byDomain = [...domainMap.values()].sort((a, b) => b.count - a.count);
  const total = citations.length || 1;
  const share = (cls: CitationClass) =>
    Math.round((citations.filter((c) => c.classification === cls).length / total) * 100);

  return {
    citations,
    byDomain,
    firstPartyShare: share("first-party"),
    competitorShare: share("competitor"),
    thirdPartyShare: share("third-party"),
  };
}

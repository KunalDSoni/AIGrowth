import type { AuditIssue, CrawledPageEvidence, TechnicalPageObservation } from "@/lib/domain/types";

function issue(input: AuditIssue): AuditIssue {
  return input;
}

export function buildTechnicalAuditIssues(input: {
  pages: TechnicalPageObservation[];
  evidenceIds: {
    metadata: string;
    schema: string;
    links: string;
    alt: string;
    performance: string;
  };
}): AuditIssue[] {
  const duplicateTitleGroups = new Map<string, TechnicalPageObservation[]>();
  for (const page of input.pages) {
    const key = `${page.title ?? ""}|${page.description ?? ""}`.toLowerCase();
    duplicateTitleGroups.set(key, [...(duplicateTitleGroups.get(key) ?? []), page]);
  }
  const duplicatePages = [...duplicateTitleGroups.values()].filter((group) => group.length > 1).flat();
  const schemaMissing = input.pages.filter((page) => page.pageType === "home" && !page.hasStructuredData);
  const weakLinks = input.pages.filter((page) => page.internalLinkCount < 4);
  const missingAlt = input.pages.reduce((total, page) => total + page.imagesMissingAlt, 0);
  const lowWordCountHome = input.pages.some((page) => page.pageType === "home" && page.wordCount < 500);

  return [
    duplicatePages.length
      ? issue({
          id: "meta",
          ruleId: "metadata.unique-title-description",
          category: "On-page",
          severity: "critical",
          title: `${duplicatePages.length} pages share duplicate metadata`,
          description: "Unique titles and descriptions help each page communicate a distinct purpose to searchers and crawlers.",
          recommendedAction: "Rewrite duplicated titles and descriptions so each service page has a specific offer, audience and market.",
          affectedPages: duplicatePages.length,
          evidenceIds: [input.evidenceIds.metadata],
          impactArea: "metadata",
        })
      : null,
    schemaMissing.length
      ? issue({
          id: "schema",
          ruleId: "structured-data.organization-professional-service",
          category: "Structured data",
          severity: "high",
          title: "Business schema is missing",
          description: "The homepage does not expose Organization or ProfessionalService structured data in the demo audit.",
          recommendedAction: "Add truthful Organization and ProfessionalService schema that reflects visible business information.",
          affectedPages: schemaMissing.length,
          evidenceIds: [input.evidenceIds.schema],
          impactArea: "structured-data",
        })
      : null,
    weakLinks.length
      ? issue({
          id: "links",
          ruleId: "architecture.contextual-internal-links",
          category: "Internal linking",
          severity: "quick-win",
          title: `${weakLinks.length} important pages are weakly connected`,
          description: "Relevant service and industry pages need contextual links so users and crawlers can understand relationships.",
          recommendedAction: "Add useful contextual links from service pages to industry pages and from supporting content back to commercial pages.",
          affectedPages: weakLinks.length,
          evidenceIds: [input.evidenceIds.links],
          impactArea: "internal-linking",
        })
      : null,
    missingAlt
      ? issue({
          id: "alt",
          ruleId: "accessibility.informative-image-alt",
          category: "Accessibility",
          severity: "quick-win",
          title: `${missingAlt} meaningful images lack alt text`,
          description: "Informative images should be described for people using assistive technology.",
          recommendedAction: "Add concise, truthful alt text for meaningful images and leave decorative images empty.",
          affectedPages: input.pages.filter((page) => page.imagesMissingAlt > 0).length,
          evidenceIds: [input.evidenceIds.alt],
          impactArea: "accessibility",
        })
      : null,
    lowWordCountHome
      ? issue({
          id: "speed",
          ruleId: "performance.hero-render-risk",
          category: "Page speed",
          severity: "monitor",
          title: "Hero image may delay mobile rendering",
          description: "The demo audit flags a possible rendering risk, but real-user performance data is not connected.",
          recommendedAction: "Monitor real-user data before prioritizing this over clearer commercial pages and metadata.",
          affectedPages: 1,
          evidenceIds: [input.evidenceIds.performance],
          impactArea: "performance",
        })
      : null,
  ].filter((value): value is AuditIssue => Boolean(value));
}

export function crawlEvidenceToTechnicalObservation(evidence: CrawledPageEvidence): TechnicalPageObservation {
  const pathname = new URL(evidence.finalUrl).pathname;
  return {
    id: `crawl-${pathname === "/" ? "home" : pathname.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}`,
    url: pathname || "/",
    statusCode: evidence.statusCode,
    title: evidence.title,
    description: evidence.description,
    canonical: evidence.canonical,
    h1Count: evidence.h1Count,
    wordCount: evidence.wordCount,
    hasViewport: evidence.hasViewport,
    hasStructuredData: evidence.hasStructuredData,
    imageCount: evidence.imageCount,
    imagesMissingAlt: evidence.imagesMissingAlt,
    internalLinkCount: evidence.internalLinkCount,
    pageType: pathname === "/" ? "home" : "service",
    hasClearCta: evidence.hasClearCta,
    hasProofSignal: evidence.hasProofSignal,
  };
}

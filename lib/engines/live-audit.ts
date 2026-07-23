import type { AuditIssue, CrawledPageEvidence, Severity } from "@/lib/domain/types";

/**
 * Accurate audit for a SINGLE live-crawled page.
 *
 * IMPORTANT: this deliberately does NOT do filesystem link resolution or
 * path-based canonical comparison. Those only make sense when auditing a whole
 * static-site directory; on a single fetched page they produce false positives
 * (every real link looks "broken"). Every rule here is defensible from the one
 * page we actually fetched, plus optional real robots.txt / sitemap.xml checks.
 */
export interface LiveAuditContext {
  /** robots.txt body if it was reachable over HTTP, otherwise null. */
  robotsTxt?: string | null;
  /** true if sitemap.xml was reachable or referenced in robots.txt. */
  sitemapFound?: boolean;
}

type ImpactArea = AuditIssue["impactArea"];

function issue(
  ruleId: string,
  severity: Severity,
  impactArea: ImpactArea,
  title: string,
  description: string,
  recommendedAction: string,
): AuditIssue {
  return {
    id: `live-${ruleId}`,
    ruleId,
    category: ruleId.split("-")[0] ?? "technical",
    severity,
    title,
    description,
    recommendedAction,
    affectedPages: 1,
    evidenceIds: ["ev-live-crawl-page"],
    impactArea,
  };
}

export function auditCrawledPage(crawl: CrawledPageEvidence, ctx: LiveAuditContext = {}): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const title = crawl.title?.trim() ?? "";
  const description = crawl.description?.trim() ?? "";
  const robots = crawl.robotsDirectives?.toLowerCase() ?? "";

  // Indexability
  if (robots.includes("noindex")) {
    issues.push(issue("robots-noindex", "critical", "indexability",
      "Page is set to noindex",
      `The page's robots meta directive is "${crawl.robotsDirectives}", which tells search engines and AI crawlers not to index it.`,
      "Remove the noindex directive if this page should be discoverable."));
  }
  if (!crawl.canonical) {
    issues.push(issue("canonical-missing", "monitor", "indexability",
      "No canonical URL declared",
      "The page has no <link rel=\"canonical\">, which can lead to duplicate-content ambiguity.",
      "Add a self-referencing canonical link to this page."));
  }

  // Title
  if (!title) {
    issues.push(issue("title-missing", "critical", "metadata",
      "Page has no <title>",
      "A missing title tag severely hurts search and AI discoverability.",
      "Add a descriptive 30–60 character title including the brand."));
  } else if (title.length < 30) {
    issues.push(issue("title-short", "high", "metadata",
      `Title is only ${title.length} characters`,
      `Short titles (\"${title}\") waste ranking real estate.`,
      "Expand the title to 30–60 characters describing the page and brand."));
  } else if (title.length > 65) {
    issues.push(issue("title-long", "monitor", "metadata",
      `Title is ${title.length} characters (may truncate)`,
      `Long titles are truncated in results: \"${title}\".`,
      "Trim the title to about 60 characters."));
  }

  // Meta description
  if (!description) {
    issues.push(issue("meta-description-missing", "high", "metadata",
      "Page has no meta description",
      "Without a meta description, search engines and AI answers invent one from page text.",
      "Add a 70–160 character description summarising the page."));
  } else if (description.length < 70) {
    issues.push(issue("meta-description-short", "monitor", "metadata",
      `Meta description is only ${description.length} characters`,
      "Very short descriptions under-sell the page in results.",
      "Aim for 70–160 characters."));
  } else if (description.length > 160) {
    issues.push(issue("meta-description-long", "monitor", "metadata",
      `Meta description is ${description.length} characters (may truncate)`,
      "Descriptions over ~160 characters get cut off.",
      "Trim the description to about 155 characters."));
  }

  // Headings
  if (crawl.h1Count === 0) {
    issues.push(issue("h1-missing", "high", "metadata",
      "Page has no H1 heading",
      "The H1 signals the page's primary topic to search and assistive tech.",
      "Add exactly one clear H1 that states what the page is about."));
  } else if (crawl.h1Count > 1) {
    issues.push(issue("h1-multiple", "monitor", "metadata",
      `Page has ${crawl.h1Count} H1 headings`,
      "Multiple H1s dilute the page's primary-topic signal.",
      "Keep a single H1 and demote the rest to H2/H3."));
  }

  // Mobile / viewport
  if (!crawl.hasViewport) {
    issues.push(issue("viewport-missing", "high", "accessibility",
      "No responsive viewport meta tag",
      "Without a viewport tag the page renders poorly on mobile, which hurts rankings.",
      "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">."));
  }

  // Images
  if (crawl.imagesMissingAlt > 0) {
    issues.push(issue("image-alt-missing", "quick-win", "accessibility",
      `${crawl.imagesMissingAlt} of ${crawl.imageCount} images lack alt text`,
      "Missing alt text hurts accessibility and image search.",
      "Add concise, descriptive alt text to each meaningful image."));
  }

  // Content depth
  if (crawl.wordCount < 300) {
    issues.push(issue("thin-content", "monitor", "discovery",
      `Page has only ${crawl.wordCount} words`,
      "Thin pages struggle to rank and give AI models little to cite.",
      "Expand with genuinely useful, specific content (aim for 300+ words)."));
  }

  // Structured data
  if (!crawl.hasStructuredData) {
    issues.push(issue("structured-data-missing", "monitor", "structured-data",
      "No structured data (JSON-LD) found",
      "Schema.org markup helps search and AI understand your entities and services.",
      "Add relevant JSON-LD (Organization, Service, FAQ, etc.)."));
  }

  // Open Graph
  if (crawl.openGraphTags === 0) {
    issues.push(issue("open-graph-missing", "monitor", "discovery",
      "No Open Graph tags",
      "Missing og: tags make shared links look poor on social and in chat previews.",
      "Add og:title, og:description, og:image and og:url."));
  }

  // robots.txt / sitemap (real HTTP checks, only when context is provided)
  if (ctx.robotsTxt === null) {
    issues.push(issue("robots-txt-missing", "monitor", "indexability",
      "Site has no robots.txt",
      "No robots.txt was reachable at the site root.",
      "Add a robots.txt with a Sitemap: directive."));
  }
  if (ctx.sitemapFound === false) {
    issues.push(issue("sitemap-missing", "monitor", "indexability",
      "No sitemap.xml found",
      "No sitemap.xml was reachable or referenced in robots.txt.",
      "Generate a sitemap.xml listing every indexable page."));
  }

  return issues;
}

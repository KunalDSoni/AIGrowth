/**
 * Build an evidence-grounded content brief from a live AnalyzeResult + Next action.
 * Never invents business facts beyond crawl + GEO observations.
 */

import type { AnalyzeResult } from "@/lib/analyze/types";
import type { RankedCandidate } from "@/lib/engines/recommendation-bus";
import { buildBrief, type ContentBrief, type ContentType } from "@/lib/engines/brief-builder";

export interface ActionBriefPackage {
  brief: ContentBrief;
  outline: string[];
  suggestedTitle: string;
  suggestedMetaDescription: string;
  siteFacts: string[];
  citedOtherDomains: string[];
  geoContext: string[];
}

function contentTypeFor(action: RankedCandidate): ContentType {
  if (action.source === "citation" || action.source === "ai-visibility") return "service";
  if (/faq/i.test(action.title) || /faq/i.test(action.action)) return "faq";
  if (/compar/i.test(action.title)) return "comparison";
  if (action.source === "technical") return "article";
  return "service";
}

export function buildActionBrief(result: AnalyzeResult, action: RankedCandidate): ActionBriefPackage {
  const evidence = result.evidence.filter((e) => action.evidenceIds.includes(e.id));
  const pages = result.seo.pages.filter((p) => p.ok).slice(0, 8);
  const siteFacts = [
    `Brand (from crawl): ${result.project.brandGuess}`,
    `Domain: ${result.project.domain}`,
    `Homepage title: ${pages[0]?.title ?? result.seo.finalUrl}`,
    `Pages scanned: ${result.seo.site.pagesScanned}`,
    `SEO readiness: ${result.seo.site.score}/100`,
    ...pages.slice(0, 5).map((p) => `Page: ${p.title ?? p.finalUrl} (${p.metrics.score}/100)`),
  ];

  const citedOtherDomains = [
    ...new Set(
      result.geo.observations.flatMap((o) =>
        o.citations.filter((c) => c.classification === "other").map((c) => c.domain),
      ),
    ),
  ].slice(0, 8);

  const geoContext = [
    `GEO sample size: ${result.geo.sampleSize}`,
    `Brand mention rate: ${result.geo.brandMentionRate}%`,
    `First-party citation share: ${result.geo.firstPartyCitationShare}%`,
    ...result.geo.observations.slice(0, 4).map((o) => `Prompt: ${o.prompt} → ${o.brandMentioned ? "mentioned" : "not mentioned"}`),
  ];

  const contentType = contentTypeFor(action);
  const brief = buildBrief({
    recommendationId: action.id,
    contentType,
    objective: action.action,
    audience: `People researching ${result.project.brandGuess} / ${result.project.domain}`,
    intent: action.source === "technical" ? "informational" : "commercial",
    evidence: evidence.length
      ? evidence
      : result.evidence.slice(0, 2),
    internalLinks: pages.map((p) => p.finalUrl).slice(0, 5),
    cta: "Book a consultation / contact",
  });

  // Enrich claims with citation gaps when relevant.
  if (citedOtherDomains.length && (action.source === "citation" || action.source === "ai-visibility")) {
    brief.claimsToVerify.push(
      `Do not claim superiority over ${citedOtherDomains.slice(0, 3).join(", ")} without proof.`,
    );
  }

  const outline =
    contentType === "faq"
      ? [
          "H1: Clear question-led page title including the service",
          "Short answer summary (40–60 words)",
          "3–5 FAQs with factual answers from the business",
          "Proof / process section",
          "CTA",
        ]
      : contentType === "comparison"
        ? [
            "H1: Comparison framed around buyer need",
            "Criteria table (features buyers care about)",
            "Where this business fits (honest)",
            "When to choose alternatives",
            "CTA",
          ]
        : [
            "H1: Service + audience in plain language",
            "Who this is for",
            "What you get (concrete deliverables)",
            "How it works (steps)",
            "Proof / trust signals",
            "FAQ (3 questions)",
            "CTA",
          ];

  const suggestedTitle = `${result.project.brandGuess}: ${action.title}`.slice(0, 60);
  const suggestedMetaDescription =
    `${action.action} Learn how ${result.project.brandGuess} (${result.project.domain}) helps.`.slice(0, 155);

  return {
    brief,
    outline,
    suggestedTitle,
    suggestedMetaDescription,
    siteFacts,
    citedOtherDomains,
    geoContext,
  };
}

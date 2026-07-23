import type { AIVisibilityPromptFamily, AuditIssue, BusinessProfileSnapshot, ContentOpportunity, EvidenceReference, GeneratedAsset, Recommendation, RecommendationScoreComponents, TechnicalPageObservation, WebsitePageProfile } from "@/lib/domain/types";
import { createMockAIVisibilityObservations, summarizeAIVisibility } from "@/lib/engines/ai-visibility";
import { buildBusinessAwareContentOpportunities, type ContentGapCandidate } from "@/lib/engines/content-gap";
import { buildCitationGapActions } from "@/lib/engines/citation-gap";
import { buildGrowthSignals, buildUnifiedGrowthDecisions } from "@/lib/engines/growth-intelligence";
import { buildOutcomeLearningRecords, type OutcomeScenario } from "@/lib/engines/outcome-learning";
import { calculateRecommendationPriority, explainRecommendationScore } from "@/lib/engines/priority";
import { buildTechnicalAuditIssues } from "@/lib/engines/technical-audit";
import { extractCitations } from "@/lib/engines/citation-intelligence";
import { runObservations } from "@/lib/engines/observation-run";
import { buildSiteInventory } from "@/lib/engines/site-inventory";
import { auditAiAccess } from "@/lib/engines/ai-access";
import { buildContentInventory, detectRefreshCandidates } from "@/lib/engines/content-inventory";
import { demoDemandSignals } from "@/lib/providers/search";
import { buildDemandProxy, type PromptOpportunity } from "@/lib/engines/demand-proxy";

export const project = {
  id: "northstar",
  name: "Northstar Accounting",
  url: "northstaraccounting.com.au",
  market: "Australia",
  industry: "Accounting & bookkeeping",
  goal: "Qualified consultation leads",
  audience: "Small businesses, medical clinics, e-commerce and professional services",
};

export const businessProfile: BusinessProfileSnapshot = {
  id: "northstar-profile",
  name: project.name,
  market: project.market,
  industry: project.industry,
  goal: project.goal,
  audienceSegments: ["Small businesses", "Medical clinics", "E-commerce companies", "Professional services firms"],
  services: ["Bookkeeping", "Payroll", "BAS services", "Cloud accounting", "Virtual CFO", "Management reporting"],
  differentiators: ["Plain-language financial guidance", "Outsourced finance team", "Australian small-business focus"],
  tone: "Professional, warm and plain-spoken",
};

export const websitePages: WebsitePageProfile[] = [
  { id: "page-home", url: "/", title: "Northstar Accounting | Accounting Services", pageType: "home", services: ["Accounting"], audiences: ["Small businesses"], funnelStage: "Awareness" },
  { id: "page-bookkeeping", url: "/bookkeeping", title: "Bookkeeping services", pageType: "service", services: ["Bookkeeping"], audiences: ["Small businesses"], funnelStage: "Consideration" },
  { id: "page-payroll", url: "/payroll", title: "Payroll support", pageType: "service", services: ["Payroll"], audiences: ["Small businesses"], funnelStage: "Consideration" },
  { id: "page-cloud", url: "/cloud-accounting", title: "Cloud accounting setup", pageType: "service", services: ["Cloud accounting"], audiences: ["Small businesses", "Professional services firms"], funnelStage: "Decision" },
  { id: "page-cfo", url: "/virtual-cfo", title: "Virtual CFO services", pageType: "service", services: ["Virtual CFO", "Management reporting"], audiences: ["Small businesses"], funnelStage: "Decision" },
];

export const technicalPageObservations: TechnicalPageObservation[] = [
  { id: "tech-home", url: "/", statusCode: 200, title: "Northstar Accounting | Accounting Services", description: "Accounting services for growing businesses.", canonical: "https://northstaraccounting.com.au/", h1Count: 1, wordCount: 430, hasViewport: true, hasStructuredData: false, imageCount: 3, imagesMissingAlt: 2, internalLinkCount: 3, pageType: "home" },
  { id: "tech-bookkeeping", url: "/bookkeeping", statusCode: 200, title: "Bookkeeping Services | Northstar", description: "Accounting services for growing businesses.", canonical: "https://northstaraccounting.com.au/bookkeeping", h1Count: 1, wordCount: 620, hasViewport: true, hasStructuredData: false, imageCount: 2, imagesMissingAlt: 2, internalLinkCount: 2, pageType: "service" },
  { id: "tech-payroll", url: "/payroll", statusCode: 200, title: "Bookkeeping Services | Northstar", description: "Accounting services for growing businesses.", canonical: "https://northstaraccounting.com.au/payroll", h1Count: 1, wordCount: 540, hasViewport: true, hasStructuredData: false, imageCount: 1, imagesMissingAlt: 1, internalLinkCount: 2, pageType: "service" },
  { id: "tech-cloud", url: "/cloud-accounting", statusCode: 200, title: "Cloud Accounting Setup | Northstar", description: "Set up cloud accounting with Northstar.", canonical: "https://northstaraccounting.com.au/cloud-accounting", h1Count: 1, wordCount: 710, hasViewport: true, hasStructuredData: false, imageCount: 2, imagesMissingAlt: 1, internalLinkCount: 5, pageType: "service" },
  { id: "tech-cfo", url: "/virtual-cfo", statusCode: 200, title: "Virtual CFO Services | Northstar", description: "Finance leadership for Australian small businesses.", canonical: "https://northstaraccounting.com.au/virtual-cfo", h1Count: 1, wordCount: 780, hasViewport: true, hasStructuredData: false, imageCount: 1, imagesMissingAlt: 1, internalLinkCount: 3, pageType: "service" },
];

const now = "2026-07-23T00:00:00.000Z";
const organizationId = "demo-org";
const projectId = "northstar";

export const aiVisibilityPromptFamilies: AIVisibilityPromptFamily[] = [
  { id: "clinic-bookkeeping", topic: "Bookkeeping providers for Australian medical clinics", buyingStage: "decision", persona: "Practice manager", geography: "Australia", prompts: ["Who provides bookkeeping for medical clinics in Australia?", "Which accounting firms understand healthcare practice bookkeeping?", "Best outsourced bookkeeping options for a growing clinic"] },
  { id: "outsourced-accounting", topic: "Alternatives to hiring an internal bookkeeper", buyingStage: "consideration", persona: "Small-business founder", geography: "Australia", prompts: ["What are good alternatives to hiring an internal bookkeeper?", "Should an Australian small business outsource accounting?", "Recommended outsourced accounting providers for small businesses"] },
  { id: "virtual-cfo", topic: "Virtual CFO services for growing Australian businesses", buyingStage: "decision", persona: "Founder", geography: "Australia", prompts: ["Recommended virtual CFO services for small businesses in Australia", "Who can help with cash-flow forecasting and management reporting?", "Best finance support for a growing Australian service business"] },
];

export const aiVisibilityObservations = createMockAIVisibilityObservations(aiVisibilityPromptFamilies, now);

const aiVisibilityEvidence: EvidenceReference[] = aiVisibilityObservations.map((observation) => ({
  id: `ev-${observation.id}`,
  organizationId,
  projectId,
  kind: "AI_ANSWER_OBSERVATION",
  source: `${observation.platform} mock observation`,
  sourceRecordId: observation.id,
  observedAt: observation.observedAt,
  retrievedAt: observation.observedAt,
  reliability: "LOW",
  isEstimated: true,
  isSimulated: true,
  summary: `${observation.platform} answered "${observation.exactPrompt}" with ${observation.brandMentions.length ? "a Northstar mention" : "no Northstar mention"} and ${observation.citations.length} citations.`,
  normalizedValue: observation,
}));

export const aiVisibilitySummaries = summarizeAIVisibility(aiVisibilityPromptFamilies, aiVisibilityObservations);
export const citationGapActions = buildCitationGapActions({
  summaries: aiVisibilitySummaries,
  observations: aiVisibilityObservations,
  firstPartyDomain: "northstaraccounting.com.au",
  competitors: ["LedgerWise", "ClearBooks AU"],
});

export const evidenceReferences: EvidenceReference[] = [
  { id: "ev-business-profile", organizationId, projectId, kind: "USER_SUPPLIED", source: "Demo onboarding profile", observedAt: now, retrievedAt: now, reliability: "MEDIUM", isEstimated: false, isSimulated: true, summary: "Northstar sells accounting and bookkeeping outsourcing in Australia to small businesses, medical clinics, e-commerce companies and professional services firms.", normalizedValue: project },
  { id: "ev-homepage-title", organizationId, projectId, kind: "CRAWL_OBSERVATION", source: "Mock website audit", sourceRecordId: "page-home", observedAt: now, retrievedAt: now, reliability: "MEDIUM", isEstimated: false, isSimulated: true, summary: "Homepage title is generic and does not mention outsourced accounting, Australia, or priority audiences.", normalizedValue: { url: "/", title: "Northstar Accounting | Accounting Services", description: "Accounting services for growing businesses." } },
  { id: "ev-clinic-gap", organizationId, projectId, kind: "CALCULATED", source: "Content coverage gap analysis", observedAt: now, retrievedAt: now, reliability: "MEDIUM", isEstimated: true, isSimulated: true, summary: "The business serves medical clinics but the demo site has no dedicated clinic bookkeeping page.", normalizedValue: { service: "Bookkeeping", audience: "Medical clinics", existingPage: false } },
  { id: "ev-competitor-clinic", organizationId, projectId, kind: "COMPETITOR_OBSERVATION", source: "Mock competitor provider", observedAt: now, retrievedAt: now, reliability: "LOW", isEstimated: true, isSimulated: true, summary: "Two simulated competitors show stronger industry-specific accounting content coverage.", normalizedValue: { competitorsWithIndustryPages: 2, contentCoverageGap: 28 } },
  { id: "ev-search-clinic", organizationId, projectId, kind: "KEYWORD_PROVIDER_ESTIMATE", source: "Mock keyword provider", observedAt: now, retrievedAt: now, reliability: "LOW", isEstimated: true, isSimulated: true, summary: "Demo search estimate suggests meaningful commercial demand for bookkeeping services tailored to medical clinics.", normalizedValue: { topic: "bookkeeping for medical clinics", market: "Australia", estimatedMonthlySearches: 700 } },
  { id: "ev-cta-generic", organizationId, projectId, kind: "CRAWL_OBSERVATION", source: "Mock content audit", sourceRecordId: "cta-review", observedAt: now, retrievedAt: now, reliability: "MEDIUM", isEstimated: false, isSimulated: true, summary: "Six service pages use generic contact language instead of explaining the consultation offer.", normalizedValue: { affectedPages: 6, currentPattern: "Contact us" } },
  { id: "ev-conversion-estimate", organizationId, projectId, kind: "ANALYTICS_METRIC", source: "Mock analytics provider", observedAt: now, retrievedAt: now, reliability: "LOW", isEstimated: true, isSimulated: true, summary: "Demo conversion baseline estimates service-page enquiries at 1.8%.", normalizedValue: { conversionRate: "1.8%", sample: "simulated" } },
  { id: "ev-local-gap", organizationId, projectId, kind: "AI_INFERENCE", source: "Mock local SEO analysis", observedAt: now, retrievedAt: now, reliability: "LOW", isEstimated: true, isSimulated: true, summary: "Northstar targets Australia and references Sydney and Melbourne, but local service context is thin.", normalizedValue: { markets: ["Sydney", "Melbourne"], dedicatedPages: 0 } },
  { id: "ev-link-gap", organizationId, projectId, kind: "CRAWL_OBSERVATION", source: "Mock internal link audit", observedAt: now, retrievedAt: now, reliability: "MEDIUM", isEstimated: false, isSimulated: true, summary: "Service, industry and educational pages are weakly connected, with 14 contextual internal links recommended.", normalizedValue: { linksToAdd: 14, pagesImproved: 9 } },
  { id: "ev-existing-pages", organizationId, projectId, kind: "CRAWL_OBSERVATION", source: "Mock page inventory", observedAt: now, retrievedAt: now, reliability: "MEDIUM", isEstimated: false, isSimulated: true, summary: "The demo site has service pages for bookkeeping, payroll, cloud accounting and virtual CFO, but lacks specialist industry content.", normalizedValue: websitePages },
  { id: "ev-tax-calendar-demand", organizationId, projectId, kind: "KEYWORD_PROVIDER_ESTIMATE", source: "Mock keyword provider", observedAt: now, retrievedAt: now, reliability: "LOW", isEstimated: true, isSimulated: true, summary: "Australian tax-deadline content has repeat informational demand and can introduce BAS and advisory services.", normalizedValue: { topic: "Australian small business tax calendar", intent: "Informational to commercial" } },
  { id: "ev-software-comparison", organizationId, projectId, kind: "SERP_OBSERVATION", source: "Mock SERP provider", observedAt: now, retrievedAt: now, reliability: "LOW", isEstimated: true, isSimulated: true, summary: "Accounting software comparison searches show decision-stage intent for setup and advisory support.", normalizedValue: { topic: "Xero vs MYOB", intent: "Comparison" } },
  { id: "ev-cash-flow-gap", organizationId, projectId, kind: "AI_INFERENCE", source: "Mock content quality model", observedAt: now, retrievedAt: now, reliability: "LOW", isEstimated: true, isSimulated: true, summary: "Northstar offers virtual CFO services but does not have a practical cash-flow forecasting guide that demonstrates advisory value.", normalizedValue: { service: "Virtual CFO", missingContent: "13-week cash-flow forecast guide" } },
  { id: "ev-tech-metadata", organizationId, projectId, kind: "CRAWL_OBSERVATION", source: "Mock technical crawl", observedAt: now, retrievedAt: now, reliability: "MEDIUM", isEstimated: false, isSimulated: true, summary: "Bookkeeping and payroll service pages reuse the same title pattern and generic description.", normalizedValue: technicalPageObservations.filter((page) => page.url === "/bookkeeping" || page.url === "/payroll") },
  { id: "ev-tech-schema", organizationId, projectId, kind: "CRAWL_OBSERVATION", source: "Mock technical crawl", observedAt: now, retrievedAt: now, reliability: "MEDIUM", isEstimated: false, isSimulated: true, summary: "Homepage has no Organization or ProfessionalService structured data in the simulated crawl.", normalizedValue: technicalPageObservations.find((page) => page.url === "/") },
  { id: "ev-tech-links", organizationId, projectId, kind: "CALCULATED", source: "Technical audit rule", observedAt: now, retrievedAt: now, reliability: "MEDIUM", isEstimated: false, isSimulated: true, summary: "Homepage, bookkeeping, payroll and virtual CFO pages have fewer than four contextual internal links.", normalizedValue: { threshold: 4, pagesBelowThreshold: ["/", "/bookkeeping", "/payroll", "/virtual-cfo"] } },
  { id: "ev-tech-alt", organizationId, projectId, kind: "CRAWL_OBSERVATION", source: "Mock technical crawl", observedAt: now, retrievedAt: now, reliability: "MEDIUM", isEstimated: false, isSimulated: true, summary: "Seven meaningful images are missing alt text across five demo pages.", normalizedValue: { imagesMissingAlt: 7 } },
  { id: "ev-tech-performance", organizationId, projectId, kind: "AI_INFERENCE", source: "Mock page experience heuristic", observedAt: now, retrievedAt: now, reliability: "LOW", isEstimated: true, isSimulated: true, summary: "Homepage has a possible mobile rendering risk, but real-user performance data is not connected.", normalizedValue: { page: "/", reason: "hero media heuristic" } },
  ...aiVisibilityEvidence,
];

function recommendation(input: Omit<Recommendation, "priorityScore" | "scoreExplanation"> & { scoreComponents: RecommendationScoreComponents }): Recommendation {
  const { priorityScore } = calculateRecommendationPriority(input.scoreComponents);
  return { ...input, priorityScore, scoreExplanation: explainRecommendationScore(input.scoreComponents) };
}

export const recommendations: Recommendation[] = [
  recommendation({
    id: "medical-bookkeeping",
    rank: 1,
    category: "Search opportunity",
    severity: "high",
    title: "Create a medical-clinic bookkeeping page",
    explanation: "Northstar serves medical clinics, but the site does not give that high-value audience a dedicated page or proof path.",
    action: "Publish a focused service page that addresses clinic payroll, BAS, cash flow and compliance concerns.",
    impact: "High",
    effort: "2 hours",
    effortScore: 20,
    confidence: "Medium",
    outcome: "Capture qualified searches from clinics actively comparing bookkeeping providers.",
    metrics: [{ label: "Monthly searches", value: "~700 est." }, { label: "Qualified visits", value: "~80 est." }, { label: "Potential leads", value: "4-8 est." }],
    assetType: "Landing page",
    status: "open",
    scoreComponents: { businessRelevance: 98, conversionPotential: 92, discoveryOpportunity: 94, severity: 78, strategicAlignment: 96, urgency: 78, effort: 28, evidenceConfidence: 68, risk: 22, dependencyReadiness: 82 },
    evidenceIds: ["ev-business-profile", "ev-clinic-gap", "ev-competitor-clinic", "ev-search-clinic"],
    assumptions: ["Medical clinics remain a high-value customer segment for Northstar.", "A dedicated page will be materially more useful than adding a small paragraph to the generic bookkeeping page.", "Search estimates are directional demo data, not guaranteed demand."],
    dependencies: ["Confirm clinic-specific service details and any claims before publishing.", "Add at least two internal links from bookkeeping and payroll pages."],
    risk: "Low",
    completionCriteria: ["Published page has unique clinic-focused copy.", "Page includes visible consultation CTA and truthful service details.", "Page is internally linked from relevant service pages."],
    measurementPlan: { baseline: "Current clinic-specific organic landing pages: none.", implementationEvent: "Record publish date for the medical-clinic bookkeeping page.", comparisonWindow: "Compare 30-90 days after indexing.", leadingIndicators: ["Page indexed", "Impressions for clinic bookkeeping queries", "Internal link clicks"], successSignals: ["Qualified visits to the new page", "Consultation enquiries mentioning clinics"], attributionLimits: "Early traffic may be affected by crawl timing, seasonality and brand demand." },
  }),
  recommendation({
    id: "homepage-metadata",
    rank: 2,
    category: "On-page SEO",
    severity: "quick-win",
    title: "Rewrite the homepage search preview",
    explanation: "The current title says what Northstar is, but not who it helps or where it operates.",
    action: "Use a specific title and description built around outsourced accounting for Australian businesses.",
    impact: "High",
    effort: "20 min",
    effortScore: 8,
    confidence: "High",
    outcome: "Make the result clearer and more persuasive before someone reaches the site.",
    metrics: [{ label: "Page", value: "Homepage" }, { label: "Current CTR", value: "2.1% sample" }, { label: "Target range", value: "2.7-3.2% est." }],
    assetType: "SEO metadata",
    status: "open",
    scoreComponents: { businessRelevance: 92, conversionPotential: 80, discoveryOpportunity: 72, severity: 64, strategicAlignment: 88, urgency: 86, effort: 8, evidenceConfidence: 84, risk: 8, dependencyReadiness: 96 },
    evidenceIds: ["ev-business-profile", "ev-homepage-title"],
    assumptions: ["The homepage is eligible to appear for broad branded and commercial searches.", "A clearer title and description may improve click quality but cannot guarantee CTR gains."],
    dependencies: ["CMS access to edit title and meta description.", "Final wording must match visible page content."],
    risk: "Low",
    completionCriteria: ["Homepage title names the offer and market.", "Meta description describes the consultation value without keyword stuffing.", "Search preview is reviewed after deployment."],
    measurementPlan: { baseline: "Demo CTR baseline: 2.1% sample.", implementationEvent: "Record metadata deployment date.", comparisonWindow: "Compare 28 days before and after deployment once Search Console is connected.", leadingIndicators: ["Search Console impressions", "Average CTR", "Branded query click quality"], successSignals: ["Higher CTR on relevant homepage queries", "No drop in branded visibility"], attributionLimits: "CTR changes can be affected by rankings, SERP layout, ads and seasonality." },
  }),
  recommendation({
    id: "consultation-ctas",
    rank: 3,
    category: "Conversion",
    severity: "quick-win",
    title: "Make consultation calls-to-action specific",
    explanation: "Generic contact buttons do not explain what happens next or reduce the perceived risk of reaching out.",
    action: "Replace generic buttons with a clear, low-friction consultation offer across service pages.",
    impact: "High",
    effort: "45 min",
    effortScore: 12,
    confidence: "High",
    outcome: "Turn more existing service-page visits into consultation enquiries.",
    metrics: [{ label: "Pages affected", value: "6" }, { label: "Current conversion", value: "1.8% sample" }, { label: "Potential lift", value: "+10-20% est." }],
    assetType: "CTA copy",
    status: "open",
    scoreComponents: { businessRelevance: 90, conversionPotential: 92, discoveryOpportunity: 38, severity: 70, strategicAlignment: 86, urgency: 88, effort: 14, evidenceConfidence: 76, risk: 10, dependencyReadiness: 94 },
    evidenceIds: ["ev-business-profile", "ev-cta-generic", "ev-conversion-estimate"],
    assumptions: ["Service pages already receive enough visits for CTA clarity to matter.", "A clearer consultation offer reduces friction without needing a full page redesign."],
    dependencies: ["Confirm what the consultation includes.", "Update repeated CTA components or page templates."],
    risk: "Low",
    completionCriteria: ["Six service pages include a specific consultation CTA.", "CTA copy sets expectations truthfully.", "Primary CTA remains accessible on mobile."],
    measurementPlan: { baseline: "Demo service-page enquiry conversion: 1.8%.", implementationEvent: "Record CTA deployment date.", comparisonWindow: "Compare 30 days before and after deployment when analytics is connected.", leadingIndicators: ["CTA clicks", "Form starts", "Consultation page visits"], successSignals: ["Higher enquiry rate from service pages", "More qualified consultation requests"], attributionLimits: "Lead volume can be influenced by traffic mix and offline campaigns." },
  }),
  recommendation({
    id: "location-pages",
    rank: 4,
    category: "Local SEO",
    severity: "high",
    title: "Create two location-specific service pages",
    explanation: "Northstar serves Sydney and Melbourne, but its pages give search engines and visitors little local context.",
    action: "Start with Sydney and Melbourne pages containing unique proof, service context and local FAQs.",
    impact: "Medium",
    effort: "4 hours",
    effortScore: 35,
    confidence: "Medium",
    outcome: "Build relevance for local, service-led searches without creating thin doorway pages.",
    metrics: [{ label: "Initial locations", value: "2" }, { label: "Intent", value: "High" }, { label: "Time to signal", value: "8-12 weeks est." }],
    assetType: "Location page",
    status: "open",
    scoreComponents: { businessRelevance: 82, conversionPotential: 74, discoveryOpportunity: 76, severity: 62, strategicAlignment: 78, urgency: 64, effort: 55, evidenceConfidence: 58, risk: 34, dependencyReadiness: 62 },
    evidenceIds: ["ev-business-profile", "ev-local-gap"],
    assumptions: ["Northstar can truthfully serve and support clients in Sydney and Melbourne.", "Each page will include unique local context rather than doorway-page duplication."],
    dependencies: ["Confirm local proof points.", "Create unique FAQs and service examples for each city."],
    risk: "Medium",
    completionCriteria: ["Two pages published with distinct local context.", "Pages avoid duplicated boilerplate and unsupported claims.", "Pages link to relevant service pages."],
    measurementPlan: { baseline: "No dedicated Sydney or Melbourne service pages in demo audit.", implementationEvent: "Record publish dates for both local pages.", comparisonWindow: "Review 60-120 days after indexing.", leadingIndicators: ["Indexing status", "Local query impressions", "Clicks from target cities"], successSignals: ["Qualified visits from Sydney and Melbourne searches", "Consultation requests from target cities"], attributionLimits: "Local visibility depends on proximity, search intent, reviews, competition and Google Business Profile signals." },
  }),
  recommendation({
    id: "internal-links",
    rank: 5,
    category: "Site structure",
    severity: "quick-win",
    title: "Connect service and industry pages",
    explanation: "Relevant pages exist in isolation, so visitors and search engines cannot easily understand how Northstar's expertise fits together.",
    action: "Add contextual links from services to industry pages and from educational articles back to commercial pages.",
    impact: "Medium",
    effort: "1 hour",
    effortScore: 15,
    confidence: "High",
    outcome: "Move visitors toward conversion pages and reinforce the site's topic structure.",
    metrics: [{ label: "Links to add", value: "14" }, { label: "Pages improved", value: "9" }, { label: "Risk", value: "Low" }],
    assetType: "Internal link plan",
    status: "open",
    scoreComponents: { businessRelevance: 78, conversionPotential: 70, discoveryOpportunity: 66, severity: 58, strategicAlignment: 80, urgency: 68, effort: 18, evidenceConfidence: 78, risk: 12, dependencyReadiness: 88 },
    evidenceIds: ["ev-business-profile", "ev-link-gap"],
    assumptions: ["Relevant target pages already exist or will exist after the clinic page is published.", "Links will be contextual and useful to readers."],
    dependencies: ["Finalize anchor text.", "Avoid forcing links into unrelated copy."],
    risk: "Low",
    completionCriteria: ["Fourteen contextual links added across nine pages.", "Each link points to a relevant next step.", "No navigation-only or spammy anchor text changes."],
    measurementPlan: { baseline: "Mock internal link audit found weak relationships across nine pages.", implementationEvent: "Record link update date.", comparisonWindow: "Review 30-60 days after deployment.", leadingIndicators: ["Internal link clicks", "Crawl discovery", "Target page impressions"], successSignals: ["More visits to commercial pages from supporting content", "Improved discovery of target service pages"], attributionLimits: "Internal linking effects are gradual and can be masked by broader content changes." },
  }),
];

export const additionalRecommendations = [
  "Add Organization and ProfessionalService schema", "Create an accounting software comparison page", "Publish an Australian tax-calendar content hub", "Improve image alternative text", "Fix duplicate metadata on three service pages", "Add trust indicators and two detailed case studies", "Create a Google Business Profile publishing plan",
];

export const auditIssues: AuditIssue[] = buildTechnicalAuditIssues({
  pages: technicalPageObservations,
  evidenceIds: {
    metadata: "ev-tech-metadata",
    schema: "ev-tech-schema",
    links: "ev-tech-links",
    alt: "ev-tech-alt",
    performance: "ev-tech-performance",
  },
});

export const contentGapCandidates: ContentGapCandidate[] = [
  { id: "tax-calendar", title: "The Australian small-business tax calendar", audience: "Australian small-business owners", targetService: "BAS services", intent: "Informational to commercial", funnel: "Awareness", type: "Evergreen content hub", reason: "A useful annual reference creates repeat visits and naturally introduces advisory services.", cta: "Get a deadline-ready accounting review", relatedPages: ["Tax planning", "BAS services"], relevance: 96, conversion: 72, authority: 90, competition: 58, effort: 52, evidenceIds: ["ev-business-profile", "ev-existing-pages", "ev-tax-calendar-demand"] },
  { id: "clinic-guide", title: "Bookkeeping checklist for growing medical clinics", audience: "Practice managers and clinic owners", targetService: "Bookkeeping", intent: "Commercial research", funnel: "Consideration", type: "Guide + template", reason: "It supports the highest-priority service page with useful, specialist proof.", cta: "Book a clinic bookkeeping consultation", relatedPages: ["Medical bookkeeping", "Payroll"], relevance: 98, conversion: 91, authority: 86, competition: 42, effort: 45, evidenceIds: ["ev-business-profile", "ev-existing-pages", "ev-clinic-gap", "ev-search-clinic"] },
  { id: "xero-vs", title: "Xero vs MYOB for Australian service businesses", audience: "Founders choosing accounting software", targetService: "Cloud accounting", intent: "Comparison", funnel: "Decision", type: "Comparison page", reason: "Comparison intent is close to a buying decision and fits Northstar's implementation expertise.", cta: "Choose your accounting setup with an expert", relatedPages: ["Cloud accounting", "Outsourced CFO"], relevance: 88, conversion: 88, authority: 81, competition: 68, effort: 48, evidenceIds: ["ev-business-profile", "ev-existing-pages", "ev-software-comparison"] },
  { id: "cash-flow", title: "A 13-week cash-flow forecast, explained simply", audience: "Small-business founders", targetService: "Virtual CFO", intent: "Problem solving", funnel: "Consideration", type: "Interactive template guide", reason: "It demonstrates strategic value beyond compliance work.", cta: "Build your first forecast with Northstar", relatedPages: ["Virtual CFO", "Management reporting"], relevance: 90, conversion: 79, authority: 92, competition: 51, effort: 60, evidenceIds: ["ev-business-profile", "ev-existing-pages", "ev-cash-flow-gap"] },
];

export const opportunities: ContentOpportunity[] = buildBusinessAwareContentOpportunities({
  business: businessProfile,
  pages: websitePages,
  candidates: contentGapCandidates,
});

export const generatedAssets: Record<string, GeneratedAsset> = {
  "homepage-metadata": { title: "Homepage search preview", original: "Northstar Accounting | Accounting Services", suggested: "Outsourced Accounting & Bookkeeping Australia | Northstar", explanation: "This version describes the offer, market and brand in one readable line.", rationale: "It aligns with commercial intent without repeating keywords or making ranking promises.", tone: "Clear and assured", keyword: "outsourced accounting Australia" },
  "medical-bookkeeping": { title: "Medical-clinic landing page", original: "No dedicated page exists.", suggested: "# Bookkeeping built for busy medical clinics\n\nSpend less time reconciling accounts and more time running your practice. Northstar helps Australian clinics manage payroll, BAS, cash flow and monthly reporting with a dedicated accounting team that understands the rhythm of healthcare.\n\n## Know where your clinic stands—every month\nWe turn scattered financial data into a clear view of performance, upcoming obligations and decisions that need your attention.\n\n**CTA: Book a 20-minute clinic finance review**", explanation: "The draft leads with the clinic owner’s job-to-be-done and supports it with relevant service specifics.", rationale: "A unique specialist page can match focused commercial intent better than a broad bookkeeping page.", tone: "Professional, warm and plain-spoken", keyword: "bookkeeping for medical clinics" },
};

export const competitors = [
  { name: "LedgerWise", type: "Simulated competitor", service: 74, content: 86, technical: 79, trust: 66, local: 81, conversion: 62, authority: 83 },
  { name: "ClearBooks AU", type: "Simulated competitor", service: 82, content: 71, technical: 73, trust: 84, local: 69, conversion: 78, authority: 70 },
  { name: "Northstar", type: "Your demo project", service: 88, content: 58, technical: 72, trust: 76, local: 52, conversion: 64, authority: 61 },
];

export const outcomeScenarios: OutcomeScenario[] = [
  { recommendationId: "homepage-metadata", implementationDate: "2026-07-01", baselinePeriod: "1 Jun-30 Jun 2026", comparisonPeriod: "2 Jul-22 Jul 2026", baseline: { impressions: 4200, clicks: 88, ctr: 2.1, enquiries: 7 }, comparison: { impressions: 4380, clicks: 123, ctr: 2.81, enquiries: 9 }, externalEvents: ["Minor brand campaign ran during the comparison period."] },
  { recommendationId: "consultation-ctas", implementationDate: "2026-07-05", baselinePeriod: "5 Jun-4 Jul 2026", comparisonPeriod: "6 Jul-22 Jul 2026", baseline: { ctaClicks: 41, enquiries: 6 }, comparison: { ctaClicks: 58, enquiries: 8 }, externalEvents: ["Shorter comparison window; sample size remains small."] },
];

export const outcomeLearningRecords = buildOutcomeLearningRecords(recommendations, outcomeScenarios);

export const growthSignals = buildGrowthSignals({
  recommendations,
  auditIssues,
  opportunities,
  aiVisibility: aiVisibilitySummaries,
  citationGaps: citationGapActions,
  outcomes: outcomeLearningRecords,
});

export const unifiedGrowthDecisions = buildUnifiedGrowthDecisions(growthSignals);

// CITE-001 — normalized citation intelligence over the demo AI observations.
export const citationIntelligence = extractCitations({
  observations: aiVisibilityObservations,
  firstPartyDomain: "northstaraccounting.com.au",
  competitors: ["LedgerWise", "ClearBooks AU"],
});

// AIV-002 — a reproducible timestamped observation run for the top prompt family.
export const latestObservationRun = runObservations({
  family: aiVisibilityPromptFamilies[0],
  runId: "run-northstar-clinic-2026-07-23",
  observedAt: now,
  seed: 20260723,
  brand: "Northstar Accounting",
  firstPartyDomain: "northstaraccounting.com.au",
  competitors: ["LedgerWise", "ClearBooks AU"],
});

// CRAWL-002 — page-purpose inventory and service coverage gaps.
export const siteInventory = buildSiteInventory({ pages: technicalPageObservations, business: businessProfile });

// TSEO-002 — AI/search crawler accessibility findings from a demo robots setup.
export const aiAccessFindings = auditAiAccess({
  robotsTxt: "User-agent: *\nAllow: /\nDisallow: /drafts\nSitemap: https://northstaraccounting.com.au/sitemap.xml\n\nUser-agent: GPTBot\nDisallow: /",
  sitemapFound: true,
  pageRobotsDirectives: { "/cloud-accounting": "noindex" },
});

// CONTENT-001/002 — content inventory and refresh candidates for the demo pages.
const contentTargets: Record<string, { query: string; updated: string; proof: boolean; cta: boolean }> = {
  "/": { query: "outsourced accounting Australia", updated: "2024-02-01T00:00:00.000Z", proof: false, cta: true },
  "/bookkeeping": { query: "bookkeeping services", updated: now, proof: false, cta: false },
  "/payroll": { query: "payroll services", updated: now, proof: true, cta: false },
  "/cloud-accounting": { query: "cloud accounting setup", updated: now, proof: true, cta: true },
  "/virtual-cfo": { query: "virtual cfo services", updated: now, proof: true, cta: true },
};
export const contentInventory = buildContentInventory(
  technicalPageObservations.map((observation) => {
    const target = contentTargets[observation.url] ?? { query: observation.pageType, updated: now, proof: false, cta: false };
    return { observation, targetQuery: target.query, purpose: observation.pageType, lastUpdated: target.updated, hasProof: target.proof, hasClearCta: target.cta };
  }),
);
export const contentRefreshCandidates = detectRefreshCandidates(contentInventory);

// SEARCH-001 — ranked prompt/topic opportunities from the demo demand provider.
export const promptOpportunities: PromptOpportunity[] = buildDemandProxy({
  signals: demoDemandSignals({ services: businessProfile.services, audiences: businessProfile.audienceSegments, market: businessProfile.market }),
  business: businessProfile,
});

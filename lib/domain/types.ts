export type Severity = "critical" | "high" | "quick-win" | "monitor" | "ignore";
export type Status = "open" | "in-progress" | "completed";
export type Confidence = "High" | "Medium" | "Low";

export type EvidenceKind =
  | "CRAWL_OBSERVATION"
  | "SEARCH_CONSOLE_METRIC"
  | "ANALYTICS_METRIC"
  | "KEYWORD_PROVIDER_ESTIMATE"
  | "SERP_OBSERVATION"
  | "AI_ANSWER_OBSERVATION"
  | "CITATION_OBSERVATION"
  | "COMPETITOR_OBSERVATION"
  | "USER_SUPPLIED"
  | "AI_INFERENCE"
  | "CALCULATED"
  | "SIMULATED";

export type EvidenceReliability = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export interface EvidenceReference {
  id: string;
  organizationId: string;
  projectId: string;
  kind: EvidenceKind;
  source: string;
  sourceRecordId?: string;
  observedAt?: string;
  retrievedAt: string;
  validUntil?: string;
  reliability: EvidenceReliability;
  isEstimated: boolean;
  isSimulated: boolean;
  summary: string;
  normalizedValue?: unknown;
  metadata?: Record<string, unknown>;
}

export interface RecommendationScoreComponents {
  businessRelevance: number;
  conversionPotential: number;
  discoveryOpportunity: number;
  severity: number;
  strategicAlignment: number;
  urgency: number;
  effort: number;
  evidenceConfidence: number;
  risk: number;
  dependencyReadiness: number;
}

export interface RecommendationMeasurementPlan {
  baseline: string;
  implementationEvent: string;
  comparisonWindow: string;
  leadingIndicators: string[];
  successSignals: string[];
  attributionLimits: string;
}

export interface BusinessProfileSnapshot {
  id: string;
  name: string;
  market: string;
  industry: string;
  goal: string;
  audienceSegments: string[];
  services: string[];
  differentiators: string[];
  tone: string;
}

export interface WebsitePageProfile {
  id: string;
  url: string;
  title: string;
  pageType: "home" | "service" | "industry" | "content" | "location" | "comparison";
  services: string[];
  audiences: string[];
  funnelStage: string;
}

export interface Recommendation {
  id: string;
  rank: number;
  category: string;
  severity: Severity;
  title: string;
  explanation: string;
  action: string;
  impact: "High" | "Medium" | "Low";
  effort: string;
  effortScore: number;
  confidence: Confidence;
  priorityScore: number;
  outcome: string;
  metrics: { label: string; value: string }[];
  assetType: string;
  status: Status;
  scoreComponents: RecommendationScoreComponents;
  scoreExplanation: string;
  evidenceIds: string[];
  assumptions: string[];
  dependencies: string[];
  risk: "Low" | "Medium" | "High";
  completionCriteria: string[];
  measurementPlan: RecommendationMeasurementPlan;
}

export interface AuditIssue {
  id: string;
  ruleId: string;
  category: string;
  severity: Severity;
  title: string;
  description: string;
  recommendedAction: string;
  affectedPages: number;
  evidenceIds: string[];
  impactArea: "discovery" | "indexability" | "metadata" | "structured-data" | "internal-linking" | "accessibility" | "performance";
}

export interface TechnicalPageObservation {
  id: string;
  url: string;
  statusCode: number;
  title?: string;
  description?: string;
  canonical?: string;
  h1Count: number;
  wordCount: number;
  hasViewport: boolean;
  hasStructuredData: boolean;
  imageCount: number;
  imagesMissingAlt: number;
  internalLinkCount: number;
  pageType: WebsitePageProfile["pageType"];
  hasClearCta?: boolean;
  hasProofSignal?: boolean;
}

export interface CrawledPageEvidence {
  /** Raw HTML is kept in-memory for the deep rule engine and omitted from persistence. */
  rawHtml?: string;
  url: string;
  finalUrl: string;
  statusCode: number;
  title?: string;
  description?: string;
  canonical?: string;
  /** From `<html lang>` or content-language meta when present. */
  language?: string;
  h1Count: number;
  headings: { level: number; text: string }[];
  imageCount: number;
  imagesMissingAlt: number;
  internalLinkCount: number;
  externalLinkCount: number;
  wordCount: number;
  hasViewport: boolean;
  hasStructuredData: boolean;
  robotsDirectives?: string;
  openGraphTags: number;
  twitterTags: number;
  /** Heuristic: page has a clear CTA pattern (button/link text). */
  hasClearCta: boolean;
  /** Heuristic: page mentions proof patterns (case study, testimonial, certified…). */
  hasProofSignal: boolean;
  observedAt: string;
  source: "safe-crawler";
}

export interface AIVisibilityPromptFamily {
  id: string;
  topic: string;
  buyingStage: "awareness" | "consideration" | "decision";
  persona: string;
  geography: string;
  prompts: string[];
}

export interface AIVisibilityCitation {
  url: string;
  domain: string;
  title: string;
}

export interface AIVisibilityObservation {
  id: string;
  familyId: string;
  exactPrompt: string;
  platform: "ChatGPT" | "Gemini" | "Claude" | "Perplexity" | "Copilot";
  model: string;
  locale: string;
  runId: string;
  observedAt: string;
  rawResponse: string;
  brandMentions: string[];
  competitorMentions: string[];
  citations: AIVisibilityCitation[];
  sentiment: "positive" | "neutral" | "negative";
  extractionConfidence: number;
  isSimulated: boolean;
}

export interface AIVisibilitySummary {
  familyId: string;
  topic: string;
  sampleSize: number;
  brandMentionFrequency: number;
  competitorMentionFrequency: Record<string, number>;
  citedDomainFrequency: Record<string, number>;
  citationStability: number;
  answerConsistency: number;
  sentimentDistribution: Record<string, number>;
  evidenceIds: string[];
  conclusion: string;
  recommendedAction: string;
}

export interface CitationGapAction {
  id: string;
  familyId: string;
  title: string;
  gapType: "first-party-page" | "source-strengthening" | "third-party-source";
  explanation: string;
  recommendedAction: string;
  evidenceIds: string[];
  citedDomains: string[];
  missingFirstPartyCitation: boolean;
  competitorCitations: string[];
  assumptions: string[];
  measurementPlan: string[];
  confidence: Confidence;
}

export interface OutcomeLearningRecord {
  id: string;
  recommendationId: string;
  recommendationTitle: string;
  baselinePeriod: string;
  implementationDate: string;
  comparisonPeriod: string;
  baselineMetrics: { label: string; value: number; unit: string }[];
  comparisonMetrics: { label: string; value: number; unit: string }[];
  observedChanges: { label: string; delta: number; unit: string; direction: "up" | "down" | "flat" }[];
  externalEvents: string[];
  attributionLimitations: string;
  outcomeConfidence: Confidence;
  followUpAction: string;
}

export interface GrowthSignal {
  id: string;
  source: "technical" | "content" | "ai-visibility" | "citation" | "outcome";
  title: string;
  evidenceIds: string[];
  businessRelevance: number;
  discoveryOpportunity: number;
  conversionPotential: number;
  evidenceStrength: number;
  effort: number;
  risk: number;
  urgency: number;
}

export interface UnifiedGrowthDecision {
  id: string;
  title: string;
  decision: string;
  priorityScore: number;
  whyNow: string;
  sourceSignals: string[];
  evidenceIds: string[];
  guardrails: string[];
  nextAction: string;
  measurement: string;
}

/** The six product-facing "intelligences" that compose Growth Intelligence. */
export type GrowthPillarId =
  | "search"
  | "technical"
  | "business"
  | "content"
  | "ai-visibility"
  | "marketing";

/** Presentation summary of one pillar for the Growth Intelligence header. */
export interface PillarSummary {
  id: GrowthPillarId;
  label: string;
  signalCount: number;
  topSignalTitle: string | null;
  evidenceIds: string[];
  labels: string[];
}

/** Unified payload returned by the Growth Intelligence endpoint and dashboard. */
export interface GrowthIntelligenceReport {
  domain: string;
  generatedAt: string;
  pillars: PillarSummary[];
  decisions: UnifiedGrowthDecision[];
  guardrails: string[];
  labels: string[];
  evidenceIds: string[];
}

export interface ContentOpportunity {
  id: string;
  title: string;
  audience: string;
  intent: string;
  funnel: string;
  type: string;
  reason: string;
  cta: string;
  relatedPages: string[];
  relevance: number;
  conversion: number;
  authority: number;
  competition: number;
  effort: number;
  evidenceIds: string[];
  scoreExplanation: string;
  assumptions: string[];
  completionCriteria: string[];
  brief: {
    objective: string;
    angle: string;
    sections: string[];
    factsToVerify: string[];
    internalLinks: string[];
    measurementPlan: string[];
  };
}

export interface GeneratedAsset {
  title: string;
  original: string;
  suggested: string;
  explanation: string;
  rationale: string;
  tone: string;
  keyword: string;
}

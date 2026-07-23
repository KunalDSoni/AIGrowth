import type { AuditIssue, EvidenceReference, RecommendationScoreComponents } from "@/lib/domain/types";
import type { SiteSummary } from "@/lib/engines/site-audit";
import type { GeoResult } from "@/lib/analyze/types";
import {
  rankCandidates,
  type RecommendationCandidate,
  type RankedCandidate,
} from "@/lib/engines/recommendation-bus";
import type { AccessFinding } from "@/lib/engines/ai-access";
import type { CoverageGap } from "@/lib/engines/site-inventory";
import type { PromptOpportunity } from "@/lib/engines/demand-proxy";
import type { CompetitorGap } from "@/lib/engines/competitor-intelligence";
import type { CitationGapAction } from "@/lib/domain/types";
import { applyGoalWeights, type ProjectGoals } from "@/lib/engines/live-intelligence";

const SEVERITY_SCORE: Record<AuditIssue["severity"], number> = {
  critical: 95,
  high: 75,
  "quick-win": 55,
  monitor: 35,
  ignore: 10,
};

function scores(partial: Partial<RecommendationScoreComponents>): RecommendationScoreComponents {
  return {
    businessRelevance: 70,
    conversionPotential: 55,
    discoveryOpportunity: 60,
    severity: 50,
    strategicAlignment: 65,
    urgency: 50,
    effort: 40,
    evidenceConfidence: 70,
    risk: 30,
    dependencyReadiness: 80,
    ...partial,
  };
}

export interface NextActionsInput {
  projectId: string;
  domain: string;
  brandGuess: string;
  site: SiteSummary;
  siteIssues: AuditIssue[];
  pageIssues: AuditIssue[];
  geo: GeoResult;
  evidence: EvidenceReference[];
  coverageGaps?: CoverageGap[];
  aiAccess?: AccessFinding[];
  searchOpportunities?: PromptOpportunity[];
  competitorGaps?: CompetitorGap[];
  contentRefreshUrls?: string[];
  goals?: ProjectGoals;
  citationGaps?: CitationGapAction[];
}

export function buildNextActions(input: NextActionsInput): RankedCandidate[] {
  const candidates: RecommendationCandidate[] = [];
  const evidenceByKind = (kind: EvidenceReference["kind"]) =>
    input.evidence.filter((e) => e.kind === kind).map((e) => e.id);

  const crawlEvidence = evidenceByKind("CRAWL_OBSERVATION");
  const techEvidence = [...crawlEvidence, ...evidenceByKind("CALCULATED")];
  const aiEvidence = evidenceByKind("AI_ANSWER_OBSERVATION");
  const citationEvidence = [...aiEvidence, ...evidenceByKind("CITATION_OBSERVATION")];

  const issuePool = [...input.siteIssues, ...input.pageIssues];
  const seenRules = new Set<string>();
  for (const issue of issuePool) {
    if (seenRules.has(issue.ruleId)) continue;
    if (issue.severity === "ignore") continue;
    seenRules.add(issue.ruleId);
    const evidenceIds = issue.evidenceIds.length ? issue.evidenceIds : techEvidence.slice(0, 1);
    if (!evidenceIds.length) continue;
    candidates.push({
      id: `seo-${issue.ruleId}`,
      source: "technical",
      title: issue.title,
      action: issue.recommendedAction,
      evidenceIds,
      scoreComponents: scores({
        severity: SEVERITY_SCORE[issue.severity],
        effort: issue.severity === "quick-win" || issue.severity === "monitor" ? 20 : 45,
        urgency: issue.severity === "critical" ? 90 : issue.severity === "high" ? 70 : 40,
        discoveryOpportunity: issue.impactArea === "metadata" || issue.impactArea === "indexability" ? 75 : 55,
        evidenceConfidence: 85,
      }),
    });
  }

  if (input.geo.sampleSize > 0 && aiEvidence.length) {
    if (input.geo.brandMentionRate < 50) {
      candidates.push({
        id: "geo-brand-mention-gap",
        source: "ai-visibility",
        title: `${input.brandGuess} is rarely mentioned in AI answers`,
        action: `Publish clearer entity and service pages so AI systems can name ${input.brandGuess} with confidence.`,
        evidenceIds: aiEvidence.slice(0, 3),
        scoreComponents: scores({
          discoveryOpportunity: 90,
          businessRelevance: 85,
          severity: 70,
          evidenceConfidence: 60,
          effort: 55,
          urgency: 65,
        }),
      });
    }
    if (input.geo.firstPartyCitationShare === 0 && citationEvidence.length) {
      candidates.push({
        id: "geo-citation-gap",
        source: "citation",
        title: "AI answers cite other domains, not yours",
        action: `Strengthen citeable first-party pages on ${input.domain} (FAQs, service proofs, unique data) so models have something to link.`,
        evidenceIds: citationEvidence.slice(0, 3),
        scoreComponents: scores({
          discoveryOpportunity: 88,
          businessRelevance: 80,
          severity: 65,
          evidenceConfidence: 55,
          effort: 60,
          urgency: 60,
        }),
      });
    }
    if (input.geo.brandMentionRate >= 50 && input.geo.firstPartyCitationShare > 0) {
      candidates.push({
        id: "geo-monitor-visibility",
        source: "ai-visibility",
        title: "Maintain AI visibility coverage",
        action: "Re-run GEO probes monthly and expand citeable content for prompts where mention rate is weakest.",
        evidenceIds: aiEvidence.slice(0, 2),
        scoreComponents: scores({
          discoveryOpportunity: 50,
          severity: 30,
          effort: 25,
          evidenceConfidence: 60,
          urgency: 30,
        }),
      });
    }
  }

  for (const gap of (input.coverageGaps ?? []).slice(0, 3)) {
    if (!crawlEvidence.length) break;
    candidates.push({
      id: `coverage-${gap.service.toLowerCase().replace(/\s+/g, "-")}`,
      source: "content",
      title: `Missing page coverage for ${gap.service}`,
      action: gap.reason,
      evidenceIds: crawlEvidence.slice(0, 1),
      scoreComponents: scores({
        businessRelevance: 85,
        conversionPotential: 70,
        discoveryOpportunity: 75,
        severity: 60,
        evidenceConfidence: 55,
        effort: 50,
      }),
    });
  }

  for (const finding of (input.aiAccess ?? []).filter((f) => f.severity === "critical" || f.severity === "warning").slice(0, 2)) {
    if (!techEvidence.length) break;
    candidates.push({
      id: `access-${finding.id}`,
      source: "technical",
      title: finding.title,
      action: `${finding.detail} Caveat: ${finding.caveat}`,
      evidenceIds: techEvidence.slice(0, 1),
      scoreComponents: scores({
        severity: finding.severity === "critical" ? 90 : 65,
        discoveryOpportunity: 80,
        evidenceConfidence: 75,
        urgency: finding.severity === "critical" ? 85 : 55,
      }),
    });
  }

  for (const opp of (input.searchOpportunities ?? []).slice(0, 3)) {
    if (!crawlEvidence.length) break;
    candidates.push({
      id: `search-${opp.id}`,
      source: "search",
      title: `Topic opportunity: ${opp.query}`,
      action: `Create or improve a ${opp.intent} page targeting "${opp.query}" (${opp.labels.join(", ")}).`,
      evidenceIds: crawlEvidence.slice(0, 1),
      scoreComponents: scores({
        businessRelevance: opp.businessRelevance,
        discoveryOpportunity: opp.demandProxy,
        conversionPotential: opp.funnelStage === "decision" ? 80 : 55,
        severity: 45,
        evidenceConfidence: opp.isEstimated ? 40 : 70,
        effort: 55,
      }),
    });
  }

  for (const gap of (input.competitorGaps ?? []).slice(0, 2)) {
    if (!aiEvidence.length) break;
    candidates.push({
      id: gap.id,
      source: "competitor",
      title: `${gap.competitor} ${gap.gapType} gap`,
      action: gap.detail,
      evidenceIds: aiEvidence.slice(0, 2),
      scoreComponents: scores({
        discoveryOpportunity: gap.competitorRate,
        businessRelevance: 70,
        severity: 55,
        evidenceConfidence: gap.confidence === "Medium" ? 55 : 40,
        effort: 60,
      }),
    });
  }

  for (const gap of (input.citationGaps ?? []).slice(0, 2)) {
    if (!citationEvidence.length && !aiEvidence.length) break;
    candidates.push({
      id: gap.id,
      source: "citation",
      title: gap.title,
      action: gap.recommendedAction,
      evidenceIds: gap.evidenceIds.length ? gap.evidenceIds : (citationEvidence.length ? citationEvidence : aiEvidence).slice(0, 2),
      scoreComponents: scores({
        discoveryOpportunity: 85,
        businessRelevance: 80,
        severity: gap.gapType === "first-party-page" ? 70 : 55,
        evidenceConfidence: gap.confidence === "Medium" ? 55 : 40,
        effort: 55,
        urgency: 60,
      }),
    });
  }

  for (const url of (input.contentRefreshUrls ?? []).slice(0, 2)) {
    if (!crawlEvidence.length) break;
    candidates.push({
      id: `refresh-${url.replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}`,
      source: "content",
      title: `Refresh thin/weak page ${url}`,
      action: "Add proof, clearer CTA, and deeper coverage based on live crawl signals.",
      evidenceIds: crawlEvidence.slice(0, 1),
      scoreComponents: scores({
        businessRelevance: 65,
        discoveryOpportunity: 55,
        severity: 40,
        evidenceConfidence: 60,
        effort: 45,
      }),
    });
  }

  let ranked = rankCandidates(candidates).slice(0, 16);
  if (input.goals) ranked = applyGoalWeights(ranked, input.goals).slice(0, 12);
  else ranked = ranked.slice(0, 12);
  return ranked;
}

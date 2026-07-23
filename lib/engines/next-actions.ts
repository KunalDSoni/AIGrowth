import type { AuditIssue, EvidenceReference, RecommendationScoreComponents } from "@/lib/domain/types";
import type { SiteSummary } from "@/lib/engines/site-audit";
import type { GeoResult } from "@/lib/analyze/types";
import {
  rankCandidates,
  type RecommendationCandidate,
  type RankedCandidate,
} from "@/lib/engines/recommendation-bus";

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

  return rankCandidates(candidates).slice(0, 12);
}

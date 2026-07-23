/**
 * Marketing OS — shared domain types (Phases 1–5).
 */

export type PackStatus = "draft" | "review" | "approved" | "shipped";
export type ImprovisationBucket = "fix" | "publish" | "promote" | "measure";
export type Channel =
  | "site"
  | "content"
  | "email"
  | "linkedin"
  | "local"
  | "outreach"
  | "experiment"
  | "paid-lite";

export type PackType =
  | "SERVICE"
  | "FAQ"
  | "HOME"
  | "LOCAL"
  | "OUTREACH"
  | "SDR"
  | "EXPERIMENT"
  | "REFRESH"
  | "COMPARE"
  | "ENTITY"
  | "GBP"
  | "EMAIL-NURTURE"
  | "LINKEDIN"
  | "SCHEMA"
  | "ANSWER";

export interface MarketingKpi {
  id: string;
  label: string;
  value: string;
  previous?: string;
  deltaPct?: number;
  hint?: string;
}

export interface ImprovisationStep {
  id: string;
  bucket: ImprovisationBucket;
  title: string;
  detail: string;
  effortHours: number;
  tacticId?: string;
  packType?: PackType;
  evidenceIds: string[];
}

export interface MarketingTactic {
  id: string;
  title: string;
  channel: Channel;
  rationale: string;
  priority: number;
  packType: PackType;
  evidenceIds: string[];
}

export interface CampaignAsset {
  kind: string;
  title: string;
  body: string;
  claimChecks: string[];
  claimFlags?: { text: string; reason: string; severity: string }[];
}

export interface CampaignPack {
  id: string;
  packType: PackType;
  tacticId: string;
  goal: string;
  status: PackStatus;
  assets: CampaignAsset[];
  measurementPlan: string;
  effortHours: number;
  evidenceIds: string[];
  createdAt: string;
  siteFactsUsed?: string[];
  generation?: "deterministic" | "gemini" | "hybrid";
}

export interface ChannelMix {
  channel: Channel;
  hours: number;
  pct: number;
}

export interface PlanMilestone {
  window: "30" | "60" | "90";
  title: string;
  items: string[];
}

export interface PositionReport {
  id: string;
  brand: string;
  domain: string;
  generatedAt: string;
  mode: "client" | "strategist";
  scoreboard: {
    seoReadiness: number;
    geoMentionRate: number;
    geoSampleSize: number;
    competitorPressure: "low" | "medium" | "high";
    labels: string[];
  };
  chapters: { id: string; title: string; body: string; bullets: string[] }[];
  improvisation: ImprovisationStep[];
  tactics: MarketingTactic[];
  kpis: MarketingKpi[];
}

export interface OutreachTarget {
  id: string;
  domain: string;
  class: string;
  why: string;
  status: "todo" | "pitched" | "follow-up" | "won" | "lost";
  pitch?: string;
}

export interface WeeklyGrowthPack {
  id: string;
  weekOf: string;
  summary: string;
  wins: string[];
  risks: string[];
  nextActions: string[];
  positionDelta: string;
}

export interface AgencyClient {
  id: string;
  name: string;
  domain: string;
  stage: string;
  lastReportAt?: string;
  score: number;
}

export interface MarketingPod {
  id: string;
  clientId: string;
  status: "idle" | "running" | "awaiting-approval" | "error";
  lastLoopAt?: string;
  nextLoopAt?: string;
  loopNotes: string[];
}

export interface SimulationResult {
  tacticId: string;
  expectedLeadLiftBand: string;
  confidence: "Low" | "Medium" | "High";
  assumptions: string[];
  costHours: number;
}

export interface ConnectorStatus {
  id: "gsc" | "ga4" | "wordpress" | "shopify" | "gbp";
  label: string;
  status: "connected" | "not_configured" | "stub";
  detail: string;
}

export interface AgentRunStep {
  agent: string;
  status: "ok" | "needs_approval" | "skipped";
  summary: string;
  at: string;
}

export interface MarketingOSSnapshot {
  phaseCoverage: number[];
  report: PositionReport;
  channelMix: ChannelMix[];
  plan: PlanMilestone[];
  packs: CampaignPack[];
  outreach: OutreachTarget[];
  weekly: WeeklyGrowthPack;
  agencyClients: AgencyClient[];
  pods: MarketingPod[];
  simulations: SimulationResult[];
  connectors: ConnectorStatus[];
  agentLog: AgentRunStep[];
  learning: { tacticId: string; score: number; note: string }[];
  geoDepth: {
    whyNotCited: string[];
    answerGaps: string[];
    citationClasses: { class: string; count: number }[];
  };
}

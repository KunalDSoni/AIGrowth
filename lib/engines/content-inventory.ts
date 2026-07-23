import type { TechnicalPageObservation } from "@/lib/domain/types";

/**
 * Content Inventory + Quality/Refresh Engine (EPIC CONTENT-001 / CONTENT-002).
 *
 * CONTENT-001 builds an inventory that works with simulated metrics now and real
 * Search Console data later. CONTENT-002 inspects the inventory for decay, weak
 * coverage, missing proof, unclear CTAs and duplicate coverage, emitting refresh
 * recommendation candidates. All performance values are explicitly source-labelled.
 */

export type PerformanceSource = "simulated" | "search-console" | "analytics";
export type ContentStatus = "healthy" | "thin" | "stale" | "duplicate" | "underperforming";

export interface ContentInventoryItem {
  url: string;
  targetQuery: string;
  purpose: string;
  wordCount: number;
  impressions: number;
  clicks: number;
  position: number;
  seoValue: number;
  lastUpdated: string;
  hasProof: boolean;
  hasClearCta: boolean;
  status: ContentStatus;
  performanceSource: PerformanceSource;
}

export interface ContentInventoryInput {
  observation: TechnicalPageObservation;
  targetQuery: string;
  purpose: string;
  lastUpdated: string;
  hasProof?: boolean;
  hasClearCta?: boolean;
  metrics?: { impressions: number; clicks: number; position: number; source: PerformanceSource };
}

const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

/** Deterministic simulated metrics derived from observed page attributes. */
function simulateMetrics(obs: TechnicalPageObservation): { impressions: number; clicks: number; position: number } {
  const base = obs.wordCount + obs.internalLinkCount * 30;
  const impressions = Math.round(base * 1.5);
  const position = Math.max(1, Math.round(20 - obs.internalLinkCount - (obs.hasStructuredData ? 3 : 0)));
  const ctr = Math.max(0.005, 0.35 / position);
  const clicks = Math.round(impressions * ctr);
  return { impressions, clicks, position };
}

function seoValue(item: { clicks: number; position: number; wordCount: number }): number {
  return clamp(item.clicks * 0.4 + (100 - item.position * 4) * 0.4 + Math.min(100, item.wordCount / 10) * 0.2);
}

export function buildContentInventory(inputs: ContentInventoryInput[], now: Date = new Date()): ContentInventoryItem[] {
  const items = inputs.map((input) => {
    const metrics = input.metrics ?? { ...simulateMetrics(input.observation), source: "simulated" as PerformanceSource };
    const wordCount = input.observation.wordCount;
    const value = seoValue({ clicks: metrics.clicks, position: metrics.position, wordCount });
    const item: ContentInventoryItem = {
      url: input.observation.url,
      targetQuery: input.targetQuery,
      purpose: input.purpose,
      wordCount,
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      position: metrics.position,
      seoValue: value,
      lastUpdated: input.lastUpdated,
      hasProof: input.hasProof ?? false,
      hasClearCta: input.hasClearCta ?? false,
      status: "healthy",
      performanceSource: metrics.source,
    };
    item.status = classifyStatus(item, now);
    return item;
  });

  markDuplicates(items);
  return items;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function ageDays(lastUpdated: string, now: Date): number {
  return Math.max(0, Math.round((now.getTime() - new Date(lastUpdated).getTime()) / DAY_MS));
}

function classifyStatus(item: ContentInventoryItem, now: Date): ContentStatus {
  if (item.wordCount < 300) return "thin";
  if (ageDays(item.lastUpdated, now) > 365) return "stale";
  if (item.position > 15 && item.impressions > 100) return "underperforming";
  return "healthy";
}

function markDuplicates(items: ContentInventoryItem[]): void {
  const byQuery = new Map<string, ContentInventoryItem[]>();
  for (const item of items) {
    const key = item.targetQuery.trim().toLowerCase();
    byQuery.set(key, [...(byQuery.get(key) ?? []), item]);
  }
  for (const group of byQuery.values()) {
    if (group.length > 1) {
      // Keep the strongest page as-is; the rest are competing duplicate coverage.
      // (Thin/underperforming signals still surface via raw fields in the
      // refresh detector, so no evidence is lost by relabelling here.)
      const [, ...rest] = [...group].sort((a, b) => b.seoValue - a.seoValue);
      for (const item of rest) item.status = "duplicate";
    }
  }
}

export interface RefreshCandidate {
  url: string;
  reasons: string[];
  targetQuery: string;
  priority: number;
}

/**
 * CONTENT-002 — inspect the inventory and emit refresh candidates with concrete,
 * evidence-based reasons. A page with no issues produces no candidate.
 */
export function detectRefreshCandidates(items: ContentInventoryItem[], now: Date = new Date()): RefreshCandidate[] {
  const candidates: RefreshCandidate[] = [];
  for (const item of items) {
    const reasons: string[] = [];
    if (item.status === "thin" || item.wordCount < 300) reasons.push("Thin content: too few words to cover the topic credibly.");
    if (ageDays(item.lastUpdated, now) > 365) reasons.push("Stale: not updated in over a year.");
    if (item.position > 15 && item.impressions > 100) reasons.push("Underperforming: ranks poorly despite demand.");
    if (!item.hasProof) reasons.push("Missing proof: no case study, data or trust signal.");
    if (!item.hasClearCta) reasons.push("Unclear CTA: no obvious next step for the reader.");
    if (item.status === "duplicate") reasons.push("Duplicate coverage: another page targets the same query more strongly.");

    if (reasons.length === 0) continue;
    const priority = clamp(item.seoValue * 0.5 + reasons.length * 10 + (item.impressions > 500 ? 15 : 0));
    candidates.push({ url: item.url, targetQuery: item.targetQuery, reasons, priority });
  }
  return candidates.sort((a, b) => b.priority - a.priority);
}

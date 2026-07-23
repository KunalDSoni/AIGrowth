/**
 * Intent, Funnel, and Topic Cluster Engine (EPIC SEARCH-002).
 *
 * Classifies a query/prompt by buyer intent and funnel stage, and groups related
 * queries into topic clusters. Every classification is deterministic, carries a
 * confidence and the matched signals, and can be corrected by a user override.
 */

export type SearchIntent =
  | "informational"
  | "commercial"
  | "transactional"
  | "local"
  | "comparison"
  | "navigational";

export type FunnelStage = "awareness" | "consideration" | "decision";

export interface IntentClassification {
  query: string;
  intent: SearchIntent;
  funnelStage: FunnelStage;
  recommendedContentType: string;
  confidence: number;
  signals: string[];
}

export interface TopicCluster {
  id: string;
  label: string;
  members: string[];
}

const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

const PATTERNS: { intent: SearchIntent; re: RegExp; weight: number }[] = [
  { intent: "comparison", re: /\b(vs|versus|compare|comparison|alternative|alternatives|better than)\b/, weight: 90 },
  { intent: "transactional", re: /\b(buy|price|pricing|cost|quote|hire|book|sign up|near me now)\b/, weight: 85 },
  { intent: "local", re: /\b(near me|in [a-z]+|local|sydney|melbourne|london|city|area)\b/, weight: 78 },
  { intent: "navigational", re: /\b(login|log in|sign in|contact|official|homepage|website)\b/, weight: 80 },
  { intent: "commercial", re: /\b(best|top|recommended|provider|providers|services|company|companies|for)\b/, weight: 70 },
  { intent: "informational", re: /\b(how|what|why|guide|tips|checklist|explained|meaning|examples)\b/, weight: 65 },
];

const FUNNEL_BY_INTENT: Record<SearchIntent, FunnelStage> = {
  informational: "awareness",
  commercial: "consideration",
  comparison: "decision",
  transactional: "decision",
  local: "decision",
  navigational: "decision",
};

const CONTENT_TYPE: Record<SearchIntent, string> = {
  informational: "Guide or how-to article",
  commercial: "Service or solution page",
  comparison: "Comparison page",
  transactional: "Conversion-focused landing page",
  local: "Location page",
  navigational: "Branded/utility page",
};

export function classifyIntent(query: string, override?: { intent?: SearchIntent; funnelStage?: FunnelStage }): IntentClassification {
  const q = query.toLowerCase();
  const signals: string[] = [];
  let best: { intent: SearchIntent; weight: number } | null = null;

  for (const p of PATTERNS) {
    if (p.re.test(q)) {
      signals.push(`Matched ${p.intent} pattern`);
      if (!best || p.weight > best.weight) best = { intent: p.intent, weight: p.weight };
    }
  }

  const intent = override?.intent ?? best?.intent ?? "informational";
  const funnelStage = override?.funnelStage ?? FUNNEL_BY_INTENT[intent];
  const overridden = Boolean(override?.intent || override?.funnelStage);
  const confidence = overridden ? 100 : clamp(best?.weight ?? 40);
  if (overridden) signals.push("User override applied");

  return {
    query,
    intent,
    funnelStage,
    recommendedContentType: CONTENT_TYPE[intent],
    confidence,
    signals: signals.length ? signals : ["No strong signal; defaulted to informational"],
  };
}

const STOP = new Set(["the", "a", "an", "for", "to", "of", "in", "on", "and", "or", "is", "are", "with", "your", "my", "how", "what", "why", "best", "top", "vs", "versus", "near", "me"]);

function keywords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/**
 * Group queries into topic clusters by shared salient keywords. Greedy and
 * deterministic: the first unassigned query seeds a cluster, and any query
 * sharing a keyword joins it.
 */
export function clusterTopics(queries: string[]): TopicCluster[] {
  const remaining = [...new Set(queries)];
  const clusters: TopicCluster[] = [];

  while (remaining.length > 0) {
    const seed = remaining.shift()!;
    const seedWords = new Set(keywords(seed));
    const members = [seed];

    for (let i = remaining.length - 1; i >= 0; i--) {
      const words = keywords(remaining[i]);
      if (words.some((w) => seedWords.has(w))) {
        members.push(remaining[i]);
        remaining.splice(i, 1);
      }
    }

    const label = [...seedWords][0] ?? seed;
    clusters.push({ id: `cluster-${clusters.length + 1}-${label}`, label, members: members.reverse() });
  }

  return clusters;
}

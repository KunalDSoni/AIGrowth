/**
 * Observer — records what the world currently looks like.
 *
 * Skipping cheaply is the point: most ticks find no crawl delta and must cost
 * nothing. A provider failure degrades the step to `skipped`, never `failed` —
 * Gemini 429s are routine and must not block a run.
 */

import type { Agent, RunContext, ShouldRunVerdict } from "@/lib/agents/agent";
import type { ProposalDraft, StepResult } from "@/lib/agents/types";

export interface ObservedSeo {
  score: number;
  pagesScanned: number;
  contentHash: string;
  issues: string[];
}

export interface ObservedGeo {
  mentionRate: number;
  sampleSize: number;
  model: string;
  citedOthers: string[];
}

export interface ObserverDeps {
  scan: (url: string) => Promise<ObservedSeo>;
  probe: (input: { brand: string; domain: string }) => Promise<ObservedGeo>;
  lastObservation?: (clientId: string) => Promise<ObservedSeo | null>;
}

export function createObserverAgent(deps: ObserverDeps): Agent {
  return {
    name: "observer",
    costClass: "expensive",

    async shouldRun(ctx: RunContext): Promise<ShouldRunVerdict> {
      if (!deps.lastObservation) return { run: true, reason: "no observation history" };

      const previous = await deps.lastObservation(ctx.client.id);
      if (!previous) return { run: true, reason: "no prior observation" };

      const current = await deps.scan(`https://${ctx.client.domain}/`);
      if (current.contentHash === previous.contentHash) {
        return { run: false, reason: "no crawl delta since last observation" };
      }
      return { run: true, reason: "crawl delta detected" };
    },

    async execute(ctx: RunContext): Promise<StepResult> {
      const started = ctx.now().getTime();

      let seo: ObservedSeo;
      let geo: ObservedGeo;
      try {
        seo = await deps.scan(`https://${ctx.client.domain}/`);
        geo = await deps.probe({ brand: ctx.client.brand, domain: ctx.client.domain });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          status: "skipped",
          proposals: [],
          cost: { tokens: 0, apiCalls: 1, ms: ctx.now().getTime() - started },
          notes: [`Observation degraded: ${message}`],
        };
      }

      const day = ctx.now().toISOString().slice(0, 10);
      const proposal: ProposalDraft = {
        kind: "create",
        target: { type: "observation" },
        payload: { seo, geo },
        rationale: `SEO ${seo.score}/100 across ${seo.pagesScanned} pages; answer mention rate ${geo.mentionRate.toFixed(0)}% on n=${geo.sampleSize} (${geo.model}).`,
        evidenceIds: [],
        riskTier: "low",
        dedupeKey: `observation:${day}`,
        estimatedImpact: "Baseline reading — no direct impact",
        effortHours: 0,
        costToProduce: 0,
      };

      return {
        status: "ok",
        proposals: [proposal],
        cost: { tokens: 0, apiCalls: 2, ms: ctx.now().getTime() - started },
        notes: [`Scanned ${seo.pagesScanned} pages`, `GEO sample n=${geo.sampleSize}`],
      };
    },
  };
}

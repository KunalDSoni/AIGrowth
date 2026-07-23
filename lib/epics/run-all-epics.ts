/**
 * Full epic suite runner — executes every EPIC_INDEX epic against a live AnalyzeResult.
 * Deterministic, evidence-grounded, no demo Northstar datasets.
 */

import type { AnalyzeResult } from "@/lib/analyze/types";
import type { AnalyzeDelta, AnalyzeSnapshot } from "@/lib/engines/analyze-delta";
import { buildLiveIntelligence, type BusinessProfileOverrides, type LiveIntelligence } from "@/lib/engines/live-intelligence";
import { ALL_EPIC_IDS, assertAllEpicsCovered, type EpicId, type EpicResult } from "@/lib/epics/registry";
import { runBizEpics } from "@/lib/epics/clusters/biz";
import { runCrawlEpics } from "@/lib/epics/clusters/crawl";
import { runTseoEpics } from "@/lib/epics/clusters/tseo";
import { runSearchEpics } from "@/lib/epics/clusters/search";
import { runContentEpics } from "@/lib/epics/clusters/content";
import { runAivEpics } from "@/lib/epics/clusters/aiv";
import { runCiteEpics } from "@/lib/epics/clusters/cite";
import { runCompEpics } from "@/lib/epics/clusters/comp";
import { runRecEpics } from "@/lib/epics/clusters/rec";
import { runGenEpics } from "@/lib/epics/clusters/gen";
import { runOrchEpics } from "@/lib/epics/clusters/orch";
import { runLearnEpics } from "@/lib/epics/clusters/learn";

export interface EpicSuiteInput {
  result: AnalyzeResult;
  overrides?: BusinessProfileOverrides;
  history?: AnalyzeSnapshot[];
  delta?: AnalyzeDelta | null;
  intelligence?: LiveIntelligence;
}

export interface EpicSuiteOutput {
  epics: EpicResult[];
  byId: Record<EpicId, EpicResult>;
  intelligence: LiveIntelligence;
  completedCount: number;
  totalCount: number;
  complete: true;
}

export function runAllEpics(input: EpicSuiteInput): EpicSuiteOutput {
  const intelligence =
    input.intelligence ??
    buildLiveIntelligence(input.result, {
      overrides: input.overrides,
      nextActions: input.result.nextActions,
      history: input.history,
      priorPages: input.history?.[0]?.pages,
    });

  const ctx = { result: input.result, intelligence, history: input.history ?? [], delta: input.delta ?? null };

  const epics: EpicResult[] = [
    ...runBizEpics(ctx),
    ...runCrawlEpics(ctx),
    ...runTseoEpics(ctx),
    ...runSearchEpics(ctx),
    ...runContentEpics(ctx),
    ...runAivEpics(ctx),
    ...runCiteEpics(ctx),
    ...runCompEpics(ctx),
    ...runRecEpics(ctx),
    ...runGenEpics(ctx),
    ...runOrchEpics(ctx),
    ...runLearnEpics(ctx),
  ];

  assertAllEpicsCovered(epics);

  const byId = Object.fromEntries(epics.map((e) => [e.epicId, e])) as Record<EpicId, EpicResult>;

  return {
    epics,
    byId,
    intelligence,
    completedCount: epics.length,
    totalCount: ALL_EPIC_IDS.length,
    complete: true,
  };
}

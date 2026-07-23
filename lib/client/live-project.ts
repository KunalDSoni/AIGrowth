"use client";

import { useEffect, useState } from "react";
import type { AnalyzeResult } from "@/lib/analyze/types";
import { LIVE_ANALYZE_KEY } from "@/lib/client/live-project-key";
import { buildLiveIntelligence } from "@/lib/engines/live-intelligence";

export { LIVE_ANALYZE_KEY };

export function readLiveAnalyze(): AnalyzeResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LIVE_ANALYZE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AnalyzeResult;
    if (parsed?.project?.domain && parsed?.seo?.site && parsed?.geo) {
      if (!parsed.intelligence) {
        parsed.intelligence = buildLiveIntelligence(parsed, undefined, parsed.nextActions);
      }
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function writeLiveAnalyze(result: AnalyzeResult) {
  if (typeof window === "undefined") return;
  try {
    const slim: AnalyzeResult = {
      ...result,
      seo: {
        ...result.seo,
        robotsTxt: result.seo.robotsTxt ? result.seo.robotsTxt.slice(0, 4000) : result.seo.robotsTxt,
      },
      geo: {
        ...result.geo,
        observations: result.geo.observations.map((obs) => ({
          ...obs,
          rawResponse: (obs.rawResponse ?? "").slice(0, 1200),
        })),
      },
    };
    localStorage.setItem(LIVE_ANALYZE_KEY, JSON.stringify(slim));
  } catch {
    /* quota */
  }
}

export function useLiveAnalyze() {
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setResult(readLiveAnalyze());
    setReady(true);
  }, []);

  return { result, ready, hasLive: Boolean(result), setResult };
}

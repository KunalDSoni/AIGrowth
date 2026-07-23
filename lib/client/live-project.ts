"use client";

import { useEffect, useState } from "react";
import type { AnalyzeResult } from "@/lib/analyze/types";

export const LIVE_ANALYZE_KEY = "opengrowth:analyze:last";

export function readLiveAnalyze(): AnalyzeResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LIVE_ANALYZE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AnalyzeResult;
    if (parsed?.project?.domain && parsed?.seo?.site && parsed?.geo) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export function useLiveAnalyze() {
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setResult(readLiveAnalyze());
    setReady(true);
  }, []);

  return { result, ready, hasLive: Boolean(result) };
}

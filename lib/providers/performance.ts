/**
 * PerformanceProvider (MDM-004) — Core Web Vitals + performance audit.
 *
 *  - `mock`       : deterministic offline metrics; zero dependencies (default).
 *  - `psi`        : Google PageSpeed Insights API (free key) over fetch.
 *  - `lighthouse` : local headless Lighthouse; lazy-imported, opt-in.
 *
 * Metrics are normalized into the existing AuditIssue type so they flow through
 * the technical-audit pipeline unchanged.
 */

import type { AuditIssue } from "@/lib/domain/types";
import type { MeasurementLabel } from "@/lib/providers/measurement";

export interface PerformanceMetrics {
  performanceScore: number; // 0-100
  lcpMs?: number;
  cls?: number;
  inpMs?: number;
  tbtMs?: number;
}

export interface PerformanceResult {
  url: string;
  metrics: PerformanceMetrics;
  issues: AuditIssue[];
  source: string;
  measurement: MeasurementLabel;
  observedAt: string;
}

export interface PerformanceProvider {
  readonly source: string;
  audit(url: string): Promise<PerformanceResult>;
}

// Web Vitals "good" thresholds (field guidance).
const THRESHOLDS = { lcpMs: 2500, cls: 0.1, inpMs: 200, tbtMs: 200 };

export function metricsToIssues(url: string, m: PerformanceMetrics): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const add = (ruleId: string, title: string, value: string) =>
    issues.push({
      id: `perf-${ruleId}-${encodeURIComponent(url)}`,
      ruleId,
      category: "performance",
      severity: m.performanceScore < 50 ? "high" : "quick-win",
      title,
      description: `${title}: ${value}.`,
      recommendedAction: "Optimize the offending resources (images, JS, layout stability).",
      affectedPages: 1,
      evidenceIds: [],
      impactArea: "performance",
    });
  if (m.lcpMs !== undefined && m.lcpMs > THRESHOLDS.lcpMs) add("lcp", "Largest Contentful Paint above target", `${m.lcpMs}ms`);
  if (m.cls !== undefined && m.cls > THRESHOLDS.cls) add("cls", "Cumulative Layout Shift above target", `${m.cls}`);
  if (m.inpMs !== undefined && m.inpMs > THRESHOLDS.inpMs) add("inp", "Interaction to Next Paint above target", `${m.inpMs}ms`);
  if (m.tbtMs !== undefined && m.tbtMs > THRESHOLDS.tbtMs) add("tbt", "Total Blocking Time above target", `${m.tbtMs}ms`);
  return issues;
}

export class MockPerformanceProvider implements PerformanceProvider {
  readonly source = "mock";

  async audit(url: string): Promise<PerformanceResult> {
    const metrics: PerformanceMetrics = { performanceScore: 78, lcpMs: 2100, cls: 0.05, inpMs: 180, tbtMs: 150 };
    return { url, metrics, issues: metricsToIssues(url, metrics), source: "mock", measurement: "simulated", observedAt: new Date(0).toISOString() };
  }
}

export class PsiPerformanceProvider implements PerformanceProvider {
  readonly source = "psi";
  constructor(
    private readonly apiKey: string | undefined,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async audit(url: string): Promise<PerformanceResult> {
    const api = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
    api.searchParams.set("url", url);
    api.searchParams.set("strategy", "mobile");
    if (this.apiKey) api.searchParams.set("key", this.apiKey);
    const res = await this.fetchImpl(api, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`PSI returned ${res.status}`);
    const data = (await res.json()) as {
      lighthouseResult?: { categories?: { performance?: { score?: number } }; audits?: Record<string, { numericValue?: number }> };
    };
    const audits = data.lighthouseResult?.audits ?? {};
    const metrics: PerformanceMetrics = {
      performanceScore: Math.round((data.lighthouseResult?.categories?.performance?.score ?? 0) * 100),
      lcpMs: audits["largest-contentful-paint"]?.numericValue,
      cls: audits["cumulative-layout-shift"]?.numericValue,
      inpMs: audits["interaction-to-next-paint"]?.numericValue,
      tbtMs: audits["total-blocking-time"]?.numericValue,
    };
    return { url, metrics, issues: metricsToIssues(url, metrics), source: "psi", measurement: "measured", observedAt: new Date().toISOString() };
  }
}

/** Local Lighthouse. Lazy-imported; throws a clear error if not installed. */
export class LighthousePerformanceProvider implements PerformanceProvider {
  readonly source = "lighthouse";

  async audit(url: string): Promise<PerformanceResult> {
    const lhPkg = "lighthouse";
    const chromePkg = "chrome-launcher";
    let lighthouse: (u: string, o: unknown) => Promise<{ lhr: { categories: { performance: { score: number } }; audits: Record<string, { numericValue?: number }> } }>;
    let launcher: { launch: (o: unknown) => Promise<{ port: number; kill: () => Promise<void> }> };
    try {
      lighthouse = ((await import(/* webpackIgnore: true */ lhPkg)) as { default: typeof lighthouse }).default;
      launcher = (await import(/* webpackIgnore: true */ chromePkg)) as typeof launcher;
    } catch {
      throw new Error("lighthouse/chrome-launcher not installed. Set OPENGROWTH_PERF=psi|mock or install them.");
    }
    const chrome = await launcher.launch({ chromeFlags: ["--headless"] });
    try {
      const { lhr } = await lighthouse(url, { port: chrome.port, onlyCategories: ["performance"] });
      const metrics: PerformanceMetrics = {
        performanceScore: Math.round(lhr.categories.performance.score * 100),
        lcpMs: lhr.audits["largest-contentful-paint"]?.numericValue,
        cls: lhr.audits["cumulative-layout-shift"]?.numericValue,
        inpMs: lhr.audits["interaction-to-next-paint"]?.numericValue,
        tbtMs: lhr.audits["total-blocking-time"]?.numericValue,
      };
      return { url, metrics, issues: metricsToIssues(url, metrics), source: "lighthouse", measurement: "measured", observedAt: new Date().toISOString() };
    } finally {
      await chrome.kill();
    }
  }
}

export function getPerformanceProvider(env: Record<string, string | undefined> = process.env): PerformanceProvider {
  switch (env.OPENGROWTH_PERF) {
    case "psi":
      return new PsiPerformanceProvider(env.PSI_API_KEY);
    case "lighthouse":
      return new LighthousePerformanceProvider();
    default:
      return new MockPerformanceProvider();
  }
}

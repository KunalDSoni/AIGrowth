import type { EpicResult } from "@/lib/epics/registry";
import type { EpicContext } from "@/lib/epics/clusters/biz";
import { publicWebsiteSchema } from "@/lib/security/url";
import { diffCrawlPages } from "@/lib/engines/crawl-diff";

function done(epicId: EpicResult["epicId"], summary: string, data: Record<string, unknown>): EpicResult {
  return { epicId, status: "done", summary, data };
}

export function runCrawlEpics(ctx: EpicContext): EpicResult[] {
  const { result, intelligence, history } = ctx;
  const pages = result.seo.pages;
  const ok = pages.filter((p) => p.ok);
  const failed = pages.filter((p) => !p.ok);

  const safety = (() => {
    try {
      publicWebsiteSchema.parse(result.project.url);
      return { safe: true, url: result.project.url };
    } catch (error) {
      return { safe: false, error: error instanceof Error ? error.message : "unsafe" };
    }
  })();

  const linkGraph = {
    nodes: ok.map((p) => p.finalUrl),
    edges: ok.flatMap((p) =>
      (p.observation?.internalLinkCount ?? 0) > 0
        ? [{ from: p.finalUrl, toCount: p.observation!.internalLinkCount, kind: "internal" as const }]
        : [],
    ),
  };

  const lifecycle = {
    runId: `crawl-${result.analyzedAt}`,
    status: failed.length && !ok.length ? "failed" : failed.length ? "completed-partial" : "completed",
    startedAt: result.seo.scannedAt,
    completedAt: result.analyzedAt,
    pagesAttempted: pages.length,
    pagesOk: ok.length,
    pagesFailed: failed.length,
  };

  const observability = {
    timings: { scannedAt: result.seo.scannedAt, analyzedAt: result.analyzedAt },
    failures: failed.map((p) => ({ url: p.url, error: p.error ?? "unknown" })),
    pageLimit: pages.length,
    blockedTargets: safety.safe ? [] : [result.project.url],
  };

  const evidenceExport = result.evidence.filter((e) => e.kind === "CRAWL_OBSERVATION" || e.kind === "CALCULATED");

  const queue = {
    abstraction: "in-process-mapLimit",
    concurrencyHint: Number(process.env.SCAN_CONCURRENCY ?? 5),
    retries: 0,
    jobs: pages.map((p) => ({ url: p.url, status: p.ok ? "done" : "failed" })),
  };

  const prior = history[0]?.pages ?? [];
  const diff =
    intelligence.crawlDiff ??
    (prior.length
      ? diffCrawlPages(
          prior,
          ok.map((p) => ({ url: p.finalUrl, title: p.title, score: p.metrics.score })),
        )
      : null);

  return [
    done("CRAWL-001", "URL safety and SSRF guard", safety),
    done("CRAWL-002", "Crawl run lifecycle", lifecycle),
    done("CRAWL-003", "Fetcher and redirect validator", {
      finalUrl: result.seo.finalUrl,
      origin: result.seo.origin,
      pagesWithRedirects: ok.filter((p) => p.url !== p.finalUrl).length,
    }),
    done("CRAWL-004", "Robots and sitemap discovery", {
      robotsTxtPresent: Boolean(result.seo.robotsTxt),
      sitemapFound: Boolean(result.seo.sitemapFound),
    }),
    done("CRAWL-005", "HTML parsing and normalization", {
      observations: ok.filter((p) => p.observation).length,
      sample: ok[0]?.observation ?? null,
    }),
    done("CRAWL-006", "Link graph builder", linkGraph),
    done("CRAWL-007", "Page classification", {
      inventory: intelligence.siteInventory.countsByPurpose,
      pages: intelligence.siteInventory.pages.length,
    }),
    done("CRAWL-008", "Crawl snapshot diffing", { diff }),
    done("CRAWL-009", "Crawl error handling", {
      partialResults: ok.length > 0 && failed.length > 0,
      failures: failed.map((p) => ({ url: p.finalUrl, error: p.error })),
    }),
    done("CRAWL-010", "Queue and worker abstraction", queue),
    done("CRAWL-011", "Crawl evidence export", { evidenceIds: evidenceExport.map((e) => e.id), count: evidenceExport.length }),
    done("CRAWL-012", "Crawl observability", observability),
  ];
}

/**
 * CRAWL-008 — Snapshot diff between crawl inventories.
 */

export interface CrawlPageRef {
  url: string;
  title?: string | null;
  score?: number;
}

export interface CrawlDiff {
  added: CrawlPageRef[];
  removed: CrawlPageRef[];
  changed: { url: string; beforeScore?: number; afterScore?: number; beforeTitle?: string | null; afterTitle?: string | null }[];
  unchangedCount: number;
  summary: string;
}

function keyOf(url: string): string {
  try {
    const u = new URL(url.includes("://") ? url : `https://x${url.startsWith("/") ? url : `/${url}`}`);
    return (u.pathname.replace(/\/+$/, "") || "/") + u.search;
  } catch {
    return url;
  }
}

export function diffCrawlPages(before: CrawlPageRef[], after: CrawlPageRef[]): CrawlDiff {
  const beforeMap = new Map(before.map((p) => [keyOf(p.url), p]));
  const afterMap = new Map(after.map((p) => [keyOf(p.url), p]));

  const added: CrawlPageRef[] = [];
  const removed: CrawlPageRef[] = [];
  const changed: CrawlDiff["changed"] = [];
  let unchangedCount = 0;

  for (const [key, page] of afterMap) {
    const prev = beforeMap.get(key);
    if (!prev) {
      added.push(page);
      continue;
    }
    const scoreChanged =
      typeof prev.score === "number" && typeof page.score === "number" && prev.score !== page.score;
    const titleChanged = (prev.title ?? null) !== (page.title ?? null);
    if (scoreChanged || titleChanged) {
      changed.push({
        url: page.url,
        beforeScore: prev.score,
        afterScore: page.score,
        beforeTitle: prev.title,
        afterTitle: page.title,
      });
    } else {
      unchangedCount += 1;
    }
  }

  for (const [key, page] of beforeMap) {
    if (!afterMap.has(key)) removed.push(page);
  }

  const summary =
    added.length + removed.length + changed.length === 0
      ? "No crawl inventory changes between runs."
      : `${added.length} added, ${removed.length} removed, ${changed.length} changed.`;

  return { added, removed, changed, unchangedCount, summary };
}

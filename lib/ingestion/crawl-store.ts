/**
 * Crawl store + incremental diff (OSI-006).
 *
 * Persists raw multi-page crawls per domain (mirroring the file-backed store
 * convention rooted at OPENGROWTH_DATA_DIR) so re-runs and indexing don't
 * re-fetch, and so a recrawl can be diffed against the previous run via the
 * existing crawl-diff engine to answer "what changed since last scan".
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { dataDir } from "@/lib/storage/data-dir";
import type { CrawledPageEvidence } from "@/lib/domain/types";
import { diffCrawlPages, type CrawlDiff, type CrawlPageRef } from "@/lib/engines/crawl-diff";

export interface CrawlRun {
  domain: string;
  crawledAt: string;
  pages: CrawledPageEvidence[];
}

type StoreShape = Record<string, CrawlRun[]>; // domain -> runs (oldest first)

function storePath(): string {
  return dataDir("crawl-runs.json");
}

function readStore(): StoreShape {
  const path = storePath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as StoreShape;
  } catch {
    return {};
  }
}

function writeStore(store: StoreShape): void {
  const path = storePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(store, null, 2), "utf8");
}

function domainKey(domain: string): string {
  return domain.replace(/^https?:\/\//, "").replace(/\/+$/, "").toLowerCase();
}

/** Content fingerprint used as the diff "score" so content changes surface as `changed`. */
function fingerprint(page: CrawledPageEvidence): number {
  const basis = `${page.title ?? ""}|${page.wordCount}|${page.h1Count}|${page.hasStructuredData}`;
  let hash = 2166136261;
  for (let i = 0; i < basis.length; i++) {
    hash ^= basis.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function toRefs(pages: CrawledPageEvidence[]): CrawlPageRef[] {
  return pages.map((p) => ({ url: p.finalUrl || p.url, title: p.title ?? null, score: fingerprint(p) }));
}

export function loadRuns(domain: string): CrawlRun[] {
  return readStore()[domainKey(domain)] ?? [];
}

export function latestRun(domain: string): CrawlRun | undefined {
  const runs = loadRuns(domain);
  return runs[runs.length - 1];
}

/** Persist a new crawl run, keeping at most `keep` most-recent runs per domain. */
export function saveRun(domain: string, pages: CrawledPageEvidence[], keep = 5): CrawlRun {
  const store = readStore();
  const key = domainKey(domain);
  const run: CrawlRun = { domain: key, crawledAt: new Date().toISOString(), pages };
  const runs = [...(store[key] ?? []), run].slice(-keep);
  store[key] = runs;
  writeStore(store);
  return run;
}

/** Diff the newest run against the one before it (or against provided pages). */
export function diffAgainstPrevious(domain: string, current?: CrawledPageEvidence[]): CrawlDiff | null {
  const runs = loadRuns(domain);
  const after = current ?? runs[runs.length - 1]?.pages;
  const before = current ? runs[runs.length - 1]?.pages : runs[runs.length - 2]?.pages;
  if (!after || !before) return null;
  return diffCrawlPages(toRefs(before), toRefs(after));
}

/** Crawl → persist → diff in one call. Returns the run and the change delta (if any). */
export function recordCrawl(domain: string, pages: CrawledPageEvidence[]): { run: CrawlRun; diff: CrawlDiff | null } {
  const previous = latestRun(domain)?.pages;
  const run = saveRun(domain, pages);
  const diff = previous ? diffCrawlPages(toRefs(previous), toRefs(pages)) : null;
  return { run, diff };
}

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AnalyzeResult } from "@/lib/analyze/types";
import {
  compareAnalyzeSnapshots,
  toSnapshot,
  type AnalyzeDelta,
  type AnalyzeSnapshot,
} from "@/lib/engines/analyze-delta";
import { dataDir } from "@/lib/storage/data-dir";

/** Normalize a URL or hostname to a stable domain key (no www.). */
export function domainKey(urlOrDomain: string): string {
  let host = urlOrDomain.trim().toLowerCase();
  try {
    if (!host.includes("://")) host = `https://${host}`;
    host = new URL(host).hostname;
  } catch {
    host = host.replace(/^https?:\/\//, "").split("/")[0] ?? host;
  }
  return host.replace(/^www\./, "");
}

export interface ProjectBundle {
  latest: AnalyzeResult;
  /** Newest-first slim history (excludes current latest duplicate). */
  history: AnalyzeSnapshot[];
}

export interface ProjectStore {
  save(result: AnalyzeResult): Promise<void>;
  loadLatest(domain: string): Promise<AnalyzeResult | null>;
  loadBundle(domain: string): Promise<ProjectBundle | null>;
  loadDelta(domain: string): Promise<AnalyzeDelta | null>;
}

const MAX_HISTORY = 20;

export function createFileProjectStore(baseDir: string): ProjectStore {
  function pathFor(domain: string) {
    return join(baseDir, `${domainKey(domain)}.json`);
  }

  async function readBundle(domain: string): Promise<ProjectBundle | null> {
    try {
      const raw = await readFile(pathFor(domain), "utf8");
      const parsed = JSON.parse(raw) as ProjectBundle | AnalyzeResult;
      // Migrate legacy single-result files.
      if (parsed && "latest" in parsed && parsed.latest) {
        return {
          latest: parsed.latest,
          history: Array.isArray(parsed.history) ? parsed.history : [],
        };
      }
      if (parsed && "project" in parsed && "seo" in parsed) {
        return { latest: parsed as AnalyzeResult, history: [] };
      }
      return null;
    } catch {
      return null;
    }
  }

  return {
    async save(result) {
      await mkdir(baseDir, { recursive: true });
      const existing = await readBundle(result.project.domain);
      const history = existing
        ? [toSnapshot(existing.latest), ...existing.history].slice(0, MAX_HISTORY)
        : [];
      // Avoid duplicate consecutive snapshots with identical analyzedAt.
      const deduped =
        history[0]?.analyzedAt === result.analyzedAt ? history.slice(1) : history;
      const bundle: ProjectBundle = { latest: result, history: deduped };
      await writeFile(pathFor(result.project.domain), JSON.stringify(bundle, null, 2), "utf8");
    },

    async loadLatest(domain) {
      const bundle = await readBundle(domain);
      return bundle?.latest ?? null;
    },

    async loadBundle(domain) {
      return readBundle(domain);
    },

    async loadDelta(domain) {
      const bundle = await readBundle(domain);
      if (!bundle?.history[0]) return null;
      return compareAnalyzeSnapshots(bundle.history[0], toSnapshot(bundle.latest));
    },
  };
}

const DEFAULT_DIR = dataDir("projects");

let defaultStore: ProjectStore | null = null;

export function getProjectStore(): ProjectStore {
  if (!defaultStore) defaultStore = createFileProjectStore(DEFAULT_DIR);
  return defaultStore;
}

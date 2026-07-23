import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AnalyzeResult } from "@/lib/analyze/types";

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

export interface ProjectStore {
  save(result: AnalyzeResult): Promise<void>;
  loadLatest(domain: string): Promise<AnalyzeResult | null>;
}

export function createFileProjectStore(baseDir: string): ProjectStore {
  return {
    async save(result) {
      await mkdir(baseDir, { recursive: true });
      const key = domainKey(result.project.domain);
      const path = join(baseDir, `${key}.json`);
      await writeFile(path, JSON.stringify(result, null, 2), "utf8");
    },
    async loadLatest(domain) {
      const key = domainKey(domain);
      const path = join(baseDir, `${key}.json`);
      try {
        const raw = await readFile(path, "utf8");
        return JSON.parse(raw) as AnalyzeResult;
      } catch {
        return null;
      }
    },
  };
}

const DEFAULT_DIR = join(process.cwd(), ".data", "projects");

let defaultStore: ProjectStore | null = null;

export function getProjectStore(): ProjectStore {
  if (!defaultStore) defaultStore = createFileProjectStore(DEFAULT_DIR);
  return defaultStore;
}

/**
 * GEN-009 — In-memory / file-backed asset versioning for drafts.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type AssetApproval = "draft" | "reviewed" | "approved" | "rejected";

export interface AssetVersion {
  id: string;
  domain: string;
  actionId: string;
  kind: "brief" | "draft" | "metadata" | "social" | "email";
  body: string;
  approvalState: AssetApproval;
  claimFlags: { text: string; reason: string }[];
  createdAt: string;
  parentId?: string;
}

export interface AssetDiff {
  fromId: string;
  toId: string;
  addedLines: string[];
  removedLines: string[];
}

function diffText(a: string, b: string): Omit<AssetDiff, "fromId" | "toId"> {
  const aLines = new Set(a.split(/\r?\n/));
  const bLines = new Set(b.split(/\r?\n/));
  return {
    addedLines: [...bLines].filter((l) => !aLines.has(l) && l.trim()),
    removedLines: [...aLines].filter((l) => !bLines.has(l) && l.trim()),
  };
}

export function createAssetVersionStore(baseDir: string) {
  const fileFor = (domain: string) => join(baseDir, `${domain.replace(/[^a-z0-9.-]/gi, "_")}.json`);

  async function load(domain: string): Promise<AssetVersion[]> {
    try {
      const raw = await readFile(fileFor(domain), "utf8");
      return JSON.parse(raw) as AssetVersion[];
    } catch {
      return [];
    }
  }

  async function save(domain: string, versions: AssetVersion[]) {
    await mkdir(baseDir, { recursive: true });
    await writeFile(fileFor(domain), JSON.stringify(versions.slice(0, 100), null, 2), "utf8");
  }

  return {
    async append(version: AssetVersion): Promise<AssetVersion> {
      const list = await load(version.domain);
      list.unshift(version);
      await save(version.domain, list);
      return version;
    },
    async list(domain: string, actionId?: string): Promise<AssetVersion[]> {
      const list = await load(domain);
      return actionId ? list.filter((v) => v.actionId === actionId) : list;
    },
    async diff(domain: string, fromId: string, toId: string): Promise<AssetDiff | null> {
      const list = await load(domain);
      const from = list.find((v) => v.id === fromId);
      const to = list.find((v) => v.id === toId);
      if (!from || !to) return null;
      return { fromId, toId, ...diffText(from.body, to.body) };
    },
  };
}

const DEFAULT = join(process.cwd(), ".data", "assets");
let store: ReturnType<typeof createAssetVersionStore> | null = null;

export function getAssetVersionStore() {
  if (!store) store = createAssetVersionStore(DEFAULT);
  return store;
}

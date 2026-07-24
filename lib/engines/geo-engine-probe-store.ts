/**
 * GIL-EP-1 — Per-engine probe store.
 *
 * Persist the latest multi-engine probe run per domain (the per-engine
 * EngineGeoResults from ME-2), so the per-engine fix route (EP-2) can build
 * engine-tailored fixes without re-probing. File-backed, mirroring the
 * crawl-store / geo-fix-store convention rooted at OPENGROWTH_DATA_DIR.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { dataDir } from "@/lib/storage/data-dir";
import { domainKey } from "@/lib/projects/store";
import type { EngineGeoResult } from "@/lib/engines/geo-multi-engine";

type StoreShape = Record<string, EngineGeoResult[]>;

function storePath(): string {
  return dataDir("geo-engine-probes.json");
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

/** Persist the latest per-engine probe run for a domain (replaces any prior run). */
export function saveEngineProbes(domain: string, results: EngineGeoResult[]): void {
  const store = readStore();
  store[domainKey(domain)] = results;
  writeStore(store);
}

export function loadEngineProbes(domain: string): EngineGeoResult[] {
  return readStore()[domainKey(domain)] ?? [];
}

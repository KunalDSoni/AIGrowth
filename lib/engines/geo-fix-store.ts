/**
 * OPS-1 — Persistent fix-outcome store.
 *
 * File-backed per-domain store for the operational half of the GEO Influence
 * Loop: the interventions that shipped (GIL-10) and the lifts later measured for
 * them (GIL-11). Mirrors the crawl-store convention rooted at OPENGROWTH_DATA_DIR
 * so tests are isolated and the app never re-fabricates data.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { dataDir } from "@/lib/storage/data-dir";
import { domainKey } from "@/lib/projects/store";
import type { InterventionRecord } from "@/lib/engines/geo-intervention";
import type { CitationLift } from "@/lib/engines/geo-lift";

interface DomainFixState {
  interventions: InterventionRecord[];
  lifts: CitationLift[];
}

type StoreShape = Record<string, DomainFixState>;

function storePath(): string {
  return dataDir("geo-fix-outcomes.json");
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

function stateFor(store: StoreShape, key: string): DomainFixState {
  return store[key] ?? { interventions: [], lifts: [] };
}

/** Persist a shipped intervention; replaces any prior record with the same id. */
export function saveIntervention(domain: string, record: InterventionRecord): void {
  const store = readStore();
  const key = domainKey(domain);
  const state = stateFor(store, key);
  state.interventions = [...state.interventions.filter((i) => i.id !== record.id), record];
  store[key] = state;
  writeStore(store);
}

export function loadInterventions(domain: string): InterventionRecord[] {
  return stateFor(readStore(), domainKey(domain)).interventions;
}

export function findIntervention(domain: string, interventionId: string): InterventionRecord | undefined {
  return loadInterventions(domain).find((i) => i.id === interventionId);
}

/** Persist a measured lift; replaces any prior lift for the same fixId. */
export function saveLift(domain: string, lift: CitationLift): void {
  const store = readStore();
  const key = domainKey(domain);
  const state = stateFor(store, key);
  state.lifts = [...state.lifts.filter((l) => l.fixId !== lift.fixId), lift];
  store[key] = state;
  writeStore(store);
}

export function loadLifts(domain: string): CitationLift[] {
  return stateFor(readStore(), domainKey(domain)).lifts;
}

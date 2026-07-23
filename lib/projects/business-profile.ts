import { promises as fs } from "fs";
import path from "path";
import type { BusinessProfileOverrides, ProjectGoals } from "@/lib/engines/live-intelligence";
import type { ConfirmationEvent } from "@/lib/engines/business-graph";

const DATA_DIR = path.join(process.cwd(), ".data", "profiles");

export interface StoredBusinessProfile {
  domain: string;
  overrides: BusinessProfileOverrides;
  updatedAt: string;
}

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function fileFor(domain: string) {
  const safe = domain.toLowerCase().replace(/[^a-z0-9.-]/g, "_");
  return path.join(DATA_DIR, `${safe}.json`);
}

export async function loadBusinessOverrides(domain: string): Promise<BusinessProfileOverrides | null> {
  try {
    const raw = await fs.readFile(fileFor(domain), "utf8");
    const parsed = JSON.parse(raw) as StoredBusinessProfile;
    return parsed.overrides ?? null;
  } catch {
    return null;
  }
}

export async function saveBusinessOverrides(
  domain: string,
  overrides: BusinessProfileOverrides,
): Promise<StoredBusinessProfile> {
  await ensureDir();
  const existing = (await loadBusinessOverrides(domain)) ?? {};
  const merged: BusinessProfileOverrides = {
    ...existing,
    ...overrides,
    goals: overrides.goals ?? existing.goals,
    confirmations: overrides.confirmations ?? existing.confirmations,
  };
  const stored: StoredBusinessProfile = {
    domain,
    overrides: merged,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(fileFor(domain), JSON.stringify(stored, null, 2), "utf8");
  return stored;
}

export async function appendConfirmation(
  domain: string,
  event: ConfirmationEvent,
): Promise<BusinessProfileOverrides> {
  const existing = (await loadBusinessOverrides(domain)) ?? {};
  const confirmations = [...(existing.confirmations ?? []), event];
  const saved = await saveBusinessOverrides(domain, { ...existing, confirmations });
  return saved.overrides;
}

export async function saveGoals(domain: string, goals: ProjectGoals): Promise<BusinessProfileOverrides> {
  const existing = (await loadBusinessOverrides(domain)) ?? {};
  const saved = await saveBusinessOverrides(domain, { ...existing, goals });
  return saved.overrides;
}

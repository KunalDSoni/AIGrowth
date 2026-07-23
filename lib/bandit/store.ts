import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createExperiment,
  type BanditExperiment,
} from "@/lib/bandit/thompson";
import { dataDir } from "@/lib/storage/data-dir";

export interface BanditStore {
  get(experimentId: string): Promise<BanditExperiment | null>;
  save(experiment: BanditExperiment): Promise<void>;
  getOrCreateDefault(experimentId?: string): Promise<BanditExperiment>;
}

const DEFAULT_ID = "landing-cro-v1";

function defaultExperiment(id = DEFAULT_ID): BanditExperiment {
  return createExperiment({
    id,
    name: "Landing page CRO",
    arms: [
      {
        id: "control",
        label: "Control — clarity headline",
        payload: {
          headline: "Grow qualified leads from search and AI answers",
          cta: "Analyze my website",
        },
      },
      {
        id: "urgency",
        label: "Urgency — opportunity cost",
        payload: {
          headline: "Stop losing leads to slower, outdated competitors",
          cta: "See what you're missing",
        },
      },
      {
        id: "proof",
        label: "Proof — audit-first",
        payload: {
          headline: "Evidence-backed next actions for SEO + GEO",
          cta: "Get my audit",
        },
      },
    ],
  });
}

export class MemoryBanditStore implements BanditStore {
  private readonly data = new Map<string, BanditExperiment>();

  async get(experimentId: string) {
    return this.data.get(experimentId) ?? null;
  }

  async save(experiment: BanditExperiment) {
    this.data.set(experiment.id, structuredClone(experiment));
  }

  async getOrCreateDefault(experimentId = DEFAULT_ID) {
    const existing = await this.get(experimentId);
    if (existing) return existing;
    const created = defaultExperiment(experimentId);
    await this.save(created);
    return created;
  }
}

export class FileBanditStore implements BanditStore {
  constructor(private readonly dir = dataDir("bandit")) {}

  private pathFor(id: string) {
    return join(this.dir, `${id.replace(/[^a-zA-Z0-9._-]/g, "_")}.json`);
  }

  async get(experimentId: string) {
    try {
      const raw = await readFile(this.pathFor(experimentId), "utf8");
      return JSON.parse(raw) as BanditExperiment;
    } catch {
      return null;
    }
  }

  async save(experiment: BanditExperiment) {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.pathFor(experiment.id), JSON.stringify(experiment, null, 2), "utf8");
  }

  async getOrCreateDefault(experimentId = DEFAULT_ID) {
    const existing = await this.get(experimentId);
    if (existing) return existing;
    const created = defaultExperiment(experimentId);
    await this.save(created);
    return created;
  }
}

/** Redis adapter placeholder — wire when REDIS_URL is configured. */
export class RedisBanditStore implements BanditStore {
  async get(): Promise<BanditExperiment | null> {
    throw new Error("RedisBanditStore is not configured. Set REDIS_URL and implement the client adapter.");
  }
  async save(): Promise<void> {
    throw new Error("RedisBanditStore is not configured. Set REDIS_URL and implement the client adapter.");
  }
  async getOrCreateDefault(): Promise<BanditExperiment> {
    throw new Error("RedisBanditStore is not configured. Set REDIS_URL and implement the client adapter.");
  }
}

let singleton: BanditStore | null = null;

export function getBanditStore(env: Record<string, string | undefined> = process.env): BanditStore {
  if (env.OPENGROWTH_BANDIT_STORE === "memory") return new MemoryBanditStore();
  if (env.OPENGROWTH_BANDIT_STORE === "redis") return new RedisBanditStore();
  if (!singleton) singleton = new FileBanditStore();
  return singleton;
}

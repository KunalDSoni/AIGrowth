import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { getPrismaClient } from "@/lib/db/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { AuditIssue, CrawledPageEvidence, EvidenceReference } from "@/lib/domain/types";

export interface AuditRunRecord {
  id: string;
  projectId: string;
  url: string;
  source: string;
  status: "completed" | "fallback" | "failed";
  startedAt: string;
  completedAt: string;
  simulatedIssues: boolean;
  issues: AuditIssue[];
  evidence: Partial<EvidenceReference>[];
  crawl?: CrawledPageEvidence;
  crawlError?: string;
}

export interface AuditRunRepository {
  save(input: Omit<AuditRunRecord, "id"> & { id?: string }): Promise<AuditRunRecord>;
  latest(projectId: string): Promise<AuditRunRecord | null>;
  list(projectId: string): Promise<AuditRunRecord[]>;
}

interface AuditStoreFile {
  runs: AuditRunRecord[];
}

type PersistedIssue = {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  affectedPages: number;
  rawData: unknown;
};

type PersistedRun = {
  id: string;
  projectId: string;
  url: string;
  status: string;
  provider: string;
  startedAt: Date;
  completedAt: Date | null;
  metadata: unknown;
  issues: PersistedIssue[];
};

type PersistedEvidence = {
  id: string;
  projectId: string;
  kind: string;
  source: string;
  sourceRecordId: string | null;
  observedAt: Date | null;
  retrievedAt: Date;
  validUntil: Date | null;
  reliability: string;
  isEstimated: boolean;
  isSimulated: boolean;
  summary: string;
  normalizedValue: unknown;
  metadata: unknown;
};

const writeQueues = new Map<string, Promise<unknown>>();

function storePath() {
  return process.env.OPENGROWTH_AUDIT_STORE_PATH || join(process.cwd(), ".opengrowth", "audit-runs.json");
}

async function readStore(path: string): Promise<AuditStoreFile> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<AuditStoreFile>;
    return { runs: Array.isArray(parsed.runs) ? parsed.runs : [] };
  } catch {
    return { runs: [] };
  }
}

async function writeStore(path: string, store: AuditStoreFile) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(store, null, 2));
  await rename(temp, path);
}

export class FileAuditRunRepository implements AuditRunRepository {
  constructor(private readonly path = storePath()) {}

  async save(input: Omit<AuditRunRecord, "id"> & { id?: string }) {
    const previous = writeQueues.get(this.path) ?? Promise.resolve();
    const operation = previous.then(async () => {
      const store = await readStore(this.path);
      const record: AuditRunRecord = { ...input, id: input.id ?? randomUUID() };
      const runs = [record, ...store.runs.filter((run) => run.id !== record.id)].slice(0, 50);
      await writeStore(this.path, { runs });
      return record;
    });
    writeQueues.set(this.path, operation.catch(() => undefined));
    return operation;
  }

  async latest(projectId: string) {
    const store = await readStore(this.path);
    return store.runs.find((run) => run.projectId === projectId) ?? null;
  }

  async list(projectId: string) {
    const store = await readStore(this.path);
    return store.runs.filter((run) => run.projectId === projectId);
  }
}

const severityToPrisma = {
  critical: "CRITICAL",
  high: "HIGH",
  "quick-win": "QUICK_WIN",
  monitor: "MONITOR",
  ignore: "IGNORE",
} as const;

/**
 * PostgreSQL implementation of the audit repository. The API intentionally
 * matches the local file adapter so demo mode and production storage share a
 * single normalized contract.
 */
export class PrismaAuditRunRepository implements AuditRunRepository {
  constructor(
    private readonly client: PrismaClient = getPrismaClient(),
    private readonly organizationId?: string,
  ) {}

  private async assertProject(projectId: string) {
    const project = await this.client.project.findFirst({
      where: { id: projectId, ...(this.organizationId ? { organizationId: this.organizationId } : {}) },
      select: { id: true },
    });
    if (!project) throw new Error("Project not found or not accessible");
  }

  async save(input: Omit<AuditRunRecord, "id"> & { id?: string }) {
    await this.assertProject(input.projectId);
    const id = input.id ?? undefined;
    const record = await this.client.$transaction(async (tx: Prisma.TransactionClient) => {
      const run = await tx.auditRun.create({
        data: {
          ...(id ? { id } : {}),
          projectId: input.projectId,
          url: input.url,
          status: input.status,
          provider: input.source,
          startedAt: new Date(input.startedAt),
          completedAt: new Date(input.completedAt),
          metadata: {
            simulatedIssues: input.simulatedIssues,
            crawl: input.crawl,
            crawlError: input.crawlError,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      if (input.issues.length) {
        await tx.auditIssue.createMany({
          data: input.issues.map((issue) => ({
            auditRunId: run.id,
            category: issue.category,
            severity: severityToPrisma[issue.severity],
            title: issue.title,
            description: issue.description,
            affectedPages: issue.affectedPages,
            rawData: {
              ruleId: issue.ruleId,
              recommendedAction: issue.recommendedAction,
              evidenceIds: issue.evidenceIds,
              impactArea: issue.impactArea,
            },
          })),
        });
      }

      const evidence = input.evidence.filter((item) => item.summary && item.kind && item.source);
      if (evidence.length) {
        await tx.evidenceReference.createMany({
          data: evidence.map((item) => ({
            projectId: input.projectId,
            kind: item.kind as never,
            source: item.source as string,
            sourceRecordId: run.id,
            observedAt: item.observedAt ? new Date(item.observedAt) : undefined,
            retrievedAt: item.retrievedAt ? new Date(item.retrievedAt) : new Date(),
            validUntil: item.validUntil ? new Date(item.validUntil) : undefined,
            reliability: item.reliability as never,
            isEstimated: Boolean(item.isEstimated),
            isSimulated: Boolean(item.isSimulated),
            summary: item.summary as string,
            normalizedValue: item.normalizedValue as never,
            metadata: item.metadata as never,
          })),
        });
      }
      return run;
    });

    return { ...input, id: record.id };
  }

  async list(projectId: string) {
    await this.assertProject(projectId);
    const runs = await this.client.auditRun.findMany({
      where: { projectId },
      include: { issues: true },
      orderBy: { completedAt: "desc" },
    });
    const evidence = await this.client.evidenceReference.findMany({
      where: { projectId, sourceRecordId: { in: (runs as PersistedRun[]).map((run: PersistedRun) => run.id) } },
    });
    return (runs as PersistedRun[]).map((run: PersistedRun) =>
      this.toRecord(run, evidence.filter((item: PersistedEvidence) => item.sourceRecordId === run.id)),
    );
  }

  async latest(projectId: string) {
    const runs = await this.list(projectId);
    return runs[0] ?? null;
  }

  private toRecord(
    run: PersistedRun,
    evidence: PersistedEvidence[],
  ): AuditRunRecord {
    const metadata = (run.metadata ?? {}) as { simulatedIssues?: boolean; crawl?: CrawledPageEvidence; crawlError?: string };
    return {
      id: run.id,
      projectId: run.projectId,
      url: run.url,
      source: run.provider,
      status: run.status as AuditRunRecord["status"],
      startedAt: run.startedAt.toISOString(),
      completedAt: (run.completedAt ?? run.startedAt).toISOString(),
      simulatedIssues: metadata.simulatedIssues ?? (run.provider.includes("mock") || run.status === "fallback"),
      issues: run.issues.map((issue: PersistedIssue) => {
        const raw = (issue.rawData ?? {}) as Record<string, unknown>;
        return {
          id: issue.id,
          ruleId: String(raw.ruleId ?? issue.category),
          category: issue.category,
          severity: issue.severity.toLowerCase().replace("_", "-") as AuditIssue["severity"],
          title: issue.title,
          description: issue.description,
          recommendedAction: String(raw.recommendedAction ?? "Review this issue"),
          affectedPages: issue.affectedPages,
          evidenceIds: Array.isArray(raw.evidenceIds) ? raw.evidenceIds.map(String) : [],
          impactArea: (raw.impactArea ?? "discovery") as AuditIssue["impactArea"],
        };
      }),
      evidence: evidence.map((item: PersistedEvidence) => ({
        id: item.id,
        projectId: item.projectId,
        kind: item.kind as EvidenceReference["kind"],
        source: item.source,
        sourceRecordId: item.sourceRecordId ?? undefined,
        observedAt: item.observedAt?.toISOString(),
        retrievedAt: item.retrievedAt.toISOString(),
        validUntil: item.validUntil?.toISOString(),
        reliability: item.reliability as EvidenceReference["reliability"],
        isEstimated: item.isEstimated,
        isSimulated: item.isSimulated,
        summary: item.summary,
        normalizedValue: item.normalizedValue,
        metadata: (item.metadata ?? undefined) as Record<string, unknown> | undefined,
      })),
      crawl: metadata.crawl,
      crawlError: metadata.crawlError,
    };
  }
}

export function getAuditRunRepository(): AuditRunRepository {
  if (process.env.OPENGROWTH_AUDIT_STORE === "prisma") {
    return new PrismaAuditRunRepository();
  }
  return new FileAuditRunRepository();
}

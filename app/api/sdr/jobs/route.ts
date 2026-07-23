import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { DemoProspectSource, runSdrLeadPipeline, type SdrJob } from "@/lib/engines/sdr-lead-pipeline";
import { generateAuditReport } from "@/lib/engines/audit-report";

export const runtime = "nodejs";
export const maxDuration = 120;

const DIR = join(process.cwd(), ".data", "sdr-jobs");

const schema = z.object({
  niche: z.string().min(2),
  geo: z.string().min(2),
  limit: z.number().int().min(1).max(5).optional(),
});

export type { SdrJob };

async function saveJob(job: SdrJob) {
  await mkdir(DIR, { recursive: true });
  await writeFile(join(DIR, `${job.id}.json`), JSON.stringify(job, null, 2), "utf8");
}

async function loadJob(id: string): Promise<SdrJob | null> {
  try {
    return JSON.parse(await readFile(join(DIR, `${id}.json`), "utf8")) as SdrJob;
  } catch {
    return null;
  }
}

async function processJob(jobId: string, input: z.infer<typeof schema>) {
  const job = await loadJob(jobId);
  if (!job) return;
  job.status = "running";
  job.updatedAt = new Date().toISOString();
  await saveJob(job);

  try {
    const { leads, simulated } = await runSdrLeadPipeline({
      niche: input.niche,
      geo: input.geo,
      limit: input.limit ?? 3,
      source: new DemoProspectSource(),
    });
    const reports: SdrJob["reports"] = [];
    for (const lead of leads) {
      if (lead.flags.some((f) => f.code === "crawl-failed")) continue;
      const report = await generateAuditReport({ lead });
      reports.push({ leadName: lead.nap.name, url: report.stored.url, format: report.format });
    }
    job.status = "completed";
    job.simulated = simulated;
    job.leads = leads;
    job.reports = reports;
    job.updatedAt = new Date().toISOString();
    await saveJob(job);
  } catch (error) {
    job.status = "failed";
    job.error = error instanceof Error ? error.message : "SDR job failed";
    job.updatedAt = new Date().toISOString();
    await saveJob(job);
  }
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const job = await loadJob(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json(job);
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }

  const job: SdrJob = {
    id: randomUUID(),
    status: "queued",
    niche: parsed.data.niche,
    geo: parsed.data.geo,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await saveJob(job);

  // Non-blocking relative to the HTTP response: kick off work after returning 202.
  queueMicrotask(() => {
    void processJob(job.id, parsed.data);
  });

  return NextResponse.json(job, { status: 202 });
}

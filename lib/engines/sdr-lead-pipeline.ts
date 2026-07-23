/**
 * SDR lead pipeline — find niche prospects, enrich via safe crawl + audit flags.
 */

import { SafeWebsiteCrawler, type SafeCrawlerOptions } from "@/lib/providers/crawler";
import { auditCrawledPage } from "@/lib/engines/live-audit";
import { computeReadiness } from "@/lib/engines/readiness";
import { publicWebsiteSchema } from "@/lib/security/url";

export interface ProspectSeed {
  name: string;
  address?: string;
  phone?: string;
  website: string;
  source: "demo" | "places" | "directory";
  niche: string;
  geo: string;
}

export interface LeadFlag {
  code: string;
  severity: "high" | "medium" | "low";
  detail: string;
}

export interface EnrichedLead {
  nap: { name: string; address?: string; phone?: string };
  website: string;
  finalUrl?: string;
  source: ProspectSeed["source"];
  niche: string;
  geo: string;
  readinessScore?: number;
  flags: LeadFlag[];
  hasLocalBusinessSchema: boolean;
  wordCount?: number;
  enrichedAt: string;
  error?: string;
}

export interface ProspectSource {
  find(input: { niche: string; geo: string; limit?: number }): Promise<ProspectSeed[]>;
}

/** Deterministic demo prospects for local development (labelled simulated). */
export class DemoProspectSource implements ProspectSource {
  async find(input: { niche: string; geo: string; limit?: number }): Promise<ProspectSeed[]> {
    const niche = input.niche.trim() || "Local business";
    const geo = input.geo.trim() || "Local market";
    const seeds: ProspectSeed[] = [
      {
        name: `${niche} Care Center`,
        address: `12 Ring Road, ${geo}`,
        phone: "+91 79 0000 1001",
        website: "https://example.com",
        source: "demo",
        niche,
        geo,
      },
      {
        name: `City ${niche} Clinic`,
        address: `88 SG Highway, ${geo}`,
        phone: "+91 79 0000 1002",
        website: "https://example.org",
        source: "demo",
        niche,
        geo,
      },
      {
        name: `${geo} ${niche} Group`,
        address: `5 CG Road, ${geo}`,
        phone: "+91 79 0000 1003",
        website: "https://example.net",
        source: "demo",
        niche,
        geo,
      },
    ];
    return seeds.slice(0, input.limit ?? 5);
  }
}

/** Places/Maps adapter — fails until API key is configured. */
export class PlacesProspectSource implements ProspectSource {
  constructor(private readonly apiKey = process.env.GOOGLE_PLACES_API_KEY) {}

  async find(): Promise<ProspectSeed[]> {
    if (!this.apiKey?.trim()) {
      throw new Error("GOOGLE_PLACES_API_KEY is not configured. Use DemoProspectSource until Places is connected.");
    }
    throw new Error("PlacesProspectSource client not implemented — connect Places API next.");
  }
}

function hasLocalBusinessSchema(html: string): boolean {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  return blocks.some((block) => /LocalBusiness|Dentist|MedicalBusiness|Physician|Podiatric/i.test(block[1] ?? ""));
}

export async function enrichProspect(
  seed: ProspectSeed,
  options: SafeCrawlerOptions = {},
): Promise<EnrichedLead> {
  const base: EnrichedLead = {
    nap: { name: seed.name, address: seed.address, phone: seed.phone },
    website: seed.website,
    source: seed.source,
    niche: seed.niche,
    geo: seed.geo,
    flags: [],
    hasLocalBusinessSchema: false,
    enrichedAt: new Date().toISOString(),
  };

  try {
    const url = publicWebsiteSchema.parse(seed.website);
    const crawler = new SafeWebsiteCrawler(options);
    const evidence = await crawler.crawl(url, {
      timeoutMs: options.timeoutMs ?? 8000,
      maxBytes: options.maxBytes ?? 400_000,
    });
    const html = evidence.rawHtml ?? "";
    const issues = auditCrawledPage(evidence);
    const readiness = computeReadiness(issues);
    const localSchema = hasLocalBusinessSchema(html);

    const flags: LeadFlag[] = [];
    if (readiness.score < 70) {
      flags.push({
        code: "poor-readiness",
        severity: readiness.score < 50 ? "high" : "medium",
        detail: `Readiness score ${readiness.score} (${readiness.band}) with ${readiness.critical} critical issues.`,
      });
    }
    if ((evidence.wordCount ?? 0) < 250) {
      flags.push({
        code: "thin-content",
        severity: "medium",
        detail: `Homepage word count ${evidence.wordCount} looks thin for commercial intent.`,
      });
    }
    if (!localSchema) {
      flags.push({
        code: "missing-local-schema",
        severity: "high",
        detail: "No LocalBusiness (or niche) JSON-LD detected on the homepage.",
      });
    }
    if (!evidence.hasClearCta) {
      flags.push({
        code: "unclear-cta",
        severity: "low",
        detail: "No clear CTA language detected on the homepage sample.",
      });
    }

    return {
      ...base,
      website: url,
      finalUrl: evidence.finalUrl,
      readinessScore: readiness.score,
      flags,
      hasLocalBusinessSchema: localSchema,
      wordCount: evidence.wordCount,
      enrichedAt: evidence.observedAt,
    };
  } catch (error) {
    return {
      ...base,
      flags: [
        {
          code: "crawl-failed",
          severity: "high",
          detail: error instanceof Error ? error.message : "Crawl failed",
        },
      ],
      error: error instanceof Error ? error.message : "Crawl failed",
    };
  }
}

export type SdrJob = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  niche: string;
  geo: string;
  simulated?: boolean;
  leads?: EnrichedLead[];
  reports?: Array<{ leadName: string; url: string; format: string }>;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export async function runSdrLeadPipeline(input: {
  niche: string;
  geo: string;
  limit?: number;
  source?: ProspectSource;
  crawlerOptions?: SafeCrawlerOptions;
}): Promise<{ leads: EnrichedLead[]; simulated: boolean }> {
  const source = input.source ?? new DemoProspectSource();
  const seeds = await source.find({ niche: input.niche, geo: input.geo, limit: input.limit });
  const leads: EnrichedLead[] = [];
  for (const seed of seeds) {
    leads.push(await enrichProspect(seed, input.crawlerOptions));
  }
  return { leads, simulated: source instanceof DemoProspectSource };
}

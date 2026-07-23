export interface ExtractedCitation {
  url: string;
  domain: string;
  classification: "first-party" | "other";
}

export interface BrandExtraction {
  brandMentioned: boolean;
  brandMentions: string[];
  citations: ExtractedCitation[];
}

function registrableHint(host: string): string {
  const parts = host.replace(/^www\./, "").toLowerCase().split(".");
  if (parts.length >= 2) return parts.slice(-2).join(".");
  return host.toLowerCase();
}

export function extractBrandSignals(rawText: string, brandGuess: string, domain: string): BrandExtraction {
  const text = rawText ?? "";
  const brand = brandGuess.trim();
  const domainLabel = domain.replace(/^www\./, "").split(".")[0] ?? domain;
  const patterns = [brand, domainLabel].filter((p) => p.length >= 2);
  const brandMentions: string[] = [];
  for (const pattern of patterns) {
    const re = new RegExp(`\\b${escapeRegExp(pattern)}\\b`, "i");
    if (re.test(text)) brandMentions.push(pattern);
  }
  const firstParty = registrableHint(domain);
  const citations: ExtractedCitation[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(/https?:\/\/[^\s)\]>"']+/gi)) {
    const url = match[0].replace(/[.,;]+$/, "");
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");
      if (seen.has(host + u.pathname)) continue;
      seen.add(host + u.pathname);
      citations.push({
        url: u.toString(),
        domain: host,
        classification: registrableHint(host) === firstParty ? "first-party" : "other",
      });
    } catch {
      // skip bad URLs
    }
  }
  return {
    brandMentioned: brandMentions.length > 0,
    brandMentions,
    citations,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

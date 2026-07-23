import type { BusinessProfileSnapshot, TechnicalPageObservation } from "@/lib/domain/types";

/**
 * Site Inventory and Page Classification (EPIC CRAWL-002).
 *
 * Turns raw per-page crawl observations into a purpose-classified inventory and
 * compares it against the business's declared services to surface coverage gaps.
 * Classification is heuristic and deterministic, always carries a confidence and
 * the evidence it reasoned from, and can be overridden by a human.
 */

export type PagePurpose =
  | "homepage"
  | "service"
  | "industry"
  | "location"
  | "article"
  | "comparison"
  | "faq"
  | "legal"
  | "unknown";

export interface ClassifiedPage {
  url: string;
  purpose: PagePurpose;
  confidence: number;
  signals: string[];
  overridden: boolean;
}

export interface CoverageGap {
  service: string;
  reason: string;
}

export interface SiteInventory {
  pages: ClassifiedPage[];
  countsByPurpose: Record<PagePurpose, number>;
  coverageGaps: CoverageGap[];
}

const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

const LEGAL = /(privacy|terms|cookie|disclaimer|gdpr)/;
const FAQ = /(faq|frequently-asked|questions)/;
const COMPARISON = /(vs|versus|compare|comparison|alternative)/;
const LOCATION = /(sydney|melbourne|brisbane|perth|london|new-york|near-me|location|city)/;
const ARTICLE = /(blog|article|guide|news|resources|insights|how-to|checklist)/;
const SERVICE = /(service|pricing|solutions|bookkeeping|payroll|accounting|cfo|consulting|setup)/;
const INDUSTRY = /(clinic|healthcare|ecommerce|hospitality|retail|industry|for-)/;

interface Classification {
  purpose: PagePurpose;
  confidence: number;
  signals: string[];
}

function classifyPath(path: string, obs: TechnicalPageObservation): Classification {
  const p = path.toLowerCase();
  const signals: string[] = [];

  if (p === "/" || p === "") {
    return { purpose: "homepage", confidence: 96, signals: ["Root path"] };
  }
  if (LEGAL.test(p)) {
    return { purpose: "legal", confidence: 90, signals: ["Legal keyword in path"] };
  }
  if (FAQ.test(p)) {
    return { purpose: "faq", confidence: 82, signals: ["FAQ keyword in path"] };
  }
  if (COMPARISON.test(p)) {
    return { purpose: "comparison", confidence: 80, signals: ["Comparison keyword in path"] };
  }
  if (LOCATION.test(p)) {
    signals.push("Location keyword in path");
    return { purpose: "location", confidence: 72, signals };
  }
  if (INDUSTRY.test(p)) {
    signals.push("Industry/vertical keyword in path");
    return { purpose: "industry", confidence: 66, signals };
  }
  if (ARTICLE.test(p) || obs.wordCount > 900) {
    signals.push(ARTICLE.test(p) ? "Article keyword in path" : "Long-form word count");
    return { purpose: "article", confidence: ARTICLE.test(p) ? 78 : 55, signals };
  }
  if (SERVICE.test(p)) {
    signals.push("Service keyword in path");
    return { purpose: "service", confidence: 70, signals };
  }
  return { purpose: "unknown", confidence: 30, signals: ["No strong path signal"] };
}

const EMPTY_COUNTS: Record<PagePurpose, number> = {
  homepage: 0,
  service: 0,
  industry: 0,
  location: 0,
  article: 0,
  comparison: 0,
  faq: 0,
  legal: 0,
  unknown: 0,
};

export function buildSiteInventory(input: {
  pages: TechnicalPageObservation[];
  business?: BusinessProfileSnapshot;
  overrides?: Record<string, PagePurpose>;
}): SiteInventory {
  const overrides = input.overrides ?? {};

  const pages: ClassifiedPage[] = input.pages.map((obs) => {
    const override = overrides[obs.url];
    if (override) {
      return { url: obs.url, purpose: override, confidence: 100, signals: ["Manual override"], overridden: true };
    }
    const c = classifyPath(obs.url, obs);
    return { url: obs.url, purpose: c.purpose, confidence: clamp(c.confidence), signals: c.signals, overridden: false };
  });

  const countsByPurpose = { ...EMPTY_COUNTS };
  for (const page of pages) countsByPurpose[page.purpose]++;

  const coverageGaps: CoverageGap[] = [];
  if (input.business) {
    const inventoryText = pages.map((p) => p.url.toLowerCase()).join(" ");
    for (const service of input.business.services) {
      const token = service.toLowerCase().split(/\s+/)[0];
      if (token && !inventoryText.includes(token.slice(0, 5))) {
        coverageGaps.push({ service, reason: `No page appears to target the "${service}" service.` });
      }
    }
  }

  return { pages, countsByPurpose, coverageGaps };
}

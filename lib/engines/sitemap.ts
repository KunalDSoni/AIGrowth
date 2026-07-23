/**
 * Minimal, dependency-free sitemap parsing.
 *
 * Handles both a <urlset> (list of pages) and a <sitemapindex> (list of child
 * sitemaps). Returns raw <loc> values; callers are responsible for same-origin
 * filtering, de-duplication and applying crawl limits.
 */
export interface ParsedSitemap {
  pages: string[];
  sitemaps: string[];
}

function locs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((match) => match[1].trim()).filter(Boolean);
}

export function parseSitemap(xml: string): ParsedSitemap {
  const all = locs(xml);
  if (/<sitemapindex[\s>]/i.test(xml)) {
    return { pages: [], sitemaps: all };
  }
  return { pages: all, sitemaps: [] };
}

/** Keep only same-origin http(s) URLs, de-duplicated, order preserved. */
export function sameOriginUnique(urls: string[], origin: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    let normalized: string;
    try {
      const u = new URL(raw);
      if (u.origin !== origin) continue;
      normalized = u.toString();
    } catch {
      continue;
    }
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

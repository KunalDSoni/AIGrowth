/**
 * Minimal robots.txt parser + politeness gate for frontier crawling (OSI-002).
 *
 * We enforce robots.txt and crawl-delay on every multi-page crawl. This is an
 * ethics/legal line and it keeps our crawler from being IP-blocked mid-audit.
 * Deliberately small: user-agent groups, Allow/Disallow longest-match, Crawl-delay.
 */

export interface RobotsRules {
  /** Ordered [path, allow] rules for the matched agent group (specific first, then `*`). */
  rules: Array<{ path: string; allow: boolean }>;
  crawlDelayMs: number;
  sitemaps: string[];
}

const DEFAULT_CRAWL_DELAY_MS = 1000;

/** Parse robots.txt text for a given user-agent token (case-insensitive). */
export function parseRobots(text: string, userAgent: string): RobotsRules {
  const ua = userAgent.toLowerCase();
  const lines = text.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim()).filter(Boolean);

  const groups: Array<{ agents: string[]; rules: Array<{ path: string; allow: boolean }>; crawlDelay?: number }> = [];
  let current: (typeof groups)[number] | null = null;
  let expectingAgent = false;
  const sitemaps: string[] = [];

  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      if (!expectingAgent || !current) {
        current = { agents: [], rules: [] };
        groups.push(current);
        expectingAgent = true;
      }
      current.agents.push(value.toLowerCase());
      continue;
    }
    expectingAgent = false;
    if (field === "sitemap") {
      sitemaps.push(value);
      continue;
    }
    if (!current) continue;
    if (field === "disallow") current.rules.push({ path: value, allow: false });
    else if (field === "allow") current.rules.push({ path: value, allow: true });
    else if (field === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n)) current.crawlDelay = n * 1000;
    }
  }

  const pick =
    groups.find((g) => g.agents.some((a) => a !== "*" && ua.includes(a))) ??
    groups.find((g) => g.agents.includes("*"));

  return {
    rules: pick?.rules ?? [],
    crawlDelayMs: pick?.crawlDelay ?? DEFAULT_CRAWL_DELAY_MS,
    sitemaps,
  };
}

/** Longest-match Allow/Disallow decision. Empty Disallow path allows everything. */
export function isAllowed(rules: RobotsRules, pathname: string): boolean {
  let decision = true;
  let matchLen = -1;
  for (const rule of rules.rules) {
    if (rule.path === "") continue; // "Disallow:" with empty value = allow all
    if (pathname.startsWith(rule.path) && rule.path.length > matchLen) {
      matchLen = rule.path.length;
      decision = rule.allow;
    }
  }
  return decision;
}

/** Fetch + parse robots.txt for an origin. Returns permissive defaults if absent/unfetchable. */
export async function loadRobots(
  origin: string,
  userAgent: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 5000,
): Promise<RobotsRules> {
  try {
    const res = await fetchImpl(new URL("/robots.txt", origin), {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": userAgent },
    });
    if (!res.ok) return { rules: [], crawlDelayMs: DEFAULT_CRAWL_DELAY_MS, sitemaps: [] };
    return parseRobots(await res.text(), userAgent);
  } catch {
    return { rules: [], crawlDelayMs: DEFAULT_CRAWL_DELAY_MS, sitemaps: [] };
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

/**
 * AI Bot Accessibility Audit (EPIC TSEO-002).
 *
 * Inspects robots.txt, sitemap presence and page-level robots directives to flag
 * setups that MAY block discovery by search or AI crawlers. Deliberately makes no
 * guarantee about AI citation benefit — every finding carries a caveat, because
 * crawler access is necessary but never sufficient for visibility.
 */

export type AccessSeverity = "critical" | "warning" | "notice";

export interface AccessFinding {
  id: string;
  severity: AccessSeverity;
  title: string;
  detail: string;
  /** Honest limitation attached to every finding. */
  caveat: string;
  affectedAgents: string[];
}

export interface RobotsGroup {
  userAgents: string[];
  disallow: string[];
  allow: string[];
}

export interface ParsedRobots {
  groups: RobotsGroup[];
  sitemaps: string[];
}

/** Well-known AI/search crawler user agents we can name. */
export const KNOWN_AI_AGENTS = ["GPTBot", "OAI-SearchBot", "ClaudeBot", "Google-Extended", "PerplexityBot", "Googlebot", "Bingbot"];

export function parseRobotsTxt(text: string): ParsedRobots {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  let lastLineWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      if (!current || !lastLineWasAgent) {
        current = { userAgents: [], disallow: [], allow: [] };
        groups.push(current);
      }
      current.userAgents.push(value);
      lastLineWasAgent = true;
      continue;
    }
    lastLineWasAgent = false;
    if (field === "sitemap") {
      sitemaps.push(value);
      continue;
    }
    if (!current) {
      current = { userAgents: ["*"], disallow: [], allow: [] };
      groups.push(current);
    }
    if (field === "disallow") current.disallow.push(value);
    if (field === "allow") current.allow.push(value);
  }

  return { groups, sitemaps };
}

function agentBlocksRoot(robots: ParsedRobots, agent: string): boolean {
  const groups = robots.groups.filter(
    (g) => g.userAgents.some((ua) => ua === "*" || ua.toLowerCase() === agent.toLowerCase()),
  );
  return groups.some((g) => g.disallow.includes("/") && !g.allow.includes("/"));
}

export function auditAiAccess(input: {
  robotsTxt: string | null;
  sitemapFound: boolean;
  pageRobotsDirectives?: Record<string, string>;
  aiAgents?: string[];
}): AccessFinding[] {
  const findings: AccessFinding[] = [];
  const agents = input.aiAgents ?? KNOWN_AI_AGENTS;

  if (input.robotsTxt === null) {
    findings.push({
      id: "robots-missing",
      severity: "notice",
      title: "No robots.txt found",
      detail: "No robots.txt was retrieved. Crawlers will assume the whole site is allowed, which is usually fine.",
      caveat: "Absence of robots.txt does not itself improve or harm AI visibility.",
      affectedAgents: agents,
    });
  } else {
    const robots = parseRobotsTxt(input.robotsTxt);
    const blocked = agents.filter((agent) => agentBlocksRoot(robots, agent));
    if (blocked.length > 0) {
      findings.push({
        id: "robots-blocks-crawlers",
        severity: "critical",
        title: "robots.txt disallows the whole site for one or more crawlers",
        detail: `A "Disallow: /" rule applies to: ${blocked.join(", ")}.`,
        caveat: "This can prevent discovery, but allowing crawl does not guarantee indexing or AI citation.",
        affectedAgents: blocked,
      });
    }
    if (robots.sitemaps.length === 0 && !input.sitemapFound) {
      findings.push({
        id: "sitemap-not-referenced",
        severity: "warning",
        title: "No sitemap referenced in robots.txt and none discovered",
        detail: "Declaring a sitemap helps crawlers find pages efficiently.",
        caveat: "A sitemap aids discovery but does not force indexing.",
        affectedAgents: agents,
      });
    }
  }

  if (input.sitemapFound === false && input.robotsTxt !== null) {
    // handled above only when also not referenced; standalone notice when robots exists but no sitemap file
  }

  for (const [url, directive] of Object.entries(input.pageRobotsDirectives ?? {})) {
    const value = directive.toLowerCase();
    const noindex = value.includes("noindex");
    const nofollow = value.includes("nofollow");
    if (noindex) {
      findings.push({
        id: `noindex-${url}`,
        severity: "warning",
        title: `Page requests noindex: ${url}`,
        detail: `The page meta robots directive is "${directive}", asking engines not to index it.`,
        caveat: "This may be intentional for thin or duplicate pages; confirm before changing.",
        affectedAgents: agents,
      });
    }
    if (noindex && nofollow) {
      findings.push({
        id: `noindex-nofollow-${url}`,
        severity: "notice",
        title: `noindex + nofollow combined: ${url}`,
        detail: "Combining noindex with nofollow can strand link equity to linked pages.",
        caveat: "Effect depends on site structure; verify the page should be fully hidden.",
        affectedAgents: agents,
      });
    }
  }

  return findings;
}

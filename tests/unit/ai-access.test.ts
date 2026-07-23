import { describe, expect, it } from "vitest";
import { auditAiAccess, parseRobotsTxt } from "@/lib/engines/ai-access";

describe("parseRobotsTxt", () => {
  it("parses groups, disallow rules and sitemaps", () => {
    const robots = parseRobotsTxt(
      ["User-agent: *", "Disallow: /admin", "", "User-agent: GPTBot", "Disallow: /", "Sitemap: https://x.com/sitemap.xml"].join("\n"),
    );
    expect(robots.groups.length).toBe(2);
    expect(robots.sitemaps).toContain("https://x.com/sitemap.xml");
    const gpt = robots.groups.find((g) => g.userAgents.includes("GPTBot"));
    expect(gpt?.disallow).toContain("/");
  });

  it("ignores comments", () => {
    const robots = parseRobotsTxt("# comment\nUser-agent: *\nDisallow: /x # trailing");
    expect(robots.groups[0].disallow).toContain("/x");
  });
});

describe("auditAiAccess", () => {
  it("flags a critical when a crawler is disallowed at root", () => {
    const findings = auditAiAccess({
      robotsTxt: "User-agent: GPTBot\nDisallow: /",
      sitemapFound: true,
    });
    const crit = findings.find((f) => f.id === "robots-blocks-crawlers");
    expect(crit?.severity).toBe("critical");
    expect(crit?.affectedAgents).toContain("GPTBot");
    expect(crit?.caveat).toMatch(/guarantee/i);
  });

  it("notes a missing robots.txt without claiming benefit", () => {
    const findings = auditAiAccess({ robotsTxt: null, sitemapFound: true });
    const note = findings.find((f) => f.id === "robots-missing");
    expect(note?.severity).toBe("notice");
    expect(note?.caveat).toMatch(/does not/i);
  });

  it("warns when no sitemap is referenced or found", () => {
    const findings = auditAiAccess({ robotsTxt: "User-agent: *\nDisallow: /admin", sitemapFound: false });
    expect(findings.some((f) => f.id === "sitemap-not-referenced")).toBe(true);
  });

  it("flags page-level noindex with a caveat", () => {
    const findings = auditAiAccess({
      robotsTxt: "User-agent: *\nSitemap: https://x/sitemap.xml",
      sitemapFound: true,
      pageRobotsDirectives: { "/thin": "noindex, nofollow" },
    });
    expect(findings.some((f) => f.id === "noindex-/thin")).toBe(true);
    expect(findings.some((f) => f.id === "noindex-nofollow-/thin")).toBe(true);
  });

  it("does not flag a healthy config", () => {
    const findings = auditAiAccess({
      robotsTxt: "User-agent: *\nAllow: /\nSitemap: https://x/sitemap.xml",
      sitemapFound: true,
    });
    expect(findings.length).toBe(0);
  });
});

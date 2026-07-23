import { describe, it, expect } from "vitest";
import { parseRobots, isAllowed } from "@/lib/providers/robots";

describe("robots parsing (OSI-002)", () => {
  const text = `
User-agent: *
Disallow: /private
Allow: /private/public
Crawl-delay: 2
Sitemap: https://x.com/sitemap.xml

User-agent: GPTBot
Disallow: /
`;

  it("picks the matching agent group and crawl-delay", () => {
    const star = parseRobots(text, "OpenGrowthAI-Crawler/0.1");
    expect(star.crawlDelayMs).toBe(2000);
    expect(star.sitemaps).toContain("https://x.com/sitemap.xml");
    expect(isAllowed(star, "/about")).toBe(true);
    expect(isAllowed(star, "/private/thing")).toBe(false);
    expect(isAllowed(star, "/private/public/page")).toBe(true); // longest match wins
  });

  it("applies bot-specific rules", () => {
    const bot = parseRobots(text, "GPTBot/1.0");
    expect(isAllowed(bot, "/anything")).toBe(false);
  });

  it("defaults to permissive when no rules match", () => {
    const rules = parseRobots("", "anyone");
    expect(isAllowed(rules, "/whatever")).toBe(true);
    expect(rules.crawlDelayMs).toBe(1000);
  });
});

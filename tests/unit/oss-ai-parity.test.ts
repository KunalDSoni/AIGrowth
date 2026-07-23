import { describe, it, expect } from "vitest";
import { checkAiCrawlerParity } from "@/lib/ingestion/ai-crawler-parity";

const publicDns = async () => [{ address: "93.184.216.34" }];

describe("AI-crawler parity (OSI-005)", () => {
  it("detects content hidden from the bot UA", async () => {
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      if (url.endsWith("/robots.txt")) return new Response("", { status: 404 });
      const ua = String((init?.headers as Record<string, string>)?.["user-agent"] ?? "");
      const isBot = /GPTBot/i.test(ua);
      const html = isBot
        ? `<html><body><p>tiny</p></body></html>`
        : `<html><body><a href="/deep">d</a><p>${"word ".repeat(60)}</p></body></html>`;
      return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
    }) as typeof fetch;

    const result = await checkAiCrawlerParity("https://demo.test/page", "gptbot", { fetchImpl, dnsLookup: publicDns });
    expect(result.robotsAllowsBot).toBe(true);
    expect(result.humanWordCount).toBeGreaterThan(result.botWordCount);
    expect(result.wordCountDelta).toBeGreaterThan(0);
    expect(result.linksHiddenFromBot).toBeGreaterThan(0);
    expect(result.blocked).toBe(true);
  });

  it("marks robots-blocked bots as blocked without a bot fetch", async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.endsWith("/robots.txt")) return new Response("User-agent: GPTBot\nDisallow: /", { status: 200 });
      return new Response(`<html><body><p>${"w ".repeat(60)}</p></body></html>`, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }) as typeof fetch;

    const result = await checkAiCrawlerParity("https://demo.test/page", "gptbot", { fetchImpl, dnsLookup: publicDns });
    expect(result.robotsAllowsBot).toBe(false);
    expect(result.blocked).toBe(true);
  });
});

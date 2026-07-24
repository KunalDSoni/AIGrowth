import { describe, expect, it } from "vitest";
import {
  buildShoppingAgentLens,
  SHOPPING_LENS_VERSION,
  type ProductFeedItem,
} from "@/lib/engines/legibility-shopping-agent-lens";

const fullProduct = (): ProductFeedItem => ({
  id: "p1",
  name: "Acme Invoicing Pro",
  description: "Automated invoicing for freelancers",
  price: 20,
  currency: "USD",
  availability: "in_stock",
  sku: "ACM-INV-PRO",
  gtin: "01234567890123",
  brand: "Acme",
  category: "Software",
  imageUrl: "https://acme.com/p1.png",
  url: "https://acme.com/products/invoicing-pro",
  shipping: "digital",
  returnPolicy: "30-day",
});

describe("legibility shopping-agent lens", () => {
  it("exposes a version", () => {
    expect(SHOPPING_LENS_VERSION).toBeGreaterThanOrEqual(1);
  });

  it("grades a complete product with an endpoint as buyable with a high score", () => {
    const r = buildShoppingAgentLens(fullProduct(), { hasStructuredEndpoint: true });
    expect(r.score).toBe(100);
    expect(r.grade).toBe("buyable");
    expect(r.missingRequired).toEqual([]);
    expect(r.mcpReady).toBe(true);
    expect(r.recommendations).toEqual([]);
  });

  it("detects missing required fields", () => {
    const item = fullProduct();
    delete item.price;
    delete item.availability;
    const r = buildShoppingAgentLens(item, { hasStructuredEndpoint: true });
    expect(r.missingRequired.sort()).toEqual(["availability", "price"]);
  });

  it("grades a bare product as invisible", () => {
    const r = buildShoppingAgentLens({ name: "Acme Invoicing" });
    expect(r.grade).toBe("invisible");
    expect(r.score).toBeLessThan(50);
  });

  it("penalizes a missing structured endpoint and recommends adding one", () => {
    const withEndpoint = buildShoppingAgentLens(fullProduct(), { hasStructuredEndpoint: true });
    const without = buildShoppingAgentLens(fullProduct(), { hasStructuredEndpoint: false });
    expect(without.score).toBeLessThan(withEndpoint.score);
    expect(without.mcpReady).toBe(false);
    expect(without.recommendations.some((r) => /MCP-style/i.test(r))).toBe(true);
  });

  it("orders recommendations by required-first then weight", () => {
    const item: ProductFeedItem = { name: "Acme", url: "https://acme.com/p" };
    // missing required: price, currency, availability; plus many recommended.
    const r = buildShoppingAgentLens(item, { hasStructuredEndpoint: true });
    // First recommendation should target a required field (price is the heaviest).
    expect(r.recommendations[0]).toMatch(/price/i);
  });

  it("treats an empty-string field as absent", () => {
    const item = fullProduct();
    item.currency = "";
    const r = buildShoppingAgentLens(item, { hasStructuredEndpoint: true });
    expect(r.missingRequired).toContain("currency");
  });

  it("counts price of 0 as present", () => {
    const item = fullProduct();
    item.price = 0;
    const r = buildShoppingAgentLens(item, { hasStructuredEndpoint: true });
    expect(r.missingRequired).not.toContain("price");
  });

  it("reports readability for every spec field", () => {
    const r = buildShoppingAgentLens(fullProduct(), { hasStructuredEndpoint: true });
    expect(r.fields.length).toBeGreaterThanOrEqual(13);
    expect(r.fields.every((f) => typeof f.present === "boolean")).toBe(true);
  });
});

/**
 * MLE-5 — Shopping-Agent lens (Machine Legibility Engine, Frontier 4).
 *
 * The machine is the new customer: ChatGPT checkout, agentic browsers, and
 * comparison agents increasingly decide what humans buy, and a product that is
 * not machine-legible is simply skipped. This lens audits whether a product is
 * *buyable by an agent* — the structured spec/price/availability fields a buying
 * agent needs, plus MCP-style product-endpoint readiness — and scores its
 * agent-readability with concrete missing-field detection.
 *
 * v1 audits readiness only; it hosts no live endpoint (deferred per spec). It is
 * a pure audit over a product feed item.
 */

export interface ProductFeedItem {
  id?: string;
  name?: string;
  description?: string;
  price?: string | number;
  currency?: string;
  /** e.g. "in_stock" / "out_of_stock". */
  availability?: string;
  sku?: string;
  /** Global Trade Item Number — lets agents match the product across catalogs. */
  gtin?: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  url?: string;
  shipping?: string;
  returnPolicy?: string;
}

export interface AgentReadabilityField {
  field: string;
  present: boolean;
  required: boolean;
  weight: number;
  note: string;
}

export type ReadabilityGrade = "buyable" | "partial" | "invisible";

export interface ShoppingAgentReport {
  productId?: string;
  /** 0–100 agent-readability. */
  score: number;
  grade: ReadabilityGrade;
  fields: AgentReadabilityField[];
  missingRequired: string[];
  /** Whether the product is exposed via a structured (MCP-style) endpoint. */
  mcpReady: boolean;
  recommendations: string[];
}

interface FieldSpec {
  field: string;
  required: boolean;
  weight: number;
  note: string;
  /** How to read the value off the item. */
  get: (item: ProductFeedItem) => unknown;
}

/**
 * The fields an agent needs to understand, compare, and transact a product.
 * Weights are directional priors for how much each matters to buyability.
 */
export const PRODUCT_FIELD_SPECS: FieldSpec[] = [
  { field: "name", required: true, weight: 12, note: "Name the product so an agent can identify it.", get: (i) => i.name },
  { field: "price", required: true, weight: 14, note: "State a machine-readable price so agents can compare.", get: (i) => i.price },
  { field: "currency", required: true, weight: 8, note: "Declare the currency so a price is unambiguous.", get: (i) => i.currency },
  { field: "availability", required: true, weight: 12, note: "Expose availability so agents don't offer out-of-stock items.", get: (i) => i.availability },
  { field: "url", required: true, weight: 9, note: "Provide a canonical product URL for the agent to transact against.", get: (i) => i.url },
  { field: "gtin", required: false, weight: 8, note: "Add a GTIN so agents can match the product across catalogs.", get: (i) => i.gtin },
  { field: "description", required: false, weight: 6, note: "Describe the product so agents can match it to intent.", get: (i) => i.description },
  { field: "sku", required: false, weight: 6, note: "Add a SKU for precise catalog reference.", get: (i) => i.sku },
  { field: "brand", required: false, weight: 6, note: "State the brand for disambiguation.", get: (i) => i.brand },
  { field: "category", required: false, weight: 5, note: "Categorize the product for agent browse/filter.", get: (i) => i.category },
  { field: "shipping", required: false, weight: 5, note: "Expose shipping so agents can total cost.", get: (i) => i.shipping },
  { field: "returnPolicy", required: false, weight: 5, note: "State the return policy agents weigh before buying.", get: (i) => i.returnPolicy },
  { field: "imageUrl", required: false, weight: 4, note: "Provide an image URL for agent product cards.", get: (i) => i.imageUrl },
];

/** The MCP-style structured-endpoint readiness contributes to buyability too. */
export const MCP_ENDPOINT_WEIGHT = 10;

export const SHOPPING_LENS_VERSION = 1;

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function grade(score: number): ReadabilityGrade {
  if (score >= 80) return "buyable";
  if (score >= 50) return "partial";
  return "invisible";
}

/** Audit a product feed item for agent buyability. */
export function buildShoppingAgentLens(
  item: ProductFeedItem,
  opts?: { hasStructuredEndpoint?: boolean },
): ShoppingAgentReport {
  const fields: AgentReadabilityField[] = PRODUCT_FIELD_SPECS.map((spec) => ({
    field: spec.field,
    present: isPresent(spec.get(item)),
    required: spec.required,
    weight: spec.weight,
    note: spec.note,
  }));

  const mcpReady = Boolean(opts?.hasStructuredEndpoint);

  const totalWeight = PRODUCT_FIELD_SPECS.reduce((s, f) => s + f.weight, 0) + MCP_ENDPOINT_WEIGHT;
  const presentWeight =
    fields.filter((f) => f.present).reduce((s, f) => s + f.weight, 0) +
    (mcpReady ? MCP_ENDPOINT_WEIGHT : 0);
  const score = Math.round((presentWeight / totalWeight) * 100);

  const missingRequired = fields.filter((f) => f.required && !f.present).map((f) => f.field);

  const recommendations = [
    ...fields
      .filter((f) => !f.present)
      .sort((a, b) => Number(b.required) - Number(a.required) || b.weight - a.weight)
      .map((f) => f.note),
    ...(mcpReady
      ? []
      : ["Expose a structured (MCP-style) product endpoint so buying agents can consume it directly."]),
  ];

  return {
    productId: item.id,
    score,
    grade: grade(score),
    fields,
    missingRequired,
    mcpReady,
    recommendations,
  };
}

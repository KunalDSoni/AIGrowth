import type { AIVisibilityPromptFamily } from "@/lib/domain/types";

/**
 * Prompt Variant Generator (EPIC AIV-001).
 *
 * Turns a buyer question into controlled variants across geography, persona,
 * specificity, buying stage and wording so AI-visibility observations are
 * aggregated under a prompt *family* rather than random one-off prompts. Output
 * is deterministic and de-duplicated so runs are reproducible.
 */

export type VariantDimension = "geography" | "persona" | "specificity" | "buying-stage" | "wording";

export interface PromptVariant {
  id: string;
  familyId: string;
  text: string;
  dimension: VariantDimension;
  label: string;
}

export interface VariantAxes {
  geographies?: string[];
  personas?: string[];
  buyingStages?: ("awareness" | "consideration" | "decision")[];
}

const WORDINGS: { label: string; render: (base: string) => string }[] = [
  { label: "direct", render: (b) => b },
  { label: "recommendation", render: (b) => `Can you recommend options for: ${b.toLowerCase()}` },
  { label: "best-of", render: (b) => `What are the best choices for ${stripQuestion(b).toLowerCase()}?` },
];

const SPECIFICITY: { label: string; render: (base: string, qualifier: string) => string }[] = [
  { label: "broad", render: (b) => b },
  { label: "qualified", render: (b, q) => `${stripQuestion(b)} for ${q}?` },
];

const STAGE_PREFIX: Record<string, string> = {
  awareness: "I'm just starting to look into",
  consideration: "I'm comparing options for",
  decision: "I'm ready to choose a provider for",
};

function stripQuestion(text: string): string {
  return text.replace(/\?+\s*$/, "").trim();
}

const slug = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

/**
 * Generate controlled variants of a base question. Every returned variant is
 * tagged with the dimension it varies so observations can be sliced later.
 */
export function generatePromptVariants(input: {
  familyId: string;
  baseQuestion: string;
  axes?: VariantAxes;
}): PromptVariant[] {
  const { familyId, baseQuestion } = input;
  const axes = input.axes ?? {};
  const seen = new Set<string>();
  const variants: PromptVariant[] = [];

  const push = (text: string, dimension: VariantDimension, label: string) => {
    const clean = text.replace(/\s+/g, " ").trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) return;
    seen.add(key);
    variants.push({ id: `${familyId}-${dimension}-${slug(label)}-${variants.length + 1}`, familyId, text: clean, dimension, label });
  };

  // Always include the base as the direct wording seed.
  push(baseQuestion, "wording", "direct");

  for (const wording of WORDINGS) {
    push(wording.render(baseQuestion), "wording", wording.label);
  }
  for (const geography of axes.geographies ?? []) {
    push(`${stripQuestion(baseQuestion)} in ${geography}?`, "geography", geography);
  }
  for (const persona of axes.personas ?? []) {
    push(`As a ${persona}, ${lowerFirst(baseQuestion)}`, "persona", persona);
    for (const spec of SPECIFICITY) {
      if (spec.label === "qualified") push(spec.render(baseQuestion, persona), "specificity", persona);
    }
  }
  for (const stage of axes.buyingStages ?? []) {
    push(`${STAGE_PREFIX[stage]} ${lowerFirst(stripQuestion(baseQuestion))}.`, "buying-stage", stage);
  }

  return variants;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/**
 * Build a full prompt family (question + generated variant texts) ready to feed
 * the observation runner.
 */
export function buildPromptFamily(input: {
  id: string;
  topic: string;
  baseQuestion: string;
  persona: string;
  geography: string;
  buyingStage: AIVisibilityPromptFamily["buyingStage"];
  axes?: VariantAxes;
}): AIVisibilityPromptFamily {
  const variants = generatePromptVariants({ familyId: input.id, baseQuestion: input.baseQuestion, axes: input.axes });
  return {
    id: input.id,
    topic: input.topic,
    buyingStage: input.buyingStage,
    persona: input.persona,
    geography: input.geography,
    prompts: variants.map((v) => v.text),
  };
}

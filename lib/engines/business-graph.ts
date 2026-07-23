import type { BusinessProfileSnapshot, WebsitePageProfile } from "@/lib/domain/types";

/**
 * Business Understanding Engine (EPIC BIZ-001 / BIZ-002).
 *
 * Represents the business as typed entities and relationships instead of loose
 * profile strings, and tracks whether each fact was observed, inferred by AI,
 * user-supplied, confirmed, or rejected. Confirmed facts outrank unconfirmed
 * ones in every downstream scoring pass so AI guesses never silently become
 * truth.
 */

export type BusinessEntityType =
  | "service"
  | "audience"
  | "geography"
  | "goal"
  | "competitor"
  | "differentiator";

export type InferenceStatus =
  | "user-supplied"
  | "observed"
  | "ai-inferred"
  | "confirmed"
  | "rejected";

export interface BusinessEntity {
  id: string;
  type: BusinessEntityType;
  label: string;
  status: InferenceStatus;
  /** 0-100 model/heuristic confidence in the entity before human review. */
  confidence: number;
  evidenceIds: string[];
  /** Free-text note captured when a user edits or rejects an inference. */
  reviewNote?: string;
}

export interface BusinessRelationship {
  id: string;
  fromId: string;
  toId: string;
  kind: "serves" | "operates-in" | "competes-with" | "differentiates-on" | "targets-goal";
}

export interface BusinessGraph {
  businessId: string;
  entities: BusinessEntity[];
  relationships: BusinessRelationship[];
}

const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

const slug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function entity(
  type: BusinessEntityType,
  label: string,
  status: InferenceStatus,
  confidence: number,
  evidenceIds: string[],
): BusinessEntity {
  return { id: `${type}-${slug(label)}`, type, label, status, confidence: clamp(confidence), evidenceIds };
}

/**
 * Build the initial graph from an onboarding profile plus the observed page
 * inventory. Profile fields are user-supplied; anything only implied by pages
 * (e.g. a geography mentioned in copy but not declared) is marked ai-inferred so
 * it must be confirmed before it can win a scoring tie.
 */
export function buildBusinessGraph(input: {
  business: BusinessProfileSnapshot;
  pages: WebsitePageProfile[];
  competitors?: string[];
  profileEvidenceId?: string;
}): BusinessGraph {
  const { business, pages } = input;
  const profileEvidence = input.profileEvidenceId ? [input.profileEvidenceId] : [];
  const entities: BusinessEntity[] = [];
  const relationships: BusinessRelationship[] = [];

  const businessNode = entity("goal", business.goal, "user-supplied", 90, profileEvidence);
  entities.push(businessNode);

  for (const service of business.services) {
    entities.push(entity("service", service, "user-supplied", 88, profileEvidence));
  }
  for (const segment of business.audienceSegments) {
    entities.push(entity("audience", segment, "user-supplied", 85, profileEvidence));
  }
  for (const diff of business.differentiators) {
    entities.push(entity("differentiator", diff, "user-supplied", 80, profileEvidence));
  }
  entities.push(entity("geography", business.market, "user-supplied", 85, profileEvidence));

  for (const competitor of input.competitors ?? []) {
    entities.push(entity("competitor", competitor, "ai-inferred", 55, []));
  }

  // Services referenced by observed pages but absent from the declared catalogue
  // are inferred, not asserted.
  const declaredServices = new Set(business.services.map(slug));
  for (const page of pages) {
    for (const service of page.services) {
      if (!declaredServices.has(slug(service))) {
        entities.push(entity("service", service, "ai-inferred", 45, []));
        declaredServices.add(slug(service));
      }
    }
  }

  // Relationships: every service serves every declared audience and targets the goal.
  const services = entities.filter((e) => e.type === "service");
  const audiences = entities.filter((e) => e.type === "audience");
  const geographies = entities.filter((e) => e.type === "geography");
  const differentiators = entities.filter((e) => e.type === "differentiator");
  const competitors = entities.filter((e) => e.type === "competitor");

  for (const service of services) {
    relationships.push({ id: `rel-${service.id}-goal`, fromId: service.id, toId: businessNode.id, kind: "targets-goal" });
    for (const audience of audiences) {
      relationships.push({ id: `rel-${service.id}-${audience.id}`, fromId: service.id, toId: audience.id, kind: "serves" });
    }
    for (const geography of geographies) {
      relationships.push({ id: `rel-${service.id}-${geography.id}`, fromId: service.id, toId: geography.id, kind: "operates-in" });
    }
  }
  for (const diff of differentiators) {
    relationships.push({ id: `rel-${businessNode.id}-${diff.id}`, fromId: businessNode.id, toId: diff.id, kind: "differentiates-on" });
  }
  for (const competitor of competitors) {
    relationships.push({ id: `rel-${businessNode.id}-${competitor.id}`, fromId: businessNode.id, toId: competitor.id, kind: "competes-with" });
  }

  return { businessId: business.id, entities, relationships };
}

export type ConfirmationAction = "confirm" | "reject" | "edit";

export interface ConfirmationEvent {
  entityId: string;
  action: ConfirmationAction;
  label?: string;
  note?: string;
  at: string;
}

/**
 * Apply a human review decision. Returns a new graph plus an audit event so the
 * change is traceable — inferences never mutate in place without a record.
 */
export function applyConfirmation(
  graph: BusinessGraph,
  event: ConfirmationEvent,
): { graph: BusinessGraph; audit: string } {
  let matched = false;
  const entities = graph.entities.map((entity) => {
    if (entity.id !== event.entityId) return entity;
    matched = true;
    if (event.action === "confirm") {
      return { ...entity, status: "confirmed" as const, confidence: 100, reviewNote: event.note };
    }
    if (event.action === "reject") {
      return { ...entity, status: "rejected" as const, confidence: 0, reviewNote: event.note };
    }
    return {
      ...entity,
      status: "confirmed" as const,
      confidence: 100,
      label: event.label?.trim() || entity.label,
      reviewNote: event.note,
    };
  });

  const audit = matched
    ? `${event.at} ${event.action} ${event.entityId}${event.label ? ` -> "${event.label}"` : ""}`
    : `${event.at} no-op: entity ${event.entityId} not found`;

  return { graph: { ...graph, entities }, audit };
}

/**
 * Confidence weight a downstream scorer should multiply a factor by. Confirmed
 * facts weigh full; user-supplied nearly full; inferred is discounted; rejected
 * facts contribute nothing.
 */
export function factWeight(status: InferenceStatus): number {
  switch (status) {
    case "confirmed":
      return 1;
    case "user-supplied":
      return 0.9;
    case "observed":
      return 0.85;
    case "ai-inferred":
      return 0.5;
    case "rejected":
      return 0;
  }
}

/** Active (non-rejected) entities of a type, ranked so confirmed facts lead. */
export function rankedEntities(graph: BusinessGraph, type: BusinessEntityType): BusinessEntity[] {
  return graph.entities
    .filter((e) => e.type === type && e.status !== "rejected")
    .sort((a, b) => factWeight(b.status) * b.confidence - factWeight(a.status) * a.confidence);
}

/** Entities still awaiting a human decision — the review queue for BIZ-002. */
export function pendingReview(graph: BusinessGraph): BusinessEntity[] {
  return graph.entities.filter((e) => e.status === "ai-inferred");
}

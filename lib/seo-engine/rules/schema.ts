import { isUtilityPage, pageRule, siteRule } from './define';
import type { JsonLdBlock, PageFacts, Rule } from '../core/types';

/**
 * Required and recommended properties per schema.org type, limited to the types this
 * portfolio actually uses. A full schema.org vocabulary would be thousands of types
 * and mostly noise; these are the ones Google documents rich-result support for.
 */
const TYPE_SHAPES: Record<string, { required: string[]; recommended: string[] }> = {
  Organization: { required: ['name'], recommended: ['url', 'logo', 'sameAs'] },
  Corporation: { required: ['name'], recommended: ['url', 'logo'] },
  LocalBusiness: {
    required: ['name', 'address'],
    recommended: ['telephone', 'openingHours', 'geo', 'url'],
  },
  FinancialService: {
    required: ['name'],
    recommended: ['address', 'telephone', 'areaServed', 'url'],
  },
  WebSite: { required: ['name', 'url'], recommended: ['potentialAction'] },
  WebPage: { required: [], recommended: ['name', 'description'] },
  Article: {
    required: ['headline'],
    recommended: ['author', 'datePublished', 'image', 'publisher'],
  },
  BlogPosting: {
    required: ['headline'],
    recommended: ['author', 'datePublished', 'image', 'publisher'],
  },
  NewsArticle: {
    required: ['headline'],
    recommended: ['author', 'datePublished', 'image', 'publisher'],
  },
  FAQPage: { required: ['mainEntity'], recommended: [] },
  Question: { required: ['name', 'acceptedAnswer'], recommended: [] },
  BreadcrumbList: { required: ['itemListElement'], recommended: [] },
  Product: { required: ['name'], recommended: ['image', 'description', 'offers'] },
  Person: { required: ['name'], recommended: ['url', 'jobTitle'] },
  Service: { required: ['name'], recommended: ['provider', 'areaServed'] },
};

interface SchemaNode {
  type: string;
  data: Record<string, unknown>;
}

/** Flatten every typed node in a JSON-LD block, including @graph and nested objects. */
function collectNodes(value: unknown, out: SchemaNode[], depth = 0): void {
  if (depth > 8 || !value) return;
  if (Array.isArray(value)) {
    for (const item of value) collectNodes(item, out, depth + 1);
    return;
  }
  if (typeof value !== 'object') return;

  const record = value as Record<string, unknown>;
  const rawType = record['@type'];
  const types = typeof rawType === 'string' ? [rawType] : Array.isArray(rawType) ? rawType : [];
  for (const type of types) {
    if (typeof type === 'string') out.push({ type, data: record });
  }

  for (const [key, child] of Object.entries(record)) {
    if (key === '@type' || key === '@context') continue;
    collectNodes(child, out, depth + 1);
  }
}

function nodesOf(page: PageFacts): SchemaNode[] {
  const nodes: SchemaNode[] = [];
  for (const block of page.jsonLd) {
    if (block.data) collectNodes(block.data, nodes);
  }
  return nodes;
}

function missingFrom(data: Record<string, unknown>, keys: string[]): string[] {
  return keys.filter((key) => {
    const value = data[key];
    if (value === undefined || value === null) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    return false;
  });
}

export const schemaRules: Rule[] = [
  pageRule({
    id: 'schema-invalid-json',
    title: 'Structured data is not valid JSON',
    severity: 'critical',
    description: 'A malformed JSON-LD block is ignored entirely by search engines.',
    check(page, _ctx, emit) {
      for (const block of page.jsonLd) {
        if (block.parseError) {
          emit({
            line: block.line,
            message: `JSON-LD block failed to parse: ${block.parseError}`,
            context: block.raw.slice(0, 100),
            remedy: 'Fix the JSON syntax; the whole block is currently ignored.',
          });
        }
      }
    },
  }),

  pageRule({
    id: 'schema-missing-context',
    title: 'JSON-LD block missing @context',
    severity: 'warning',
    description: 'Without @context the block is not interpreted as schema.org data.',
    check(page, _ctx, emit) {
      for (const block of page.jsonLd) {
        if (!block.data || typeof block.data !== 'object') continue;
        const record = block.data as Record<string, unknown>;
        if (Array.isArray(block.data)) continue;
        if (!record['@context']) {
          emit({
            line: block.line,
            message: 'JSON-LD block has no @context',
            remedy: 'Add "@context": "https://schema.org".',
          });
        }
      }
    },
  }),

  pageRule({
    id: 'schema-missing-type',
    title: 'JSON-LD block missing @type',
    severity: 'warning',
    description: 'A node with no @type conveys nothing to a search engine.',
    check(page, _ctx, emit) {
      for (const block of page.jsonLd) {
        if (!block.data || Array.isArray(block.data) || typeof block.data !== 'object') continue;
        const record = block.data as Record<string, unknown>;
        if (!record['@type'] && !record['@graph']) {
          emit({ line: block.line, message: 'Top-level JSON-LD node has no @type' });
        }
      }
    },
  }),

  pageRule({
    id: 'schema-missing-required',
    title: 'Structured data missing required properties',
    severity: 'warning',
    description: 'Missing required properties disqualify the page from rich results.',
    check(page, _ctx, emit) {
      for (const node of nodesOf(page)) {
        const shape = TYPE_SHAPES[node.type];
        if (!shape || shape.required.length === 0) continue;
        const missing = missingFrom(node.data, shape.required);
        if (missing.length > 0) {
          emit({
            message: `${node.type} is missing required ${missing.join(', ')}`,
            remedy: `Add ${missing.join(' and ')} to the ${node.type} node.`,
          });
        }
      }
    },
  }),

  pageRule({
    id: 'schema-missing-recommended',
    title: 'Structured data missing recommended properties',
    severity: 'notice',
    description: 'Recommended properties improve how rich results render.',
    check(page, _ctx, emit) {
      for (const node of nodesOf(page)) {
        const shape = TYPE_SHAPES[node.type];
        if (!shape || shape.recommended.length === 0) continue;
        const missing = missingFrom(node.data, shape.recommended);
        if (missing.length > 0) {
          emit({ message: `${node.type} is missing recommended ${missing.join(', ')}` });
        }
      }
    },
  }),

  pageRule({
    id: 'schema-absent',
    title: 'Page has no structured data',
    severity: 'notice',
    description: 'Structured data is how search engines and LLMs identify entities.',
    check(page, _ctx, emit) {
      if (isUtilityPage(page)) return;
      if (page.jsonLd.length === 0) {
        emit({
          message: 'Page has no JSON-LD structured data',
          remedy: 'Add at least an Organization or WebPage node.',
        });
      }
    },
  }),

  siteRule({
    id: 'schema-inconsistent',
    title: 'Structured data present on some pages but not comparable ones',
    severity: 'warning',
    description:
      'Uneven schema coverage is the "polish stopped at the homepage" pattern — the ' +
      'site clearly knows how to do it, but only did it once.',
    check(ctx, emit) {
      const withSchema = ctx.pages.filter((p) => p.jsonLd.length > 0 && !p.parseError);
      const withoutSchema = ctx.pages.filter(
        (p) => p.jsonLd.length === 0 && !p.parseError && !isUtilityPage(p),
      );

      // Only meaningful when the site demonstrably uses schema somewhere.
      if (withSchema.length === 0 || withoutSchema.length === 0) return;

      const types = new Set<string>();
      for (const page of withSchema) for (const node of nodesOf(page)) types.add(node.type);

      emit({
        relPath: withoutSchema[0]!.relPath,
        message: `${withSchema.length} pages use structured data (${[...types].slice(0, 4).join(', ')}) but ${withoutSchema.length} comparable pages have none`,
        context: withoutSchema
          .slice(0, 6)
          .map((p) => p.relPath)
          .join(', '),
        remedy: 'Extend the existing schema pattern to the remaining pages.',
      });
    },
  }),

  pageRule({
    id: 'schema-broken-reference',
    title: 'Structured data @id reference does not resolve',
    severity: 'notice',
    description: 'An @id pointing at nothing breaks the entity graph.',
    check(page, _ctx, emit) {
      const declaredIds = new Set<string>();
      const referencedIds: string[] = [];

      for (const node of nodesOf(page)) {
        const id = node.data['@id'];
        if (typeof id === 'string') declaredIds.add(id);
        for (const [key, value] of Object.entries(node.data)) {
          if (key === '@id') continue;
          collectRefs(value, referencedIds);
        }
      }

      for (const ref of new Set(referencedIds)) {
        if (!declaredIds.has(ref) && !/^https?:\/\//i.test(ref)) {
          emit({ message: `@id reference "${ref}" does not resolve to any node on this page` });
        }
      }
    },
  }),
];

function collectRefs(value: unknown, out: string[], depth = 0): void {
  if (depth > 6 || !value) return;
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, out, depth + 1);
    return;
  }
  if (typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  // A bare {"@id": "..."} with no other keys is a reference, not a declaration.
  const keys = Object.keys(record);
  if (keys.length === 1 && keys[0] === '@id' && typeof record['@id'] === 'string') {
    out.push(record['@id']);
    return;
  }
  for (const child of Object.values(record)) collectRefs(child, out, depth + 1);
}

/** Exposed for the AI-readiness rules, which care about which entities a page declares. */
export function schemaTypesOnPage(page: PageFacts): string[] {
  return [...new Set(nodesOf(page).map((n) => n.type))].sort();
}

export type { JsonLdBlock };

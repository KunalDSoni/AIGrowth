import { aiRules } from './ai';
import { graphRules } from './graph';
import { linkRules } from './links';
import { mediaRules } from './media';
import { metadataRules } from './metadata';
import { schemaRules } from './schema';
import { siteRules } from './site';
import { socialRules } from './social';
import { structureRules } from './structure';
import type { Rule } from '../core/types';

/**
 * The rule registry. Adding a check means adding a module and listing it here —
 * nothing else in the engine changes.
 */
export const allRules: Rule[] = [
  ...metadataRules,
  ...socialRules,
  ...structureRules,
  ...mediaRules,
  ...linkRules,
  ...siteRules,
  ...schemaRules,
  ...graphRules,
  ...aiRules,
];

const seen = new Set<string>();
for (const rule of allRules) {
  if (seen.has(rule.id)) throw new Error(`Duplicate rule id: ${rule.id}`);
  seen.add(rule.id);
}

export function rulesById(): Map<string, Rule> {
  return new Map(allRules.map((r) => [r.id, r]));
}

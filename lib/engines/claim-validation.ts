/**
 * GEN-002 — Claim validation for drafts/briefs (deterministic, no LLM).
 */

export interface ClaimFlag {
  text: string;
  reason: string;
  severity: "block" | "warn";
}

const PATTERNS: { re: RegExp; reason: string; severity: ClaimFlag["severity"] }[] = [
  { re: /\b(#1|number one|world'?s best|guaranteed ranking|guaranteed #1)\b/i, reason: "Absolute superiority claim", severity: "block" },
  { re: /\b(\d{1,3}%\s+(increase|growth|more|better|roi))\b/i, reason: "Unverified percentage claim", severity: "block" },
  { re: /\b(clients? include|trusted by|used by)\s+[A-Z][a-zA-Z0-9&.\- ]{2,}/, reason: "Named client claim needs proof", severity: "warn" },
  { re: /\b(award[- ]winning|certified|accredited)\b/i, reason: "Credential claim needs verification", severity: "warn" },
  { re: /\b(always|never fails|risk[- ]free)\b/i, reason: "Absolute assurance language", severity: "warn" },
];

export function validateClaims(body: string): ClaimFlag[] {
  const flags: ClaimFlag[] = [];
  const seen = new Set<string>();
  for (const pattern of PATTERNS) {
    const match = body.match(pattern.re);
    if (!match) continue;
    const text = match[0];
    const key = `${pattern.reason}:${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    flags.push({ text, reason: pattern.reason, severity: pattern.severity });
  }
  return flags;
}

export function canApprove(flags: ClaimFlag[], humanAckCleared: boolean): boolean {
  if (humanAckCleared) return true;
  return !flags.some((f) => f.severity === "block");
}

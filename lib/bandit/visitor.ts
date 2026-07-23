import { createHash, randomUUID } from "node:crypto";

export const BANDIT_COOKIE = "og_bandit_vid";

export function hashVisitorId(raw: string): string {
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

export function newVisitorId(): string {
  return hashVisitorId(randomUUID());
}

export function parseCookieHeader(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("=") ?? "");
  }
  return out;
}

export function banditCookieHeader(visitorId: string): string {
  return `${BANDIT_COOKIE}=${encodeURIComponent(visitorId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`;
}

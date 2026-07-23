# Security and privacy

## Implemented MVP controls

- Zod validation on onboarding and API inputs.
- HTTP(S)-only URL parsing with obvious loopback, link-local and RFC1918 targets blocked.
- API content-length caps and bounded string inputs.
- No `dangerouslySetInnerHTML`; generated content is rendered as text or editable textareas.
- Secrets are environment variables and `.env*` is ignored.
- Mock provider state is local to the browser; privacy copy says so.
- Destructive demo deletion requires a confirmation dialog.
- Opt-in safe crawler resolves DNS server-side, rejects private/local targets before request and after redirect, applies timeouts, caps bytes, and only accepts HTML.

## Production crawler requirements

URL text validation alone is not sufficient against SSRF. The current `SafeWebsiteCrawler` adds DNS checks and redirect checks, but a production crawler should also pin/verify addresses to prevent rebinding, enforce an explicit port allowlist, cap redirect depth, enforce decompressed byte limits, use an isolated egress service, persist robots decisions, and add durable rate limiting. It must never bypass authentication, CAPTCHAs or bot protections.

## Before production

Add server-side sessions and organization authorization, CSRF protection where applicable, durable rate limiting, audit logs, encryption/key management, retention controls, dependency and secret scanning, CSP/security headers, abuse monitoring, provider webhook verification, database backups, and deletion/export jobs. Treat generated content as untrusted input throughout its lifetime.

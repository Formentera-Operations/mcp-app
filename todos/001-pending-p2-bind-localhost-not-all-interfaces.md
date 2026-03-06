---
status: complete
priority: p2
issue_id: "001"
tags: [code-review, security, http-transport]
dependencies: []
---

# Bind HTTP to localhost, not 0.0.0.0

## Problem Statement

`main.ts:15` binds the HTTP server to `0.0.0.0`, exposing it on all network interfaces. Combined with `cors()` (wildcard CORS) and no authentication, any device on the local network can send MCP requests to the server.

This is a development-only transport (basic-host testing), but the defaults should be secure.

## Findings

- **Security Sentinel**: Flagged as P1 — CORS wildcard + 0.0.0.0 binding + no auth
- **Pattern Recognition**: Flagged duplicate — hardcoded host

## Proposed Solutions

### Option A: Bind to 127.0.0.1 (Recommended)
Change `createMcpExpressApp({ host: '0.0.0.0' })` to `createMcpExpressApp({ host: '127.0.0.1' })`.

**Pros:** One-line fix, secure by default
**Cons:** None — anyone needing external access can override via `HOST` env var
**Effort:** Small

### Option B: Environment variable with safe default
```typescript
const host = process.env.HOST ?? '127.0.0.1';
const app = createMcpExpressApp({ host });
```

**Pros:** Configurable, secure default
**Cons:** Slightly more code
**Effort:** Small

## Recommended Action

Option B — env var with safe default. Also scope CORS to localhost origin.

## Technical Details

- **File:** `main.ts:15`
- **Also address:** CORS origin restriction (`cors({ origin: 'http://localhost:8080' })`)

## Acceptance Criteria

- [ ] HTTP server binds to 127.0.0.1 by default
- [ ] CORS is scoped to localhost origins, not wildcard
- [ ] HOST env var allows override for advanced use

## Work Log

| Date | Action |
|------|--------|
| 2026-03-06 | Created from code review |

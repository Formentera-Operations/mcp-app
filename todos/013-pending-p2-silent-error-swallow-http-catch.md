---
status: complete
priority: p2
issue_id: "013"
tags: [code-review, error-handling, architecture]
dependencies: []
---

# HTTP catch block silently swallows errors

## Problem Statement

`main.ts:32-39` catches transport/protocol errors but only sends a JSON-RPC error response — it never logs the error. The SDK reference example includes `console.error("MCP error:", error)` in the same position. Without logging, transport failures are invisible during development.

## Findings

- **Architecture Strategist**: Flagged as P2 — errors invisible in HTTP mode

## Proposed Solutions

Add `console.error('MCP transport error:', error);` before the response:

```typescript
} catch (error) {
  console.error('MCP transport error:', error);
  if (!res.headersSent) {
    res.status(500).json({ ... });
  }
}
```

**Effort:** Small (one line)

## Technical Details

- **File:** `main.ts:32`

## Acceptance Criteria

- [ ] Errors in the HTTP catch block are logged to stderr
- [ ] JSON-RPC error response still sent to client

## Work Log

| Date | Action |
|------|--------|
| 2026-03-06 | Created from architecture review |

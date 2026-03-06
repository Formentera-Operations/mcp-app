---
status: complete
priority: p2
issue_id: "004"
tags: [code-review, error-handling]
dependencies: []
---

# Missing .catch() on app.connect() promise

## Problem Statement

`src/shared/lifecycle.ts:132` calls `app.connect().then(...)` without a `.catch()`. If the connection fails, the promise rejection is unhandled, which may cause a silent failure or an unhandled rejection warning in the host.

## Findings

- **Pattern Recognition**: Flagged as P2 — unhandled promise rejection

## Proposed Solutions

### Option A: Add .catch() with sendLog (Recommended)
```typescript
app.connect()
  .then(() => initThemeAfterConnect(app))
  .catch((err) => {
    const el = document.getElementById('error-msg');
    if (el) {
      el.textContent = `Connection failed: ${String(err)}`;
      el.style.display = 'flex';
    }
  });
```

**Pros:** User sees error, no silent failure
**Cons:** Can't use sendLog since app isn't connected
**Effort:** Small

## Technical Details

- **File:** `src/shared/lifecycle.ts:132-134`

## Acceptance Criteria

- [ ] `app.connect()` has a `.catch()` handler
- [ ] Connection failure shows a visible error in the UI

## Work Log

| Date | Action |
|------|--------|
| 2026-03-06 | Created from code review |

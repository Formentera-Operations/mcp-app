---
status: complete
priority: p2
issue_id: "002"
tags: [code-review, performance, echarts]
dependencies: []
---

# Duplicate DataZoom event listeners

## Problem Statement

`setupDataZoomContext()` in `src/production-chart.ts:281` is called in both `onToolInput` and `onToolResult` callbacks. Each call adds a new `chart.on('datazoom', ...)` listener without removing the previous one. Over time (or with repeated tool calls), this stacks up listeners causing redundant `updateModelContext` calls.

## Findings

- **Performance Oracle**: Flagged as P1 — duplicate event listeners
- **Pattern Recognition**: Flagged as P2 — duplicate listeners per tool call

## Proposed Solutions

### Option A: Guard with boolean flag (Recommended)
```typescript
let dataZoomWired = false;

function setupDataZoomContext(app) {
  if (dataZoomWired || !chart) return;
  dataZoomWired = true;
  chart.on('datazoom', () => { ... });
}
```

**Pros:** Simplest fix, zero overhead
**Cons:** Assumes chart instance doesn't change
**Effort:** Small

### Option B: Remove previous listener before adding
Use `chart.off('datazoom')` before `chart.on(...)`.

**Pros:** Works even if chart is recreated
**Cons:** Slightly more code
**Effort:** Small

## Technical Details

- **File:** `src/production-chart.ts:281-313`
- **Called from:** lines 330 and 339

## Acceptance Criteria

- [ ] DataZoom listener is registered exactly once regardless of how many tool calls fire
- [ ] `updateModelContext` fires once per user zoom interaction

## Work Log

| Date | Action |
|------|--------|
| 2026-03-06 | Created from code review |

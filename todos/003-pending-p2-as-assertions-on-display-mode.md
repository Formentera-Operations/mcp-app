---
status: complete
priority: p2
issue_id: "003"
tags: [code-review, typescript, type-safety]
dependencies: []
---

# Replace `as` assertions on displayMode and getOption()

## Problem Statement

`src/shared/lifecycle.ts` uses `as 'inline' | 'fullscreen'` casts on `ctx.displayMode` (line 37) and `result.mode` (line 113). The SDK types `displayMode` as `string`, so if a future SDK version adds a new mode, the cast silently narrows it. Similarly, `src/production-chart.ts:289` casts `chart.getOption()` with `as Record<string, unknown>`.

Per CLAUDE.md hard rules: "Never use `as` type assertions on external input."

## Findings

- **TypeScript Reviewer**: Flagged displayMode narrowing and getOption cast
- **Pattern Recognition**: Flagged unguarded displayMode as P1
- **Security Sentinel**: Flagged `as` assertions generally

## Proposed Solutions

### Option A: Runtime validation (Recommended)
```typescript
// lifecycle.ts
if (ctx.displayMode === 'inline' || ctx.displayMode === 'fullscreen') {
  currentDisplayMode = ctx.displayMode;
}
```

For getOption(), assign to a variable with runtime checks rather than casting.

**Pros:** Safe, explicit, no `as`
**Cons:** Slightly more verbose
**Effort:** Small

## Technical Details

- **Files:** `src/shared/lifecycle.ts:37,113`, `src/production-chart.ts:289`
- **Additional:** Non-null assertions on `byDate.get(d)!` at lines 144-147

## Acceptance Criteria

- [ ] No `as` assertions on external/SDK values in lifecycle.ts or production-chart.ts
- [ ] displayMode validated before assignment
- [ ] getOption() result accessed safely without cast
- [ ] `byDate.get(d)!` replaced with safe access

## Work Log

| Date | Action |
|------|--------|
| 2026-03-06 | Created from code review |

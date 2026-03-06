---
status: complete
priority: p3
issue_id: "007"
tags: [code-review, cleanup, dead-code]
dependencies: []
---

# Remove unused format.ts functions

## Problem Statement

`src/shared/format.ts` exports 6 functions but only `fmtNum` is used (by `production-chart.ts`). The remaining 5 (`fmtDec`, `fmtCurrency`, `fmtPercent`, `fmtDate`, `fmtDateShort`) are dead code.

These will be needed by future tools (data-table, decline-curve), but per YAGNI they shouldn't exist until used.

## Findings

- **Simplicity Reviewer**: Flagged as P1 (simplicity) — unused exports

## Proposed Solutions

### Option A: Delete unused functions now
Remove everything except `fmtNum`. Re-add when needed.

**Pros:** Clean, no dead code
**Cons:** Will need to rewrite for data-table tool
**Effort:** Small

### Option B: Keep — these are planned for Phase 2
The CLAUDE.md spec lists `show-data-table` tool which needs `fmtCurrency`, `fmtPercent`, `fmtDate`.

**Pros:** Avoids rewriting soon
**Cons:** Dead code until next tool is added
**Effort:** None

## Recommended Action

Option B — these are documented in the spec and will be used imminently. Low risk to keep.

## Acceptance Criteria

- [ ] Decision made: keep or remove
- [ ] If removed, tree-shaker would eliminate them anyway (no runtime impact)

## Work Log

| Date | Action |
|------|--------|
| 2026-03-06 | Created from code review |

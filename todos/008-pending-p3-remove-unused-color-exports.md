---
status: complete
priority: p3
issue_id: "008"
tags: [code-review, cleanup, dead-code]
dependencies: []
---

# Unused color exports in colors.ts

## Problem Statement

`src/shared/colors.ts` exports many constants that aren't yet imported anywhere: `FP_BLACK`, `FP_DARK_SLATE`, `FP_TEAL`, `FP_PURPLE`, `FP_CRIMSON`, `FP_GREEN`, `FP_STEEL`, `FP_POSITIVE`, `FP_NEGATIVE`, `FP_CAUTION`, `STATUS_COLORS`, `FP_CHART_COLORS_BASE`.

## Findings

- **Simplicity Reviewer**: Flagged as P1 (simplicity) — unused exports

## Proposed Solutions

Same as format.ts — these are brand constants documented in CLAUDE.md and needed for Phase 2 tools (well-map uses STATUS_COLORS, variance-waterfall uses FP_POSITIVE/FP_NEGATIVE). Tree-shaking removes unused exports from the bundle anyway.

**Recommendation:** Keep. They're the brand system, not speculative code.

## Acceptance Criteria

- [ ] Verify Vite tree-shakes unused exports from the production chart bundle

## Work Log

| Date | Action |
|------|--------|
| 2026-03-06 | Created from code review |

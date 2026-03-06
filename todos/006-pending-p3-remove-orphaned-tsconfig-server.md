---
status: complete
priority: p3
issue_id: "006"
tags: [code-review, cleanup]
dependencies: []
---

# Remove orphaned tsconfig.server.json

## Problem Statement

`tsconfig.server.json` is not referenced by any build script. The `build` script runs `tsc --noEmit` (which uses `tsconfig.json`), and `serve` uses `tsx` (which doesn't need a tsconfig for compilation). The file is dead config.

## Findings

- **Simplicity Reviewer**: Flagged as P1 (simplicity) — orphaned config

## Proposed Solutions

Delete `tsconfig.server.json`.

**Effort:** Small

## Acceptance Criteria

- [ ] `tsconfig.server.json` deleted
- [ ] `npm run build` still works
- [ ] `npm run serve` still works

## Work Log

| Date | Action |
|------|--------|
| 2026-03-06 | Created from code review |
| 2026-03-06 | Deleted tsconfig.server.json — build + serve verified |

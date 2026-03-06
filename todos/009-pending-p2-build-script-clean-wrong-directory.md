---
status: complete
priority: p2
issue_id: "009"
tags: [code-review, build, bug]
dependencies: []
---

# build-views.mjs cleans wrong directory for old HTML files

## Problem Statement

`build-views.mjs:21` scans `dist/` for `.html` files to remove before rebuilding. But Vite outputs to `dist/views/` (because the input path is `views/production-chart.html`). The clean step never finds the old files, so stale HTML from deleted views could linger.

## Findings

- **Architecture review** (cross-agent consensus) — the clean logic targets the wrong subdirectory

## Proposed Solutions

### Option A: Fix the clean path (Recommended)
```javascript
const cleanDir = join('dist', 'views');
if (existsSync(cleanDir)) {
  for (const file of readdirSync(cleanDir)) {
    if (file.endsWith('.html')) {
      rmSync(join(cleanDir, file));
    }
  }
}
```

**Pros:** Correct, simple
**Effort:** Small

## Technical Details

- **File:** `build-views.mjs:20-26`

## Acceptance Criteria

- [ ] Old HTML files in `dist/views/` are cleaned before rebuild
- [ ] `npm run build` still succeeds

## Work Log

| Date | Action |
|------|--------|
| 2026-03-06 | Created from code review |

---
status: complete
priority: p3
issue_id: "010"
tags: [code-review, consistency, css]
dependencies: []
---

# Hardcoded hex colors in production-chart.html

## Problem Statement

`views/production-chart.html` uses hardcoded hex values (`#001F45`, `#7F7F7F`, `#E6E6E6`, `#F2F2F2`, etc.) instead of CSS custom properties. If brand colors change, every HTML file needs manual updates.

## Findings

- **Pattern Recognition**: Flagged as P2 — should use CSS custom properties

## Proposed Solutions

### Option A: Define CSS custom properties in HTML, reference throughout
Add `:root` block with `--fp-navy`, `--fp-gray`, etc. at the top of the `<style>` block, then replace all hex literals.

**Pros:** Single source of truth in each HTML file, matches CLAUDE.md spec
**Cons:** Slight refactor
**Effort:** Small

## Technical Details

- **File:** `views/production-chart.html:9-93`

## Acceptance Criteria

- [ ] All color values in HTML use CSS custom properties
- [ ] Visual appearance unchanged

## Work Log

| Date | Action |
|------|--------|
| 2026-03-06 | Created from code review |

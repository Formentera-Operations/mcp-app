---
status: complete
priority: p3
issue_id: "011"
tags: [code-review, performance, server]
dependencies: []
---

# Cache HTML resource file reads

## Problem Statement

`server.ts:17-20` reads the HTML file from disk on every resource request via `fs.readFile`. Since the HTML is a build artifact that doesn't change at runtime, it could be cached in memory.

## Findings

- **Performance Oracle**: Flagged as P1 (performance) — no HTML caching

## Proposed Solutions

### Option A: Lazy-cache with Map (Recommended)
```typescript
const htmlCache = new Map<string, string>();

async function readViewHtml(filename: string): Promise<string> {
  const cached = htmlCache.get(filename);
  if (cached) return cached;
  const html = await fs.readFile(path.join(DIST_DIR, 'views', filename), 'utf-8');
  htmlCache.set(filename, html);
  return html;
}
```

**Pros:** Single disk read per view, simple
**Cons:** Won't pick up changes during dev (use `npm run dev` for that)
**Effort:** Small

## Technical Details

- **File:** `server.ts:17-20`

## Acceptance Criteria

- [ ] HTML read once from disk, cached for subsequent requests
- [ ] Dev workflow unaffected (dev mode uses Vite HMR, not this path)

## Work Log

| Date | Action |
|------|--------|
| 2026-03-06 | Created from code review |

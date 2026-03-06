---
status: complete
priority: p1
issue_id: "012"
tags: [code-review, build, deployment, architecture]
dependencies: []
---

# Production build path is broken — no dist/main.js produced

## Problem Statement

The `CLAUDE.md` documents the Claude Desktop config as `node dist/main.js --stdio`, but the build script (`tsc --noEmit && node build-views.mjs`) never compiles server TypeScript to JavaScript. The `--noEmit` flag means zero JS output. The `tsconfig.server.json` has `emitDeclarationOnly: true`, which only emits `.d.ts` files.

The `serve` scripts use `tsx` (a TypeScript runtime), which works for development. But anyone following the documented production deployment path will get a "file not found" error.

## Findings

- **Architecture Strategist**: Flagged as High Risk — broken deployment path
- No other agent caught this because they focused on runtime code, not build output

## Proposed Solutions

### Option A: Add esbuild compilation step (Recommended)
```json
"scripts": {
  "build": "tsc --noEmit && node build-views.mjs && esbuild main.ts server.ts --bundle --platform=node --format=esm --outdir=dist --packages=external",
}
```

Add `esbuild` as a devDependency.

**Pros:** Fast, produces working `dist/main.js` and `dist/server.js`
**Cons:** New devDependency
**Effort:** Small

### Option B: Use tsc with emitDeclarationOnly removed
Remove `emitDeclarationOnly` from `tsconfig.server.json`, add `main.ts` to its include list, and add `tsc -p tsconfig.server.json` to the build script.

**Pros:** No new dependency
**Cons:** tsc output requires runtime resolution of bare specifiers (needs `.js` extensions in imports, which are already present)
**Effort:** Small

### Option C: Keep tsx for production
Change the CLAUDE.md docs to use `tsx main.ts --stdio` instead of `node dist/main.js --stdio`. Accept tsx as a production runtime.

**Pros:** Zero build changes, already works
**Cons:** tsx adds ~200ms startup overhead; non-standard for production
**Effort:** Small (docs change only)

## Recommended Action

Option C for now — tsx is already the runtime, the overhead is negligible for a long-running server, and it avoids adding build complexity. Update the CLAUDE.md docs to match reality. Revisit when packaging for distribution.

## Technical Details

- **Files:** `package.json:7` (build script), `tsconfig.server.json`, `CLAUDE.md:268` (Claude Desktop config)
- **Root cause:** `tsc --noEmit` is a type-check step, not a compilation step

## Acceptance Criteria

- [ ] Either `dist/main.js` is produced by `npm run build`, OR the CLAUDE.md docs are updated to use `tsx`
- [ ] Following the documented Claude Desktop config actually works

## Work Log

| Date | Action |
|------|--------|
| 2026-03-06 | Created from architecture review |
| 2026-03-06 | Fixed: Option C — updated CLAUDE.md to use `npx tsx main.ts --stdio` |

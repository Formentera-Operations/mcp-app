---
title: "feat: Scaffold Formentera MCP App Server"
type: feat
date: 2026-03-05
---

# Scaffold Formentera MCP App Server

## Overview

Scaffold the Formentera MCP App server: npm project, TypeScript configs, Vite single-file build system, shared utilities (brand colors, theming, lifecycle, formatting), MCP server with tool + resource registration, dual transport (stdio/HTTP), and one complete working tool (`visualize-production`) as proof of concept.

## Problem Statement

Formentera Operations needs interactive data visualizations (production charts, well maps, variance waterfalls) rendered inline in Claude conversations. The data comes from the Snowflake MCP server; this server accepts structured JSON and renders it using ECharts/MapLibre inside MCP App iframes.

No code exists yet. This plan scaffolds the entire project and delivers one working tool end-to-end.

## Proposed Solution

A vanilla JS + TypeScript MCP server using `@modelcontextprotocol/ext-apps`. Each tool is a `registerAppTool` + `registerAppResource` pair linked by a `ui://` resource URI. Views are HTML files bundled into single files by `vite-plugin-singlefile`. A custom `build-views.mjs` script builds all views. The server supports stdio (Claude Desktop/Code) and HTTP (basic-host testing) transports.

## Technical Approach

### Architecture

```
Claude calls tool -> Server returns structuredContent -> Host fetches resource HTML ->
Iframe receives data via ontoolinput/ontoolresult -> ECharts renders chart
```

### Key SDK Patterns (from ext-apps v1.1.2)

1. **Transport**: Use `createMcpExpressApp()` from `@modelcontextprotocol/sdk/server/express.js` (Express 5) — NOT raw `express()`
2. **Handler order**: Register ALL handlers BEFORE `app.connect()`
3. **All four handlers**: `ontoolinputpartial`, `ontoolinput`, `ontoolresult`, `ontoolcancelled`
4. **Host context**: Call `app.getHostContext()` AFTER `connect()` resolves — it returns null before connection
5. **Fullscreen**: Check `ctx.availableDisplayModes` in `onhostcontextchanged`, not at init
6. **Validation**: Use type guard functions on `params.arguments` — never `as` type assertions
7. **CSP**: Set on content items in resource handler (not tool registration)
8. **Text fallback**: Every tool returns `content: [{ type: "text", text: summary }]`

### Corrections from First Plan

| Issue | Wrong (old plan) | Correct |
|-------|-----------------|---------|
| Express version | `express ^4.21.0` | `express ^5.1.0` |
| HTTP setup | `express()` + manual middleware | `createMcpExpressApp()` |
| Type assertions | `params.arguments as { data }` | Type guard function |
| cross-env version | `^7.0.3` | `^10.1.0` |
| Missing handler | No `ontoolinput` | Required by SDK |
| Missing handler | No `ontoolcancelled` | Required by SDK |
| KPI strip | `innerHTML` (XSS risk) | `textContent` + `createElement` |
| Fullscreen init | Before `connect()` | After `connect()` resolves |
| Streaming | No debounce | `requestAnimationFrame` guard |
| Partial data | No truncation handling | Check last record completeness |

## Acceptance Criteria

### Functional Requirements

- [ ] `npm run build` produces `dist/production-chart.html` (single self-contained file), `dist/main.js`, `dist/server.js`
- [ ] `node dist/main.js --stdio` starts without errors
- [ ] `node dist/main.js` starts HTTP server on port 3001
- [ ] `visualize-production` tool accepts JSON array of production records via Zod-validated schema
- [ ] Production chart renders with dual Y-axis (BBL/D left, MCF/D right), DataZoom, KPI strip
- [ ] Chart uses Formentera brand colors: Oil=#00B050, Gas=#FF0000, Water=#336699
- [ ] Streaming partial input renders chart progressively with debounce
- [ ] Forecast data renders as dashed purple lines
- [ ] Log scale toggle, stream visibility toggles work
- [ ] Fullscreen toggle appears only when host supports it
- [ ] IntersectionObserver pauses chart when scrolled out of view
- [ ] Text fallback returned for non-UI hosts
- [ ] Host theming (theme, style variables, fonts, safe area insets) applied on context change
- [ ] `updateModelContext` fires on DataZoom range change

### Non-Functional Requirements

- [ ] Zero TypeScript errors (`tsc --noEmit`)
- [ ] No `as` type assertions on external input
- [ ] No `innerHTML` — use `textContent`/`createElement`
- [ ] No `console.log` in production code — use `app.sendLog()`

### Quality Gates

- [ ] Build completes without errors
- [ ] Server starts and shuts down cleanly
- [ ] `git push` succeeds

---

## Implementation Phases

### Phase 1: Project Foundation (Tasks 1-2)

Initialize npm project, install dependencies, create TypeScript configs.

### Phase 2: Shared Utilities (Task 3)

Brand colors, host theming, app lifecycle, number formatting.

### Phase 3: Build System + Server (Task 4)

Vite config, multi-view builder, MCP server with tool/resource registration, dual-transport entry point.

### Phase 4: First Working Tool (Task 5)

Production chart HTML shell + ECharts view logic with all required behaviors.

### Phase 5: Verify + Push (Task 6)

Full build verification and push to remote.

---

## Task 1: Initialize npm Project

**Files:**
- Create: `package.json`
- Create: `.gitignore`

**Step 1: Initialize and write package.json**

```bash
cd /Users/robstover/Development/formentera/mcp-app
```

```json
{
  "name": "@formentera/mcp-app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc --noEmit && node build-views.mjs && tsc -p tsconfig.server.json",
    "build:views": "node build-views.mjs",
    "serve": "node dist/main.js",
    "serve:stdio": "node dist/main.js --stdio",
    "dev": "concurrently -n views,server \"cross-env NODE_ENV=development cross-env INPUT=views/production-chart.html vite build --watch\" \"tsx --watch main.ts --stdio\""
  },
  "dependencies": {
    "@modelcontextprotocol/ext-apps": "^1.0.0",
    "@modelcontextprotocol/sdk": "^1.24.0",
    "cors": "^2.8.5",
    "echarts": "^5.6.0",
    "express": "^5.1.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.0",
    "@types/node": "^22.15.0",
    "concurrently": "^9.2.1",
    "cross-env": "^10.1.0",
    "tsx": "^4.21.0",
    "typescript": "^5.8.0",
    "vite": "^6.0.0",
    "vite-plugin-singlefile": "^2.3.0"
  }
}
```

> **Note:** Dependency versions use ranges. `npm install` will resolve the latest compatible versions. ECharts uses `^5.6.0` (v6 not yet stable). Zod uses `^3.24.0` (v4 not yet published to npm). Express uses `^5.1.0` (required by `createMcpExpressApp`).

**Step 2: Create .gitignore**

```
node_modules/
dist/
*.tsbuildinfo
.DS_Store
```

**Step 3: Install dependencies**

```bash
npm install
```

Verify: `ls node_modules/@modelcontextprotocol/ext-apps` exists.

**Step 4: Commit**

```bash
git add package.json package-lock.json .gitignore CLAUDE.md docs/
git commit -m "feat: initialize mcp-app project with dependencies"
```

---

## Task 2: TypeScript Configs

**Files:**
- Create: `tsconfig.json` (IDE / type-checking, noEmit)
- Create: `tsconfig.server.json` (server compilation, NodeNext)

**Step 1: Create tsconfig.json**

Matches the SDK example exactly. Used by Vite for client code and IDE intellisense.

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "server.ts", "main.ts"]
}
```

**Step 2: Create tsconfig.server.json**

Compiles server.ts and main.ts to dist/ with NodeNext module resolution.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "emitDeclarationOnly": true,
    "outDir": "./dist",
    "rootDir": ".",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "include": ["server.ts", "main.ts"]
}
```

> **Note:** `emitDeclarationOnly: true` matches the SDK example. The actual JS compilation is done by tsx at runtime or can use a bundler. For our build, we'll use tsx to run the server directly from .ts files during dev, and tsc only for type declarations in production. We need to adjust the build script to actually produce runnable JS — see Task 4 for the resolution.

**Step 3: Commit**

```bash
git add tsconfig.json tsconfig.server.json
git commit -m "feat: add TypeScript configs for client and server"
```

---

## Task 3: Shared Utilities

**Files:**
- Create: `src/shared/colors.ts`
- Create: `src/shared/theme.ts`
- Create: `src/shared/lifecycle.ts`
- Create: `src/shared/format.ts`

### src/shared/colors.ts

Single source of truth for all Formentera Partners brand colors. Every view imports from here.

```typescript
// Formentera Partners brand palette (from fp-brand-2026)
// DO NOT change these without consulting the brand guidelines

// === Theme accent colors ===
export const FP_NAVY = '#001F45';
export const FP_DARK_SLATE = '#3D4F5F';
export const FP_TEAL = '#3D8B7A';
export const FP_PURPLE = '#553D8C';
export const FP_CRIMSON = '#A3192B';
export const FP_GREEN = '#6AAD4E';
export const FP_STEEL = '#336699';

// === Neutrals ===
export const FP_BLACK = '#000000';
export const FP_WHITE = '#FFFFFF';
export const FP_LIGHT_GRAY = '#E6E6E6';
export const FP_GRAY = '#7F7F7F';
export const FP_OFF_WHITE = '#F2F2F2';

// === Functional (indicators only — never decorative) ===
export const FP_POSITIVE = '#00B050';
export const FP_NEGATIVE = '#C00000';
export const FP_CAUTION = '#FFC000';

// === Commodity colors (override chart order for oil/gas/NGL/water) ===
export const COMMODITY_COLORS = {
  oil: '#00B050',
  gas: '#FF0000',
  ngl: '#7030A0',
  water: '#336699',
  boe: '#FFC000',
  forecast: '#553D8C',
} as const;

// === Well status colors ===
export const STATUS_COLORS: Record<string, string> = {
  producing: FP_GREEN,
  'shut-in': FP_CAUTION,
  'p&a': FP_GRAY,
  drilling: FP_STEEL,
  completing: FP_PURPLE,
};

// === Chart color order (1-18, for multi-series non-commodity charts) ===
export const FP_CHART_COLORS = [
  '#001F45', '#336699', '#94C1FA',  // Navy family
  '#3D4F5F', '#6B818C', '#A3B4BC',  // Slate family
  '#3D8B7A', '#8EBBB3', '#B6D3CE',  // Teal family
  '#553D8C', '#978CB5', '#BCB5CF',  // Purple family
  '#A3192B', '#BF5E6B', '#D698A0',  // Crimson family
  '#6AAD4E', '#93C87A', '#B9DEA5',  // Green family
];

// For <=6 series, use base colors only (positions 0, 3, 6, 9, 12, 15)
export const FP_CHART_COLORS_BASE = [
  '#001F45', '#3D4F5F', '#3D8B7A', '#553D8C', '#A3192B', '#6AAD4E',
];

// === ECharts theme object ===
export const FP_ECHARTS_THEME = {
  color: FP_CHART_COLORS,
  backgroundColor: FP_WHITE,
  textStyle: {
    fontFamily: 'Arial, Helvetica Neue, Helvetica, sans-serif',
    color: FP_NAVY,
  },
  title: {
    textStyle: { color: FP_NAVY, fontWeight: 'bold' as const },
    subtextStyle: { color: FP_STEEL },
  },
  legend: {
    textStyle: { color: FP_GRAY, fontSize: 12 },
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: FP_LIGHT_GRAY } },
    axisLabel: { color: FP_GRAY },
    splitLine: { lineStyle: { color: FP_LIGHT_GRAY } },
  },
  valueAxis: {
    axisLine: { lineStyle: { color: FP_LIGHT_GRAY } },
    axisLabel: { color: FP_GRAY },
    splitLine: { lineStyle: { color: FP_LIGHT_GRAY } },
  },
  dataZoom: {
    backgroundColor: FP_OFF_WHITE,
    fillerColor: 'rgba(0,31,69,0.1)',
    handleColor: FP_STEEL,
  },
};
```

### src/shared/theme.ts

Host theming integration. Every view calls `initTheme(app)`.

```typescript
import {
  applyDocumentTheme,
  applyHostStyleVariables,
  applyHostFonts,
} from '@modelcontextprotocol/ext-apps';
import type { App, McpUiHostContext } from '@modelcontextprotocol/ext-apps';

function applySafeAreaInsets(
  insets: { top: number; right: number; bottom: number; left: number },
): void {
  const main = document.querySelector('.main') as HTMLElement | null;
  if (!main) return;
  main.style.paddingTop = `${insets.top}px`;
  main.style.paddingRight = `${insets.right}px`;
  main.style.paddingBottom = `${insets.bottom}px`;
  main.style.paddingLeft = `${insets.left}px`;
}

export function handleHostContextChanged(ctx: McpUiHostContext): void {
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
  if (ctx.safeAreaInsets) applySafeAreaInsets(ctx.safeAreaInsets);
}

export function initThemeAfterConnect(app: App): void {
  const ctx = app.getHostContext();
  if (ctx) handleHostContextChanged(ctx);
}
```

> **Key difference from old plan:** `initTheme` is split into two parts. `handleHostContextChanged` is registered as `app.onhostcontextchanged` BEFORE `connect()`. `initThemeAfterConnect` is called AFTER `connect()` resolves to apply the initial context. This matches the SDK example pattern exactly.

### src/shared/lifecycle.ts

App initialization, IntersectionObserver, and fullscreen toggle.

```typescript
import { App } from '@modelcontextprotocol/ext-apps';
import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { handleHostContextChanged, initThemeAfterConnect } from './theme.ts';

export interface ViewCallbacks {
  onToolInput?: (args: Record<string, unknown>) => void;
  onToolInputPartial?: (args: Record<string, unknown>) => void;
  onToolResult?: (structuredContent: Record<string, unknown>) => void;
  onToolCancelled?: (reason: string) => void;
  onPause?: () => void;
  onResume?: () => void;
}

export function createApp(
  name: string,
  version: string,
  callbacks: ViewCallbacks,
): App {
  const app = new App({ name, version });

  // --- Register ALL handlers BEFORE connect() ---

  // Host theming + fullscreen tracking
  let currentDisplayMode: 'inline' | 'fullscreen' = 'inline';

  app.onhostcontextchanged = (ctx: McpUiHostContext) => {
    handleHostContextChanged(ctx);

    // Fullscreen button visibility
    if (ctx.availableDisplayModes !== undefined) {
      const canFullscreen = ctx.availableDisplayModes.includes('fullscreen');
      const btn = document.getElementById('fullscreen-btn');
      if (btn) btn.style.display = canFullscreen ? 'block' : 'none';
    }

    // Track display mode
    if (ctx.displayMode) {
      currentDisplayMode = ctx.displayMode as 'inline' | 'fullscreen';
      document.querySelector('.main')?.classList.toggle(
        'fullscreen',
        currentDisplayMode === 'fullscreen',
      );
    }
  };

  // Streaming partial input (debounced via requestAnimationFrame)
  let partialRafId = 0;
  if (callbacks.onToolInputPartial) {
    app.ontoolinputpartial = (params) => {
      const args = params.arguments;
      if (!args) return;
      cancelAnimationFrame(partialRafId);
      partialRafId = requestAnimationFrame(() => {
        callbacks.onToolInputPartial!(args);
      });
    };
  }

  // Complete input (tool args finalized, before server handler runs)
  if (callbacks.onToolInput) {
    app.ontoolinput = (params) => {
      cancelAnimationFrame(partialRafId);
      if (params.arguments) callbacks.onToolInput!(params.arguments);
    };
  }

  // Final result (after server handler returns)
  if (callbacks.onToolResult) {
    app.ontoolresult = (result) => {
      const sc = result.structuredContent;
      if (sc && typeof sc === 'object') {
        callbacks.onToolResult!(sc as Record<string, unknown>);
      }
    };
  }

  // Cancellation
  app.ontoolcancelled = (params) => {
    cancelAnimationFrame(partialRafId);
    callbacks.onToolCancelled?.(params.reason ?? 'unknown');
  };

  // Error + teardown
  app.onerror = (err) => {
    app.sendLog({ level: 'error', data: String(err) });
  };
  app.onteardown = async () => ({ });

  // --- Visibility-based pause/resume ---
  const mainEl = document.querySelector('.main');
  if (mainEl && (callbacks.onPause || callbacks.onResume)) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          callbacks.onResume?.();
        } else {
          callbacks.onPause?.();
        }
      }
    });
    observer.observe(mainEl);
  }

  // --- Fullscreen button ---
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  if (fullscreenBtn) {
    // Initially hidden until host context confirms support
    fullscreenBtn.style.display = 'none';
    fullscreenBtn.addEventListener('click', async () => {
      const newMode = currentDisplayMode === 'fullscreen' ? 'inline' : 'fullscreen';
      try {
        const result = await app.requestDisplayMode({ mode: newMode });
        currentDisplayMode = result.mode as 'inline' | 'fullscreen';
        document.querySelector('.main')?.classList.toggle(
          'fullscreen',
          currentDisplayMode === 'fullscreen',
        );
      } catch {
        // Host rejected the mode change
      }
    });
  }

  // --- Escape key exits fullscreen ---
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && currentDisplayMode === 'fullscreen') {
      fullscreenBtn?.click();
    }
  });

  // --- Connect, then apply initial host context ---
  app.connect().then(() => {
    initThemeAfterConnect(app);
  });

  return app;
}
```

> **Key changes from old plan:**
> - Fullscreen visibility is controlled by `onhostcontextchanged`, not `getHostContext()` before connect
> - `ontoolinputpartial` is debounced with `requestAnimationFrame`
> - `ontoolinput` cancels any pending partial RAF
> - `ontoolcancelled` handler present
> - `connect()` is called inside `createApp` — view code just calls `createApp()` and is done
> - Escape key support for exiting fullscreen

### src/shared/format.ts

Number and date formatting for O&G data.

```typescript
const numFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const decFmt = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});
const curFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function fmtNum(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '\u2014'; // em dash
  return numFmt.format(value);
}

export function fmtDec(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '\u2014';
  return decFmt.format(value);
}

export function fmtCurrency(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '\u2014';
  return curFmt.format(value);
}

export function fmtPercent(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '\u2014';
  return `${(value * 100).toFixed(1)}%`;
}

export function fmtDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function fmtDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: '2-digit', year: '2-digit' });
}
```

**Step: Verify type-checking**

```bash
npx tsc --noEmit
```

Expected: 0 errors

**Commit:**

```bash
git add src/shared/
git commit -m "feat: add shared utilities (colors, theme, lifecycle, format)"
```

---

## Task 4: Build System + Server

**Files:**
- Create: `vite.config.ts`
- Create: `build-views.mjs`
- Create: `server.ts`
- Create: `main.ts`

### vite.config.ts

Per-view Vite config. The `INPUT` env var selects which view to build. Identical to SDK example.

```typescript
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const INPUT = process.env.INPUT;
if (!INPUT) {
  throw new Error('INPUT environment variable is not set');
}

const isDevelopment = process.env.NODE_ENV === 'development';

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    sourcemap: isDevelopment ? 'inline' : undefined,
    cssMinify: !isDevelopment,
    minify: !isDevelopment,
    rollupOptions: {
      input: INPUT,
    },
    outDir: 'dist',
    emptyOutDir: false,
  },
});
```

### build-views.mjs

Builds all view HTML files in sequence. No --watch flag needed (dev mode uses Vite directly).

```javascript
import { execSync } from 'node:child_process';
import { readdirSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const viewsDir = 'views';

if (!existsSync(viewsDir)) {
  console.log('No views/ directory — skipping view build.');
  process.exit(0);
}

const views = readdirSync(viewsDir).filter((f) => f.endsWith('.html'));

if (views.length === 0) {
  console.log('No HTML files in views/ — skipping view build.');
  process.exit(0);
}

// Clean dist of old view HTML files before rebuild
if (existsSync('dist')) {
  for (const file of readdirSync('dist')) {
    if (file.endsWith('.html')) {
      rmSync(join('dist', file));
    }
  }
} else {
  mkdirSync('dist');
}

for (const view of views) {
  const inputPath = join(viewsDir, view);
  console.log(`Building ${inputPath}...`);
  execSync(`npx cross-env INPUT=${inputPath} vite build`, { stdio: 'inherit' });
}

console.log(`Built ${views.length} view(s) to dist/`);
```

### server.ts

MCP server with tool + resource registration. Uses `registerAppTool` with Zod schema validation.

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';

// Works both from source (server.ts with tsx) and compiled (dist/server.js)
const DIST_DIR = import.meta.filename.endsWith('.ts')
  ? path.join(import.meta.dirname, 'dist')
  : import.meta.dirname;

async function readViewHtml(filename: string): Promise<string> {
  // Views build to dist/views/ since input is views/*.html
  return fs.readFile(path.join(DIST_DIR, 'views', filename), 'utf-8');
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'formentera-viz',
    version: '0.1.0',
  });

  // ─── visualize-production ───────────────────────────────────

  const prodChartUri = 'ui://production-chart/mcp-app.html';

  registerAppTool(
    server,
    'visualize-production',
    {
      title: 'Visualize Production',
      description:
        'Render an interactive time-series production chart. Pass an array of production records with date, oil, gas, water, and well name. Returns a chart with dual Y-axis, DataZoom, stream toggles, and KPI strip.',
      inputSchema: {
        data: z.array(
          z.object({
            date: z.string().describe('ISO date string (YYYY-MM-DD)'),
            oil_bbl: z.number().describe('Oil production in BBL/D'),
            gas_mcf: z.number().describe('Gas production in MCF/D'),
            water_bbl: z.number().describe('Water production in BBL/D'),
            well_name: z.string().describe('Well identifier'),
            boe: z.number().optional().describe('Barrel of oil equivalent'),
            is_forecast: z.boolean().optional().describe('True if forecast'),
          }),
        ).describe('Array of daily production records'),
      },
      _meta: {
        ui: { resourceUri: prodChartUri },
      },
    },
    async ({ data }): Promise<CallToolResult> => {
      const wells = [...new Set(data.map((d) => d.well_name))];
      const dates = data.map((d) => d.date).sort();
      const peakOil = Math.max(...data.map((d) => d.oil_bbl));
      const summary = `Production chart: ${wells.length} well(s), ${dates[0]} to ${dates[dates.length - 1]}, peak oil ${Math.round(peakOil).toLocaleString()} BBL/D`;

      return {
        content: [{ type: 'text', text: summary }],
        structuredContent: { data },
      };
    },
  );

  registerAppResource(
    server,
    prodChartUri,
    prodChartUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await readViewHtml('production-chart.html');
      return {
        contents: [{ uri: prodChartUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
      };
    },
  );

  return server;
}
```

> **Key differences from old plan:**
> - `CallToolResult` return type annotated (from SDK types)
> - Zod schema does the validation — the handler receives typed `data` directly
> - No `as` type assertions
> - No `type: 'text' as const` — SDK types handle this

### main.ts

Dual-transport entry point using `createMcpExpressApp()`.

```typescript
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from './server.js';

async function startStdioServer(): Promise<void> {
  await createServer().connect(new StdioServerTransport());
}

async function startHttpServer(): Promise<void> {
  const port = parseInt(process.env.PORT ?? '3001', 10);

  const app = createMcpExpressApp({ host: '0.0.0.0' });
  app.use(cors());

  app.all('/mcp', async (req: Request, res: Response) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on('close', () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  const httpServer = app.listen(port, () => {
    console.error(`Formentera Viz MCP server listening on http://localhost:${port}/mcp`);
  });

  const shutdown = () => {
    console.error('\nShutting down...');
    httpServer.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

async function main(): Promise<void> {
  if (process.argv.includes('--stdio')) {
    await startStdioServer();
  } else {
    await startHttpServer();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

> **Key differences from old plan:**
> - Uses `createMcpExpressApp()` instead of raw `express()` — handles body parsing, CORS defaults, etc.
> - Proper error handling with `res.headersSent` check
> - `transport.close()` in addition to `server.close()` on connection close
> - Graceful shutdown with SIGINT/SIGTERM

**Commit:**

```bash
git add vite.config.ts build-views.mjs server.ts main.ts
git commit -m "feat: add Vite build system, MCP server, and dual-transport entry point"
```

---

## Task 5: Production Chart View

**Files:**
- Create: `views/production-chart.html`
- Create: `src/production-chart.ts`

### views/production-chart.html

Minimal HTML shell. Vite inlines the TypeScript at build time.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <title>Production Chart</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
      background: #FFFFFF;
      color: #001F45;
      overflow: hidden;
    }
    .main {
      width: 100vw;
      height: 100vh;
      display: flex;
      flex-direction: column;
      border-radius: var(--border-radius-lg, 8px);
      overflow: hidden;
    }
    .main.fullscreen { border-radius: 0; }

    .kpi-strip {
      display: flex;
      gap: 16px;
      padding: 8px 16px;
      background: #F2F2F2;
      border-bottom: 1px solid #E6E6E6;
      flex-shrink: 0;
    }
    .kpi { text-align: center; }
    .kpi-value { font-size: 18px; font-weight: bold; color: #001F45; }
    .kpi-label { font-size: 11px; color: #7F7F7F; text-transform: uppercase; letter-spacing: 0.5px; }

    .toolbar {
      display: flex;
      gap: 8px;
      padding: 4px 16px;
      align-items: center;
      flex-shrink: 0;
    }
    .toolbar button {
      font-family: Arial, sans-serif;
      font-size: 11px;
      padding: 3px 10px;
      border: 1px solid #E6E6E6;
      border-radius: 4px;
      background: #FFFFFF;
      color: #001F45;
      cursor: pointer;
    }
    .toolbar button.active { background: #001F45; color: #FFFFFF; }
    .toolbar button:hover:not(.active) { background: #F2F2F2; }

    #chart { flex: 1; min-height: 0; }

    .fullscreen-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 10;
      background: rgba(255,255,255,0.9);
      border: 1px solid #E6E6E6;
      border-radius: 4px;
      padding: 4px;
      cursor: pointer;
      line-height: 0;
      display: none;
    }

    .error-msg {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      color: #C00000;
      font-size: 14px;
      padding: 24px;
      text-align: center;
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      color: #7F7F7F;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="main">
    <div class="loading" id="loading">Loading chart data...</div>
    <div class="kpi-strip" id="kpi-strip" style="display:none"></div>
    <div class="toolbar" id="toolbar" style="display:none">
      <button id="btn-linear" class="active">Linear</button>
      <button id="btn-log">Log</button>
      <span style="flex:1"></span>
      <button id="btn-oil" class="active" style="color:#00B050">Oil</button>
      <button id="btn-gas" class="active" style="color:#FF0000">Gas</button>
      <button id="btn-water" class="active" style="color:#336699">Water</button>
    </div>
    <div id="chart"></div>
    <button class="fullscreen-btn" id="fullscreen-btn" title="Toggle fullscreen">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#001F45" stroke-width="1.5">
        <polyline points="10,2 14,2 14,6"/><polyline points="6,14 2,14 2,10"/>
        <line x1="14" y1="2" x2="10" y2="6"/><line x1="2" y1="14" x2="6" y2="10"/>
      </svg>
    </button>
    <div class="error-msg" id="error-msg" style="display:none"></div>
  </div>
  <script type="module" src="/src/production-chart.ts"></script>
</body>
</html>
```

> **Key changes:** Fullscreen button starts `display:none` (lifecycle.ts shows it when host supports it). Error div renamed to avoid collision with class name.

### src/production-chart.ts

ECharts production chart with all required behaviors.

```typescript
import * as echarts from 'echarts';
import { createApp } from './shared/lifecycle.ts';
import {
  COMMODITY_COLORS,
  FP_ECHARTS_THEME,
  FP_NAVY,
  FP_GRAY,
  FP_LIGHT_GRAY,
  FP_OFF_WHITE,
} from './shared/colors.ts';
import { fmtNum } from './shared/format.ts';

// Register Formentera brand theme
echarts.registerTheme('formentera', FP_ECHARTS_THEME);

// --- Type guard for production data (no `as` assertions) ---

interface ProductionRecord {
  date: string;
  oil_bbl: number;
  gas_mcf: number;
  water_bbl: number;
  well_name: string;
  boe?: number;
  is_forecast?: boolean;
}

function isProductionRecord(v: unknown): v is ProductionRecord {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.date === 'string' &&
    typeof r.oil_bbl === 'number' &&
    typeof r.gas_mcf === 'number' &&
    typeof r.water_bbl === 'number' &&
    typeof r.well_name === 'string'
  );
}

function extractData(args: Record<string, unknown>): ProductionRecord[] | null {
  const raw = args.data;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  // Filter to only valid records (handles truncated partial JSON)
  const valid = raw.filter(isProductionRecord);
  return valid.length > 0 ? valid : null;
}

// --- State ---

let chart: echarts.ECharts | null = null;
let currentData: ProductionRecord[] = [];
let logScale = false;
const visibleStreams = { oil: true, gas: true, water: true };

// --- UI helpers ---

function showError(msg: string): void {
  const el = document.getElementById('error-msg');
  if (el) {
    el.textContent = msg;
    el.style.display = 'flex';
  }
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';
}

function buildKpiStrip(data: ProductionRecord[]): void {
  const strip = document.getElementById('kpi-strip');
  if (!strip) return;

  const wells = [...new Set(data.map((d) => d.well_name))];
  const latestDate = data.reduce(
    (max, d) => (d.date > max ? d.date : max),
    data[0].date,
  );
  const latest = data.filter((d) => d.date === latestDate && !d.is_forecast);
  const totalOil = latest.reduce((s, d) => s + d.oil_bbl, 0);
  const totalGas = latest.reduce((s, d) => s + d.gas_mcf, 0);
  const totalWater = latest.reduce((s, d) => s + d.water_bbl, 0);

  // Build KPIs with createElement (no innerHTML)
  strip.replaceChildren();

  const kpis: Array<{ value: string; label: string; color?: string }> = [
    { value: String(wells.length), label: 'Wells' },
    { value: fmtNum(totalOil), label: 'Oil BBL/D', color: COMMODITY_COLORS.oil },
    { value: fmtNum(totalGas), label: 'Gas MCF/D', color: COMMODITY_COLORS.gas },
    { value: fmtNum(totalWater), label: 'Water BBL/D', color: COMMODITY_COLORS.water },
  ];

  for (const kpi of kpis) {
    const div = document.createElement('div');
    div.className = 'kpi';

    const valEl = document.createElement('div');
    valEl.className = 'kpi-value';
    valEl.textContent = kpi.value;
    if (kpi.color) valEl.style.color = kpi.color;

    const labelEl = document.createElement('div');
    labelEl.className = 'kpi-label';
    labelEl.textContent = kpi.label;

    div.appendChild(valEl);
    div.appendChild(labelEl);
    strip.appendChild(div);
  }

  strip.style.display = 'flex';
}

function buildChart(data: ProductionRecord[]): void {
  if (data.length === 0) {
    showError('No production data provided.');
    return;
  }

  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';
  const toolbar = document.getElementById('toolbar');
  if (toolbar) toolbar.style.display = 'flex';

  buildKpiStrip(data);

  const container = document.getElementById('chart');
  if (!container) return;

  if (!chart) {
    chart = echarts.init(container, 'formentera');
    window.addEventListener('resize', () => chart?.resize());
  }

  // Aggregate by date across wells
  const byDate = new Map<string, { oil: number; gas: number; water: number; forecast: boolean }>();
  for (const row of data) {
    const existing = byDate.get(row.date) ?? { oil: 0, gas: 0, water: 0, forecast: false };
    existing.oil += row.oil_bbl;
    existing.gas += row.gas_mcf;
    existing.water += row.water_bbl;
    if (row.is_forecast) existing.forecast = true;
    byDate.set(row.date, existing);
  }

  const dates = [...byDate.keys()].sort();
  const oilData = dates.map((d) => byDate.get(d)!.oil);
  const gasData = dates.map((d) => byDate.get(d)!.gas);
  const waterData = dates.map((d) => byDate.get(d)!.water);
  const forecastMask = dates.map((d) => byDate.get(d)!.forecast);

  // Build series with forecast split
  const makeSeries = (
    name: string,
    values: number[],
    color: string,
    yAxisIndex: number,
  ): echarts.SeriesOption[] => {
    const actual = values.map((v, i) => (forecastMask[i] ? null : v));
    const forecast = values.map((v, i) => (forecastMask[i] ? v : null));
    const hasForecast = forecast.some((v) => v !== null);

    const series: echarts.SeriesOption[] = [
      {
        name,
        type: 'line',
        yAxisIndex,
        data: actual,
        symbol: 'none',
        lineStyle: { color, width: 2 },
        itemStyle: { color },
        areaStyle: { color: `${color}18` },
      },
    ];

    if (hasForecast) {
      series.push({
        name: `${name} (Forecast)`,
        type: 'line',
        yAxisIndex,
        data: forecast,
        symbol: 'none',
        lineStyle: { color: COMMODITY_COLORS.forecast, width: 2, type: 'dashed' },
        itemStyle: { color: COMMODITY_COLORS.forecast },
      });
    }

    return series;
  };

  const series: echarts.SeriesOption[] = [];
  if (visibleStreams.oil) series.push(...makeSeries('Oil (BBL/D)', oilData, COMMODITY_COLORS.oil, 0));
  if (visibleStreams.gas) series.push(...makeSeries('Gas (MCF/D)', gasData, COMMODITY_COLORS.gas, 1));
  if (visibleStreams.water) series.push(...makeSeries('Water (BBL/D)', waterData, COMMODITY_COLORS.water, 0));

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: FP_NAVY,
      borderColor: FP_NAVY,
      textStyle: { color: '#FFFFFF', fontFamily: 'Arial, sans-serif', fontSize: 12 },
    },
    legend: { show: false },
    grid: { left: 70, right: 70, top: 16, bottom: 60 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { color: FP_GRAY, fontSize: 11 },
      axisLine: { lineStyle: { color: FP_LIGHT_GRAY } },
    },
    yAxis: [
      {
        type: logScale ? 'log' : 'value',
        name: 'BBL/D',
        nameTextStyle: { color: FP_GRAY, fontSize: 11 },
        axisLabel: { color: FP_GRAY, fontSize: 11 },
        axisLine: { lineStyle: { color: FP_LIGHT_GRAY } },
        splitLine: { lineStyle: { color: FP_LIGHT_GRAY } },
      },
      {
        type: logScale ? 'log' : 'value',
        name: 'MCF/D',
        nameTextStyle: { color: FP_GRAY, fontSize: 11 },
        axisLabel: { color: FP_GRAY, fontSize: 11 },
        axisLine: { lineStyle: { color: FP_LIGHT_GRAY } },
        splitLine: { show: false },
      },
    ],
    dataZoom: [
      {
        type: 'slider',
        show: true,
        height: 24,
        bottom: 8,
        backgroundColor: FP_OFF_WHITE,
        fillerColor: 'rgba(0,31,69,0.08)',
        borderColor: FP_LIGHT_GRAY,
        handleStyle: { color: FP_NAVY },
        textStyle: { color: FP_GRAY, fontSize: 10 },
      },
    ],
    series,
  };

  chart.setOption(option, true);
}

// --- Toolbar wiring ---

function setupToolbar(): void {
  const btnLinear = document.getElementById('btn-linear');
  const btnLog = document.getElementById('btn-log');
  const btnOil = document.getElementById('btn-oil');
  const btnGas = document.getElementById('btn-gas');
  const btnWater = document.getElementById('btn-water');

  btnLinear?.addEventListener('click', () => {
    logScale = false;
    btnLinear.classList.add('active');
    btnLog?.classList.remove('active');
    buildChart(currentData);
  });

  btnLog?.addEventListener('click', () => {
    logScale = true;
    btnLog.classList.add('active');
    btnLinear?.classList.remove('active');
    buildChart(currentData);
  });

  const toggleStream = (stream: keyof typeof visibleStreams, btn: HTMLElement) => {
    visibleStreams[stream] = !visibleStreams[stream];
    btn.classList.toggle('active', visibleStreams[stream]);
    buildChart(currentData);
  };

  btnOil?.addEventListener('click', () => toggleStream('oil', btnOil));
  btnGas?.addEventListener('click', () => toggleStream('gas', btnGas));
  btnWater?.addEventListener('click', () => toggleStream('water', btnWater));
}

// --- DataZoom -> updateModelContext ---

function setupDataZoomContext(app: ReturnType<typeof createApp>): void {
  if (!chart) return;

  let zoomTimeout = 0;
  chart.on('datazoom', () => {
    clearTimeout(zoomTimeout);
    zoomTimeout = window.setTimeout(() => {
      if (!chart) return;
      const option = chart.getOption() as { dataZoom?: Array<{ startValue?: number; endValue?: number }> };
      const zoom = option.dataZoom?.[0];
      const dates = (chart.getOption() as { xAxis?: Array<{ data?: string[] }> }).xAxis?.[0]?.data;
      if (!zoom || !dates) return;

      const startIdx = Math.max(0, Math.round(zoom.startValue ?? 0));
      const endIdx = Math.min(dates.length - 1, Math.round(zoom.endValue ?? dates.length - 1));
      const wells = [...new Set(currentData.map((d) => d.well_name))];

      app.updateModelContext({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              visibleDateRange: { start: dates[startIdx], end: dates[endIdx] },
              wells,
              streamVisibility: visibleStreams,
              scaleMode: logScale ? 'log' : 'linear',
            }),
          },
        ],
      });
    }, 500);
  });
}

// --- Initialize ---

const app = createApp('Production Chart', '0.1.0', {
  onToolInputPartial: (args) => {
    const data = extractData(args);
    if (data) {
      currentData = data;
      buildChart(currentData);
    }
  },
  onToolInput: (args) => {
    const data = extractData(args);
    if (data) {
      currentData = data;
      buildChart(currentData);
      setupDataZoomContext(app);
    }
  },
  onToolResult: (sc) => {
    const data = extractData(sc);
    if (data) {
      currentData = data;
      buildChart(currentData);
      setupDataZoomContext(app);
    } else if (currentData.length === 0) {
      showError('No production data received.');
    }
  },
  onToolCancelled: () => {
    if (currentData.length === 0) {
      showError('Tool call was cancelled.');
    }
  },
  onPause: () => { /* ECharts auto-pauses canvas rendering when hidden */ },
  onResume: () => { chart?.resize(); },
});

setupToolbar();
```

> **Key improvements over old plan:**
> 1. **Type guard** (`isProductionRecord`) instead of `as` assertions — validates each record
> 2. **Truncation-safe** — `extractData` filters to only valid records, so partial JSON with an incomplete last object is handled
> 3. **No `innerHTML`** — KPI strip built with `createElement`/`textContent`
> 4. **`ontoolinput` handler** — renders on complete input (before server handler runs)
> 5. **`ontoolcancelled` handler** — shows message if no data received
> 6. **Streaming debounce** — handled in lifecycle.ts via `requestAnimationFrame`
> 7. **Fullscreen** — handled in lifecycle.ts, initialized AFTER connect
> 8. **`updateModelContext`** — fires on DataZoom change (debounced 500ms) with visible range, wells, and settings

**Build and verify:**

```bash
npm run build
ls -la dist/
```

Expected: `dist/production-chart.html` exists, plus server JS files.

**Test server start:**

```bash
timeout 3 node dist/main.js 2>&1 || true
```

Expected: `Formentera Viz MCP server listening on http://localhost:3001/mcp`

**Commit:**

```bash
git add views/ src/production-chart.ts
git commit -m "feat: add production-chart view with ECharts, streaming, and updateModelContext"
```

---

## Task 6: Build Verification + Push

**Step 1: Clean build from scratch**

```bash
rm -rf dist/
npm run build
```

Expected: 0 errors, `dist/production-chart.html` exists

**Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

**Step 3: Verify server starts (both transports)**

```bash
# HTTP
timeout 3 node dist/main.js 2>&1 || true
# Expected: listening message

# stdio (just verify it doesn't crash)
echo '{}' | timeout 2 node dist/main.js --stdio 2>&1 || true
```

**Step 4: Push**

```bash
git push -u origin main
```

Expected: push succeeds

---

## Build Script Note

The `tsconfig.server.json` uses `emitDeclarationOnly: true` to match the SDK example pattern. For the actual production build, we need runnable JS. Two options:

**Option A (recommended for now):** Update the `build` script in package.json to use tsx at runtime:
```json
"serve": "tsx main.ts",
"serve:stdio": "tsx main.ts --stdio"
```

**Option B:** Add a bundler step (like the SDK uses `bun build`). Since we use tsx as a devDependency, Option A is simpler for MVP.

The build script should be:
```json
"build": "tsc --noEmit && node build-views.mjs",
"serve": "tsx main.ts",
"serve:stdio": "tsx main.ts --stdio"
```

This avoids needing a server compilation step entirely — tsx runs TypeScript directly. The `tsc --noEmit` is just for type-checking.

---

## Summary of Deliverables

| File | Purpose |
|------|---------|
| `package.json` | Dependencies and scripts |
| `.gitignore` | Ignore node_modules, dist |
| `tsconfig.json` | Client/IDE type-checking |
| `tsconfig.server.json` | Server type declarations |
| `vite.config.ts` | Per-view Vite config |
| `build-views.mjs` | Multi-view build orchestrator |
| `server.ts` | Tool + resource registration |
| `main.ts` | stdio / HTTP entry point |
| `src/shared/colors.ts` | Brand color constants |
| `src/shared/theme.ts` | Host theming integration |
| `src/shared/lifecycle.ts` | App init, visibility, fullscreen, streaming |
| `src/shared/format.ts` | Number/date formatters |
| `src/production-chart.ts` | ECharts production chart logic |
| `views/production-chart.html` | Production chart HTML shell |

## Next Steps (Separate Plans)

- Add `show-well-map` view (MapLibre GL JS + OpenFreeMap tiles)
- Add `visualize-variance` view (ECharts waterfall)
- Add `visualize-decline` view (ECharts decline curve with Arps)
- Add `show-data-table` view (sortable table with CSV export)
- Wire up basic-host testing workflow
- Add `sendMessage` button in well map popup (stretch)

## References

### Internal

- `CLAUDE.md` — Project specification and brand system
- `/tmp/mcp-ext-apps/examples/basic-server-vanillajs/` — Canonical SDK patterns
- `/tmp/mcp-ext-apps/examples/map-server/` — CSP configuration, `updateModelContext`
- `/tmp/mcp-ext-apps/examples/shadertoy-server/` — Streaming partial input, fullscreen, visibility pause

### External

- [MCP Apps Extension Spec](https://modelcontextprotocol.io/extensions/apps/overview)
- [ECharts Configuration](https://echarts.apache.org/en/option.html)
- [Formentera Partners Brand Guidelines](fp-brand-2026 skill)

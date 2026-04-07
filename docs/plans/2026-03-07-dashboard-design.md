# Design: Formentera Composable Dashboard System

**Date**: 2026-03-07
**Status**: Approved (brainstorm complete)
**Author**: Rob Stover + Claude

## Problem

Formentera operators (Production Ops, Owner Relations, Land & Title, field ops) need tailored dashboards combining maps, charts, tables, and KPIs — but today each visualization is a separate MCP tool call. There's no way to compose multiple visualizations into a single dashboard view inline in a Claude conversation.

## Decision Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Two MCP servers | Clean separation: `formentera-viz` (specialized tools, vanilla JS) stays as-is; new `formentera-dashboard` (composable UI, React) |
| Repo | New repo: `Formentera-Operations/mcp-dashboard` | Independent lifecycle, own CI/CD, no coupling to viz server |
| Composition model | AI generates full JSON tree, one-shot | Claude generates the complete component tree in a single `render-dashboard` tool call. Streaming via `ontoolinputpartial` gives progressive rendering for free |
| V1 components | Layout + charts + tables (no maps) | Maps deferred — MapLibre adds ~1.5MB and PMTiles adds complexity. V1 proves the pattern without the heaviest dependency |
| UI stack | React + shadcn/ui + Tremor + TanStack Table + ECharts + Tailwind | Per the Formentera Design System v0.3 spec. Two charting tiers: Tremor for simple charts, ECharts for complex O&G visualizations |
| Data flow | Named datasets + component references | Data goes into top-level `data` object; components reference by name via `dataset` key. Deduplicates across components without JSON pointer complexity |
| Catalog approach | Components first, catalog second | Build standalone React components (Phase 1), then wire them into a catalog/renderer (Phase 2). Derisks — components are valuable regardless of catalog implementation |
| json-render | Evaluate later | v0.x library, API unstable. Custom catalog (~200-300 lines) for v1. Adopt json-render later if it stabilizes and adds value |
| Catalog docs | Tool description + domain plugins | Tool description has machine-readable catalog schema. Domain plugins (skills) provide role-specific dashboard recipes |
| Hosting | Railway (when remote access needed) | Persistent Node.js process for MCP HTTP transport. Local stdio for Claude Desktop. Future: Cloudflare R2 for PMTiles serving |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Desktop                         │
│                                                           │
│  User: "Show me Permian production vs LOE for Q4 2024"   │
│                                                           │
│  Claude orchestrates:                                     │
│  1. Snowflake MCP → SQL queries → result sets             │
│  2. formentera-dashboard → render-dashboard(tree + data)  │
│                                                           │
│  ┌─────────────────────┐  ┌─────────────────────────────┐ │
│  │  formentera-viz     │  │  formentera-dashboard       │ │
│  │  (existing, stays)  │  │  (new repo)                 │ │
│  │                     │  │                             │ │
│  │  visualize-production│  │  render-dashboard           │ │
│  │  show-well-map      │  │    ├─ DashboardGrid         │ │
│  │  visualize-variance │  │    ├─ Section               │ │
│  │  visualize-decline  │  │    ├─ KPICard / MetricCard  │ │
│  │  show-data-table    │  │    ├─ ProductionChart       │ │
│  │  show-los-table     │  │    ├─ VarianceWaterfall     │ │
│  │                     │  │    ├─ DeclineCurve          │ │
│  │  Vanilla JS         │  │    ├─ LOEBreakdown          │ │
│  │  ECharts / MapLibre │  │    ├─ WellTable             │ │
│  └─────────────────────┘  │    └─ LOSTable              │ │
│                           │                             │ │
│                           │  React + Tailwind + Tremor  │ │
│                           │  + shadcn/ui + ECharts      │ │
│                           └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Project Structure

```
mcp-dashboard/
├── CLAUDE.md
├── package.json
├── tsconfig.json
├── tsconfig.server.json
├── vite.config.ts
├── tailwind.config.ts          # Brand tokens from design system v0.3
├── build-views.mjs
├── server.ts                   # MCP tool + resource registration
├── main.ts                     # Entry point (stdio / HTTP)
├── src/
│   ├── components/
│   │   ├── ui/                 # shadcn/ui primitives (via CLI)
│   │   │   ├── button.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   └── ...
│   │   ├── tremor/             # Tremor components (copy-paste, restyled)
│   │   │   ├── metric-card.tsx
│   │   │   ├── bar-list.tsx
│   │   │   ├── area-chart.tsx
│   │   │   └── tab-bar.tsx
│   │   ├── charts/             # ECharts-based O&G visualizations
│   │   │   ├── ProductionChart.tsx
│   │   │   ├── VarianceWaterfall.tsx
│   │   │   ├── DeclineCurve.tsx
│   │   │   └── LOEBreakdown.tsx
│   │   ├── tables/
│   │   │   ├── WellTable.tsx
│   │   │   └── LOSTable.tsx
│   │   ├── layout/
│   │   │   ├── DashboardGrid.tsx
│   │   │   ├── Section.tsx
│   │   │   ├── KPICard.tsx
│   │   │   └── ComparisonLayout.tsx
│   │   └── index.ts            # Component registry
│   ├── catalog/                # Phase 2: catalog layer
│   │   ├── schemas.ts          # Zod schemas per component
│   │   ├── registry.ts         # type → component + schema mapping
│   │   ├── renderer.tsx        # Tree → React component mapper
│   │   └── data-context.tsx    # Named dataset resolution
│   ├── lib/
│   │   ├── chart-colors.ts     # 18-color array, bases, commodity colors
│   │   ├── format.ts           # Number/date formatting
│   │   ├── theme.ts            # Host theming (from mcp-app shared/)
│   │   ├── lifecycle.ts        # App init, fullscreen, pause/resume
│   │   ├── errors.ts           # Error display
│   │   └── utils.ts            # shadcn cn() helper
│   ├── styles/
│   │   └── globals.css         # CSS vars (shadcn + Tremor + FP brand)
│   └── dashboard-app.tsx       # Root React app
├── views/
│   └── dashboard.html          # Single view entry point
└── dist/
```

## Tool Input Schema

```typescript
interface RenderDashboardInput {
  /** Named datasets — Claude puts Snowflake query results here */
  data: Record<string, unknown[]>;

  /** The component tree — layout + visualization components */
  layout: ComponentNode;

  /** Optional dashboard-level metadata */
  title?: string;
  description?: string;
}

interface ComponentNode {
  type: string;           // Must match a catalog component name
  props?: Record<string, unknown>;
  children?: ComponentNode[];
  dataset?: string;       // Key into top-level data object
}
```

### Dataset Resolution

When a component has `dataset: "production"`:
1. Resolve `data["production"]` from the top-level input
2. Pass the array as the component's `data` prop
3. If the key doesn't exist, show an error in the component slot

### Example Tool Call

```json
{
  "data": {
    "production": [
      { "date": "2024-10", "oil_bbl": 450, "gas_mcf": 1200, "well_name": "X-1" },
      { "date": "2024-11", "oil_bbl": 430, "gas_mcf": 1150, "well_name": "X-1" }
    ],
    "loe": [
      { "category": "Workover", "amount": 245000 },
      { "category": "Chemicals", "amount": 182000 }
    ]
  },
  "layout": {
    "type": "DashboardGrid",
    "props": { "columns": 2, "title": "Permian Basin — Q4 2024" },
    "children": [
      {
        "type": "Section",
        "props": { "title": "Production" },
        "children": [
          { "type": "KPICard", "props": { "label": "Avg Oil", "value": 1250, "format": "number", "unit": "BBL/D" } },
          { "type": "ProductionChart", "dataset": "production", "props": { "streams": ["oil", "gas"] } }
        ]
      },
      {
        "type": "Section",
        "props": { "title": "Lease Operating Expenses" },
        "children": [
          { "type": "KPICard", "props": { "label": "LOE/BOE", "value": 8.42, "format": "currency" } },
          { "type": "LOEBreakdown", "dataset": "loe", "props": { "chartType": "bar", "groupBy": "category" } }
        ]
      }
    ]
  }
}
```

## Component Catalog (V1)

### Two Charting Tiers

| Tier | Library | Use case | Examples |
|------|---------|----------|----------|
| Simple | Tremor | Metric cards, bar lists, area sparklines, single-axis charts | MetricCard, BarList, MiniAreaChart |
| Complex | ECharts | Dual Y-axis, waterfall, decline curves, treemap, sunburst | ProductionChart, VarianceWaterfall, DeclineCurve, LOEBreakdown |

### Layout Components

**DashboardGrid** — CSS grid wrapper
- Props: `columns?: 1|2|3|4`, `title?: string`
- Responsive: collapses to single column on narrow viewports

**Section** — Collapsible titled group (Radix Collapsible)
- Props: `title: string`, `defaultOpen?: boolean`

**KPICard** — Single metric display
- Props: `label: string`, `value: number`, `format: 'number'|'currency'|'percent'|'boe'`, `unit?: string`, `trend?: 'up'|'down'|'flat'`, `trendValue?: number`

**ComparisonLayout** — Side-by-side panels for basin/asset comparison
- Props: children (exactly 2 expected)

### Chart Components (ECharts)

**ProductionChart** — Time-series
- Data: `[{ date, oil?, gas?, water?, boe?, well_name?, is_forecast? }]`
- Props: `streams?, mode?, showForecast?, title?`
- Features: Dual Y-axis, DataZoom, commodity colors

**VarianceWaterfall** — Waterfall chart
- Data: `[{ category, delta_boe }]`
- Props: `baseBoe?, currentBoe?, periodLabel?, title?`

**DeclineCurve** — Decline curve analysis
- Data: `[{ date, oil_bbl }]`
- Props: `wellName?, forecast?, title?`

**LOEBreakdown** — Treemap/bar/sunburst
- Data: `[{ category, line_item?, amount, entity?, field? }]`
- Props: `chartType?, groupBy?, title?`

### Chart Components (Tremor)

**MetricCard** — KPI with trend and sparkline
- Props: `label, value, unit?, change?, changeDir?, sparkline?`

**BarList** — Horizontal bar comparison
- Props: `data: [{ name, value, color? }]`, `valueFormatter?`

### Table Components

**WellTable** — TanStack Table
- Data: `Record<string, unknown>[]`
- Props: `columns, sortBy?, limit?, title?, highlightRules?`

**LOSTable** — Hierarchical financial P&L
- Data: `[{ period, category, line_item, amount }]`
- Props: `categoryOrder?, grandTotalLabel?, title?, entity?`

## Catalog Layer (Phase 2)

### Zod Schema Per Component

Each component gets a Zod schema defining valid props. These schemas are used:
1. Server-side: validate the AI-generated tree before rendering
2. Tool description: auto-generate the catalog docs for Claude's system prompt

### Component Registry

```typescript
const CATALOG = {
  DashboardGrid:     { component, schema, hasChildren: true },
  Section:           { component, schema, hasChildren: true },
  KPICard:           { component, schema, hasChildren: false },
  ProductionChart:   { component, schema, hasChildren: false },
  // ... etc
};
```

### Tree Renderer

~50 lines of React that recursively maps `ComponentNode` → React elements. Validates props against Zod schema at each node. Shows error slots for invalid/unknown components.

### json-render Migration Path

If/when json-render stabilizes:
1. Convert Zod schemas → `createCatalog()` format
2. Replace custom renderer → json-render `<Renderer>`
3. Component implementations stay unchanged

## View Lifecycle

```
HTML loads → React mounts <DashboardApp />
  → createViewApp('dashboard', ...) initializes MCP App
  → app.connect() → onhostcontextchanged → apply theme
  → ontoolinputpartial (streaming) → render completed subtrees progressively
  → ontoolinput (complete) → validate full tree → render dashboard
  → ontoolresult → finalize interactions
  → User interacts → updateModelContext with visible state
```

### Streaming

During `ontoolinputpartial`:
- Parse healed partial JSON
- Layout shells (grids, sections) render first
- Components render as their subtrees complete
- Incomplete components show loading skeleton
- KPIs render immediately (small payloads)

## Bundle Size Estimate

| Dependency | Estimated Size |
|-----------|----------------|
| React + ReactDOM | ~130 KB |
| ECharts (tree-shaken, all chart types) | ~800 KB |
| Tremor components | ~50 KB |
| TanStack Table | ~50 KB |
| Radix primitives | ~10 KB |
| Tailwind (compiled CSS) | ~20 KB |
| ext-apps SDK | ~100 KB |
| Custom code | ~50 KB |
| **Total (single-file HTML)** | **~1.2–1.5 MB** |

Well under the 3 MB constraint. No MapLibre in v1 saves ~1.5 MB.

## Brand System

Source of truth: `formentera-design-system.jsx` (docs/formentera-design-system.jsx) + `fp-brand-2026` skill.

- Font: Arial (sole typeface), JetBrains Mono for data cells/code
- 6 accent families × 4 levels (base, t1, t2, t3)
- 18-color chart order; for ≤6 series use bases only
- Commodity colors: Oil=#00B050, Gas=#FF0000, NGL=#7030A0
- Functional colors: Positive=#00B050, Negative=#C00000, Caution=#FFC000
- Tailwind config maps all brand tokens to utility classes

## Hosting

- **Development/Claude Desktop**: stdio transport, local subprocess
- **Team deployment**: Railway (~$5/mo), persistent Node.js process, HTTP transport
- **Future PMTiles**: Cloudflare R2 (near-zero egress, CDN-backed) or Railway persistent storage

## Incremental Rollout

### v0.1 — Prove the pipeline (3 components)
| Component | Type | Library |
|-----------|------|---------|
| DashboardGrid | Layout (root) | CSS grid |
| MetricCard | KPI with trend/sparkline | Tremor |
| WellTable | Sortable data table | TanStack Table |

This proves: layout rendering, Tremor integration, TanStack Table integration, dataset resolution, full end-to-end pipeline (Claude generates tree → server validates → view renders).

### v0.2 — Add charting tier
| Component | Type | Library |
|-----------|------|---------|
| Section | Collapsible layout | Radix Collapsible |
| KPICard | Simple metric | Custom |
| BarList | Horizontal bar comparison | Tremor |
| ProductionChart | Time-series (dual Y-axis) | ECharts |

### v0.3 — Full O&G catalog
| Component | Type | Library |
|-----------|------|---------|
| ComparisonLayout | Side-by-side panels | CSS grid |
| VarianceWaterfall | Waterfall chart | ECharts |
| DeclineCurve | Decline curve analysis | ECharts |
| LOEBreakdown | Treemap/bar/sunburst | ECharts |
| LOSTable | Hierarchical financial P&L | Custom |

### v1.0 — Maps + generative catalog
| Component | Type | Library |
|-----------|------|---------|
| WellMap | Interactive well map | MapLibre + PMTiles |
| Catalog migration to json-render (if stable) | | |

## What This Does NOT Include

- **Maps**: No MapLibre, no PMTiles in v1. Deferred to v2.
- **Direct data fetching**: The dashboard server is a rendering layer. All data comes from Claude via tool args.
- **Multi-turn composition**: Dashboard is generated in one tool call, not built incrementally.
- **Replacing existing tools**: `formentera-viz` stays unchanged. Operators can still use focused single-visualization tools.

## Open Questions (for implementation planning)

1. Should chart rendering logic be literally extracted from mcp-app's `src/*.ts` files and adapted to React, or rewritten as idiomatic React from scratch using the same ECharts config patterns?
2. How much of the Tremor component library do we include vs copy-paste just what we need?
3. Should the Tailwind config and brand tokens live in a shared npm package for reuse across both MCP servers?
4. What's the minimum Vite configuration needed to bundle React + Tailwind into a single-file HTML?

## Next Step

Run `/workflows:plan` to create a phased implementation plan.

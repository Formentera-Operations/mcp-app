# Formentera Operations Intelligence App — Refactor Plan

**Date**: 2026-04-07
**Status**: Draft
**Author**: Rob Stover + Claude

## Executive Summary

Refactor mcp-app into a single **Operations Intelligence Dashboard** with fixed tabs:
- **Map** — Interactive well map with filtering, PLSS grid, status markers
- **Production** — Decline curves, production surveillance, well performance
- **Financial** — LOE breakdown, variance analysis, lease operating statements
- **Leases** — Mineral ownership, expiration tracking, infill potential

**Technology**: React + MapLibre + ECharts + PMTiles

**Inspiration**: MotherDuck Anadarko Basin Explorer (user helped build)

---

## Current State

### What Works (Keep)

| Tool | Purpose | Status |
|------|---------|--------|
| `visualize-production` | Time-series chart | Working, ECharts |
| `visualize-decline` | Decline curve analysis | Working, ECharts |
| `visualize-variance` | Waterfall chart | Working, ECharts |
| `visualize-pvt` | PVT properties | Working, ECharts |
| `visualize-nodal` | IPR/VLP analysis | Working, ECharts |
| `show-well-map` | Geospatial map | Working, MapLibre |
| `show-data-table` | Sortable table | Working, vanilla JS |
| `show-los-table` | Lease Operating Statement | Working, vanilla JS |

### What Needs Work

- **13 pending todos** — Build fixes, error handling, caching (docs/todos/)
- **No tabbed interface** — Each tool is standalone
- **No data orchestration** — Tools accept data, don't query it
- **Map is basic** — No PLSS grid, no filtering, no PMTiles

---

## Target Architecture

### Single Tool: `render-ops-dashboard`

```typescript
registerAppTool(server, 'render-ops-dashboard', {
  title: 'Operations Intelligence Dashboard',
  description: 'Render a tabbed dashboard with Map, Production, Financial, and Leases views...',
  inputSchema: {
    wells: z.array(WellSchema).optional(),
    production: z.array(ProductionSchema).optional(),
    loe: z.array(LOESchema).optional(),
    leases: z.array(LeaseSchema).optional(),
    activeTab: z.enum(['map', 'production', 'financial', 'leases']).optional(),
  },
  _meta: { ui: { resourceUri: 'ui://ops-dashboard/mcp-app.html' } },
});
```

### Component Structure

```
src/
├── components/
│   ├── Dashboard.tsx          # Root component, tab state
│   ├── TabBar.tsx             # Tab navigation
│   ├── MapTab/
│   │   ├── MapTab.tsx         # Map container
│   │   ├── WellMap.tsx        # MapLibre map component
│   │   ├── WellMarker.tsx     # DOM marker component
│   │   ├── PLSSGrid.tsx       # D3 township/range overlay
│   │   └── MapFilters.tsx     # Status, basin, field filters
│   ├── ProductionTab/
│   │   ├── ProductionTab.tsx  # Production container
│   │   ├── ProductionChart.tsx   # ECharts time-series
│   │   ├── DeclineCurve.tsx      # ECharts decline analysis
│   │   ├── WellSelector.tsx      # Well multi-select
│   │   └── SurveillanceKPIs.tsx # Underperformer flags
│   ├── FinancialTab/
│   │   ├── FinancialTab.tsx    # Financial container
│   │   ├── LOEBreakdown.tsx      # ECharts treemap/bar
│   │   ├── VarianceWaterfall.tsx # ECharts waterfall
│   │   ├── LOSTable.tsx          # Financial statement
│   │   └── ScissorsChart.tsx     # LOE vs Production
│   ├── LeasesTab/
│   │   ├── LeasesTab.tsx      # Leases container
│   │   ├── LeaseTable.tsx        # Sortable table
│   │   ├── ExpirationTimeline.tsx # D3 timeline
│   │   └── OwnershipDrilldown.tsx  # Mineral ownership tree
│   └── shared/
│       ├── KPICard.tsx
│       ├── Section.tsx
│       └── LoadingState.tsx
├── lib/
│   ├── map/
│   │   ├── pmtiles-protocol.ts   # PMTiles handler
│   │   └── plss-grid.ts          # Township/range calculation
│   ├── charts/
│   │   ├── echarts-theme.ts      # FP brand theme
│   │   └── decline-math.ts       # Arps formulas
│   └── utils/
│       ├── format.ts
│       └── colors.ts
└── dashboard-app.tsx             # React root
```

---

## Map Architecture (Critical)

*"Maps are sacred in oil and gas"*

### Stack

| Layer | Technology | Why |
|-------|------------|-----|
| Renderer | **MapLibre GL JS** | Works in sandbox, already bundled |
| Tiles | **PMTiles** | Serverless, HTTP range requests, R2 hosting |
| Vector format | **MLT** (optional) | 6x better compression than MVT |
| Well markers | **DOM markers** | WebGL layers don't render in sandbox |
| PLSS grid | **Pre-baked GeoJSON** | R2-hosted, static township/range lines |
| ArcGIS layers | **GeoJSON via MCP** | Lease boundaries, pipelines, pads |
| Filtering | **Client-side** | Filter wells by status, basin, field |

### PMTiles Strategy

1. **Basemap**: Use OSM PMTiles extract for Texas/Oklahoma basins
   - Host on Cloudflare R2 (near-zero egress)
   - Or use `demo-tiles.maplibre.org` for testing
   
2. **Well data**: GeoJSON passed from tool args (not tiled)
   - PMTiles better for static basemap, not dynamic well data
   - Wells are ~1,500 points, clustering handles density

3. **PLSS grid**: Generate client-side or pre-bake as PMTiles
   - Township/range lines for Texas, Oklahoma, New Mexico
   - Could pre-generate and host on R2

### Map Features

- [ ] Well markers colored by status (Producing, Shut-in, P&A, Drilling, Completing)
- [ ] Popup with well details (name, rates, LOE/BOE)
- [ ] Filter by status, basin, field, operator
- [ ] Auto-fit bounds to filtered wells
- [ ] PLSS township/range grid overlay (pre-baked GeoJSON)
- [ ] ArcGIS layer toggles (lease boundaries, pipelines, pad sites)
- [ ] Satellite toggle (if tile source available)
- [ ] Fullscreen mode

---

## Production Tab Architecture

### Features

- [ ] Multi-well production chart (ECharts, dual Y-axis)
- [ ] Decline curve with Arps parameters
- [ ] Auto-fit decline from actual data
- [ ] Scenario comparison (P10/P50/P90)
- [ ] Underperformer flagging (actual vs forecast variance)
- [ ] Well selector with search/filter
- [ ] Date range selector (DataZoom)

### Data Flow

```
Tool args: { wells: [...], production: [...], forecasts: [...] }
    ↓
ProductionTab.tsx
    ↓
├── WellSelector (filter wells)
├── ProductionChart (stream chart)
├── DeclineCurve (scatter + line)
└── SurveillanceKPIs (flags)
```

---

## Financial Tab Architecture

### Features

- [ ] LOE breakdown by category (treemap or bar)
- [ ] Variance waterfall (month-over-month)
- [ ] Lease Operating Statement (hierarchical table)
- [ ] Scissors chart (LOE vs Production)
- [ ] Cost benchmarking (per-well comparison)
- [ ] Period selector (month, quarter, year)

### Data Flow

```
Tool args: { loe: [...], variance: [...], los: [...] }
    ↓
FinancialTab.tsx
    ↓
├── LOEBreakdown (treemap)
├── VarianceWaterfall (waterfall)
├── LOSTable (financial statement)
└── ScissorsChart (scatter)
```

---

## Leases Tab Architecture

### Features

- [ ] Lease table with sortable columns
- [ ] Expiration timeline (D3 timeline)
- [ ] Mineral ownership drill-down (tree view)
- [ ] Infill potential calculation
- [ ] Filter by expiration date, operator, basin
- [ ] Link to map (click lease → zoom on map tab)

### Data Sources

| Data | Source | Integration |
|------|--------|-------------|
| Lease records | HubSpot | Via Snowflake MCP |
| Well ownership | ODA | Via Snowflake MCP |
| Ownership history | Enverus | Via Snowflake MCP |
| Lease boundaries | ArcGIS Enterprise | Via ArcGIS MCP |

### Data Flow

```
Tool args: { leases: [...], ownership: [...], expirations: [...] }
    ↓
LeasesTab.tsx
    ↓
├── LeaseTable (TanStack Table)
├── ExpirationTimeline (D3)
└── OwnershipDrilldown (collapsible tree)
```

### Ownership Drill-down

The ownership component aggregates data from multiple sources:

```
Owner
├── Working Interest (from ODA)
├── Royalty Interest (from Enverus)
├── Contact Info (from HubSpot)
└── Well Interests (from Snowflake)
```

---

## Build & Bundle

### Vite Configuration

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [
    react(),
    vitePluginSinglefile({
      inlineDynamicImports: true,
    }),
  ],
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: undefined, // Single file
      },
    },
  },
});
```

### Bundle Size Estimate

| Dependency | Size |
|------------|------|
| React + ReactDOM | ~130 KB |
| MapLibre GL JS | ~1.5 MB |
| ECharts (tree-shaken) | ~800 KB |
| D3 (selected modules) | ~100 KB |
| TanStack Table | ~50 KB |
| Tailwind CSS | ~20 KB |
| Custom code | ~100 KB |
| **Total** | **~2.7 MB** |

This is acceptable for an MCP App (sandboxed iframe, loaded once).

---

## Migration Path

### Phase 1: React Scaffold (1-2 days)

1. Add React dependencies
2. Create `src/dashboard-app.tsx` root
3. Create `src/components/Dashboard.tsx` with tab state
4. Create `src/components/TabBar.tsx`
5. Update `vite.config.ts` for React
6. Update `build-views.mjs` to build React dashboard
7. Create `views/ops-dashboard.html` entry point
8. Register `render-ops-dashboard` tool in `server.ts`

**Deliverable**: Empty dashboard with tabs, renders in Claude Desktop

### Phase 2: Map Tab (2-3 days)

1. Create `MapTab/` components
2. Port existing `well-map.ts` logic to `WellMap.tsx`
3. Add PMTiles protocol handler
4. Add PLSS grid overlay (D3)
5. Add filter controls
6. Add fullscreen mode

**Deliverable**: Functional map tab with filtering

### Phase 3: Production Tab (2-3 days)

1. Create `ProductionTab/` components
2. Port existing `production-chart.ts` logic to `ProductionChart.tsx`
3. Port existing `decline-curve.ts` logic to `DeclineCurve.tsx`
4. Add well selector
5. Add surveillance KPIs (underperformer flags)

**Deliverable**: Functional production tab

### Phase 4: Financial Tab (2-3 days)

1. Create `FinancialTab/` components
2. Port existing `variance-waterfall.ts` logic to `VarianceWaterfall.tsx`
3. Port existing `los-table.ts` logic to `LOSTable.tsx`
4. Create `LOEBreakdown.tsx` (treemap)
5. Create `ScissorsChart.tsx`

**Deliverable**: Functional financial tab

### Phase 5: Leases Tab (1-2 days)

1. Create `LeasesTab/` components
2. Create `LeaseTable.tsx` (TanStack Table)
3. Create `ExpirationTimeline.tsx` (D3)
4. Create `OwnershipDrilldown.tsx`

**Deliverable**: Functional leases tab

### Phase 6: Polish & Testing (1-2 days)

1. Address pending todos (build, error handling, caching)
2. Add loading states
3. Add error boundaries
4. Test in Claude Desktop
5. Test in basic-host
6. Update CLAUDE.md

---

## Resolved Questions

1. **PMTiles hosting**: Cloudflare R2
2. **PLSS grid**: Pre-bake GeoJSON for TX/OK/NM
3. **ArcGIS layers**: Use existing ArcGIS MCP for lease boundaries, pipelines, pad sites
4. **Ownership data**: HubSpot + ODA + Enverus (all 3)

## ArcGIS Integration

The map tab integrates with the existing ArcGIS MCP (`arcgis-mcp`):

```
User toggles "Lease Boundaries" layer
    ↓
Dashboard calls app.callServerTool('arcgis_query_features', {...})
    ↓
ArcGIS MCP returns GeoJSON
    ↓
MapLibre renders as GeoJSON source/layer
```

### Available ArcGIS Layers

| Layer | Source | Use |
|-------|--------|-----|
| Lease boundaries | ArcGIS Enterprise | Map overlay |
| Pipelines | ArcGIS Enterprise | Map overlay |
| Pad sites | ArcGIS Enterprise | Map overlay |
| Permits | ArcGIS Enterprise | Map overlay |

### Map Layer UI

```
MapFilters.tsx
├── Well filters (status, basin, field)
├── Layer toggles (checkboxes)
│   ├── ☐ Lease boundaries
│   ├── ☐ Pipelines
│   ├── ☐ Pad sites
│   └── ☐ PLSS grid
└── Basemap selector (satellite / streets)
```

### Layer Loading Strategy

1. **Wells**: Passed via tool args (from Snowflake)
2. **ArcGIS layers**: Loaded on-demand when toggled
3. **PLSS grid**: Pre-loaded from R2-hosted GeoJSON
4. **Basemap tiles**: PMTiles from R2

---

## Success Criteria

- [ ] Single tool renders tabbed dashboard
- [ ] Map tab shows wells with filtering and PLSS grid
- [ ] Production tab shows decline curves and surveillance
- [ ] Financial tab shows LOE breakdown and LOS
- [ ] Leases tab shows expiration tracking
- [ ] All tabs share data from single tool call
- [ ] Bundle size < 3MB
- [ ] Works in Claude Desktop sandbox

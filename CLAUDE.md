# CLAUDE.md — Formentera MCP App Server

## What this is

A companion MCP server that provides interactive visualization tools (charts, maps, dashboards) for Formentera Operations data. It renders rich HTML UIs inline in Claude conversations using the [MCP Apps extension](https://modelcontextprotocol.io/extensions/apps/overview).

This server does NOT query data itself. It accepts structured data (typically from the Snowlake MCP (sql_exec_tool) or the Whitson MCP) and renders it. Claude orchestrates between the data MCP and this viz MCP.

Repo: https://github.com/Formentera-Operations/mcp-app.git

## Architecture

- **Runtime**: Node.js + TypeScript
- **Transport**: stdio (Claude Desktop, Claude Code) or HTTP (testing with basic-host)
- **MCP SDK**: `@modelcontextprotocol/sdk` + `@modelcontextprotocol/ext-apps`
- **Build**: Vite + `vite-plugin-singlefile` bundles each view into a single self-contained HTML file
- **Pattern**: Each tool registers with `registerAppTool` + `registerAppResource`, linked by a `ui://` resource URI
- **Frontend**: Vanilla JS for the single-purpose views -- ECharts and MapLibre are imperative APIs; a framework adds overhead with zero benefit. Exception: the tabbed ops dashboard (`src/dashboard-app.tsx` + `src/components/`) uses React 19

## Library choices (DO NOT CHANGE without discussion)

| Purpose | Library | Why |
|---------|---------|-----|
| Charts (all) | **Apache ECharts** | Canvas renderer handles 100K+ points, declarative config, dual Y-axis native, DataZoom built-in, ~400KB tree-shaken. NOT Plotly (3MB, WebGL context limits). NOT D3 (too low-level). NOT Chart.js (no dual axis, limited). |
| Maps | **MapLibre GL JS** | Open-source, bundled via npm (~1.5MB in single-file output), DOM-based markers for sandbox compatibility. NOT CesiumJS (3D globe overkill). NOT Leaflet (raster-only). |
| Map tiles | **OSM raster tiles** (`tile.openstreetmap.org`) | Inline style with raster source — no remote style JSON fetch needed. Gray background fallback if tiles blocked by CSP. |
| Bundling | **vite-plugin-singlefile** | Inlines all JS/CSS into one HTML file so the MCP resource is a single string. MapLibre bundled via npm (not CDN — CDN blocked in sandbox). |

## Brand system

All views MUST use the official Formentera Partners brand.

**Source of truth: `src/shared/colors.ts` + `src/shared/theme.ts` — import, never re-declare.** This covers the brand color constants, `FP_CHART_COLORS` / `FP_CHART_COLORS_BASE`, the per-domain color maps (commodity, status, functional, PVT, scenarios), and the brand ECharts theme object.

The tables below are domain facts (what each color MEANS), kept here so chart semantics are reviewable without reading code. The hex values themselves live in `src/shared/colors.ts`.

### Commodity colors (override chart order when showing oil/gas/NGL/water)

| Stream | Hex | Note |
|--------|-----|------|
| Oil | `#00B050` | Brand Positive Green -- industry standard for oil |
| Gas | `#FF0000` | Brand standard red for gas |
| NGL | `#7030A0` | Brand standard purple for NGL |
| Water | `#336699` | Steel -- blue family, consistent with industry convention |
| BOE | `#FFC000` | Caution Yellow -- amber, used only as aggregate indicator |
| Forecast | `#553D8C` | Brand Purple, dashed lines |

### Chart color order (multi-series / non-commodity charts)

When the chart is NOT distinguishing commodity streams (e.g., multi-well comparison, LOE categories, entity breakdown), use `FP_CHART_COLORS` from `src/shared/colors.ts` (18 colors, 6 brand families x 3 shades). For <=6 series, use `FP_CHART_COLORS_BASE` (the 6 base family colors).

### Well status colors (mapped to brand palette)

| Status | Color | Hex |
|--------|-------|-----|
| Producing | Green | `#6AAD4E` |
| Shut-in | Caution | `#FFC000` |
| P&A | Gray | `#7F7F7F` |
| Drilling | Steel | `#336699` |
| Completing | Purple | `#553D8C` |

### Variance waterfall colors

| Type | Hex | Brand reference |
|------|-----|-----------------|
| Positive delta | `#00B050` | Functional Positive |
| Negative delta | `#C00000` | Functional Negative |
| Total bars | `#001F45` | Navy |

### Typography in views

- Font: Arial (with Helvetica Neue, Helvetica fallbacks)
- KPI / title text: Bold, Navy (#001F45)
- Subtitle / secondary: Steel (#336699)
- Axis labels / chart labels: 12px, Gray (#7F7F7F)
- Chart gridlines: Light Gray (#E6E6E6)
- Chart plot background: White (#FFFFFF)
- Table headers: Navy background, white bold text
- Alternating table rows: White / Off-white (#F2F2F2)

### ECharts theme object

The brand ECharts theme is registered by `src/shared/theme.ts` — import it, never re-declare a theme object in a view.

## View behavior (all tools)

Every view MUST implement these baseline behaviors:

### Host theming
Respond to `onhostcontextchanged` from the first render. Apply host CSS variables for UI chrome (buttons, borders), but the Formentera brand colors take precedence for chart/data elements. The host theme controls light/dark mode for the surrounding UI; brand colors are fixed.
```
app.onhostcontextchanged = (ctx) => {
  applyDocumentTheme(ctx.theme);
  applyHostStyleVariables(ctx.styles?.variables);
  applyHostFonts(ctx.styles?.css?.fonts);
  applySafeAreaInsets(ctx.safeAreaInsets);
};
```

### Streaming partial input
Use `ontoolinputpartial` so charts render progressively as Claude generates large JSON. The healed partial JSON is always valid -- just re-render on each chunk. Users see the chart build in real-time.

### Fullscreen mode
Every view must include a fullscreen toggle button. Use `app.requestDisplayMode("fullscreen")`. Remove border-radius in fullscreen state. Check `ctx.availableDisplayModes` before showing the button.

### Visibility-based pause
Use `IntersectionObserver` to pause ECharts animations when scrolled out of view. For the map, call `map.resize()` on resume.

### Text fallback
Every tool MUST return a `content` array with a text summary alongside `structuredContent`. Non-UI hosts (terminals, basic MCP clients) should still get useful output, e.g., "Production chart: 3 wells, Jan-Dec 2024, peak oil 450 BBL/D".

### Error handling
Validate incoming data in each view. If data is malformed (wrong field names, nulls, empty arrays), show a clear error message inside the iframe -- never a blank screen. Use `app.sendLog({ level: "error", data })` for debugging.

### Safe area insets
Always apply `ctx.safeAreaInsets` as body padding to prevent content clipping on hosts with non-zero insets.

### updateModelContext
When the user interacts with a view (zooms to a date range, clicks a well, applies a filter), call `app.updateModelContext()` to inform Claude of the current view state. This way the user's next question gets answered in context without restating what they're looking at.

## Tools

Nine tools, each backed by a `ui://<view>/mcp-app.html` resource (one per `views/*.html` file).

Input schemas live in server.ts — read the registerAppTool block before changing any input contract.

| Tool | Purpose | Special notes |
|------|---------|---------------|
| `visualize-production` | Time-series production chart: dual Y-axis (BBL/D / MCF/D), DataZoom, log scale, KPI strip, forecast overlay, multi-well aggregation, cumulative + stacked modes | Commodity colors; multi-well single-stream uses `FP_CHART_COLORS`. On DataZoom change, `updateModelContext` reports visible date range + wells |
| `visualize-variance` | Waterfall of BOE variance components (invisible-base 3-series stacked bar), sorted by magnitude, KPI delta strip | Functional colors: positive / negative deltas, Navy totals |
| `show-data-table` | Sortable, filterable data table with conditional formatting and sticky headers | Sorting/filtering disabled until streamed data finalizes |
| `show-los-table` | Lease Operating Statement: auto-groups flat GL rows by category/line_item, computes subtotals + NOI, collapsible categories | Sign conventions: raw GL signs in, revenue/income flipped positive for display. Legacy nested `sections` format also supported |
| `visualize-decline` | Decline curve analysis: Arps (exp/hyp/harmonic), auto-fit, P10/P50/P90 scenarios + confidence band, type curve overlay, per-scenario EUR | Whitson mappings: `whitson_dca.get_saved_cases_bulk` (scenarios), `whitson_dca.get_monthly_rates` (pre-computed rates), `whitson_type_wells.get_saved_cases` (type curve) |
| `visualize-pvt` | PVT property curves vs pressure: auto-detects populated properties, bubble point marker, dual Y-axis | Whitson mappings: `whitson_pvt.get_calcs`, `whitson_pvt.get_bot_table`. Uses `PVT_PROPERTY_COLORS` |
| `visualize-nodal` | Nodal analysis: IPR + multiple VLP curves, operating point markers, reservoir pressure line | Whitson mappings: `whitson_nodal_vlp.get_ipr`, `whitson_nodal_vlp.get_vlp_cases` + `run_vlp`. Computes VLP/IPR intersection client-side if `operating_point` not provided |
| `show-well-map` | Geospatial well map: status-colored markers, popups, auto-fit bounds | Only tool with a CSP exception (see below); all MapLibre sandbox workarounds apply |
| `render-ops-dashboard` | Tabbed operations dashboard: Map / Production / Financial (LOE) / Leases tabs; all datasets optional; `activeTab` picks initial tab | React-based (`src/dashboard-app.tsx` + `src/components/`), unlike the vanilla-JS views |

### CSP exceptions

- `show-well-map` declares `_meta.ui.csp: { connectDomains: ["https://tile.openstreetmap.org", "https://tiles.openfreemap.org", "https://demotiles.maplibre.org"] }` for raster tiles.
- All other tools (including `render-ops-dashboard`) declare no CSP — their views are fully bundled.

### Map sandbox workarounds (well map + dashboard Map tab)

- DOM-based `maplibregl.Marker` elements, NOT WebGL layers — the sandbox blocks WebGL rendering.
- Popups built via `setDOMContent` (XSS-safe).
- MapLibre GL JS bundled via npm import (CDN script tags blocked in sandbox); inline `StyleSpecification` with OSM raster tiles (remote style JSON fetch also blocked).
- Streaming: `ontoolinputpartial` renders wells incrementally; `fitBounds` skipped during streaming to prevent jank; map init gated behind `map.on('load')`.

## Project structure

Key locations (not exhaustive — `ls` for the rest):

- `server.ts` — tool + resource registration (all 9 tools); `main.ts` — entry point (stdio / HTTP)
- `build-views.mjs` — builds every `views/*.html` via Vite + vite-plugin-singlefile; `dist/` is gitignored build output
- `tsconfig.json` (IDE / noEmit) vs `tsconfig.server.json` (NodeNext server compilation)
- `src/shared/` — cross-view modules: `colors.ts` (all brand color constants), `theme.ts` (host theming + FP brand ECharts theme registration), `lifecycle.ts` (App init, IntersectionObserver, fullscreen), `format.ts`, `security.ts` (escapeHtml), `decline-math.ts` (Arps), `reservoir-math.ts` (VLP/IPR intersection)
- `src/<view>.ts` — one vanilla-JS UI module per view: production-chart, well-map, variance-waterfall, decline-curve, data-table, los-table, pvt-chart, nodal-chart
- `src/dashboard-app.tsx` + `src/components/` — React ops dashboard (Dashboard, TabBar, MapTab, ProductionTab, FinancialTab, LeasesTab)
- `views/` — one HTML shell per view (the eight above plus `ops-dashboard.html`)

## Build & run

```bash
npm install
npm run build          # Vite bundles views -> dist/, tsc compiles server
npm run serve:stdio    # Run with stdio transport
npm run serve          # Run with HTTP on :3001
npm run dev            # Hot-reload (views watch + tsx watch)
```

## Claude Desktop config

```json
{
  "mcpServers": {
    "formentera-viz": {
      "command": "bash",
      "args": [
        "-c",
        "cd /Users/robstover/Development/formentera/mcp-app && npm run build >&2 && npx tsx main.ts --stdio"
      ]
    }
  }
}
```

## Claude Desktop sandbox constraints

Claude Desktop renders MCP App HTML in a sandboxed iframe. Key constraints discovered through testing:

1. **CDN script/link tags are blocked** — All JS/CSS must be bundled into the single HTML file via `vite-plugin-singlefile`. MapLibre (~1.5MB) is bundled via npm import.
2. **Remote style JSON fetches fail** — MapLibre's default `style: "https://..."` URL is blocked. Use an inline `StyleSpecification` object instead.
3. **WebGL `addSource`/`addLayer` don't render** — Circle layers and other WebGL-rendered features are invisible. Use DOM-based `maplibregl.Marker` with custom HTML elements.
4. **Raster tile loading may be blocked** — OSM tiles (`tile.openstreetmap.org`) are configured in `connectDomains` CSP but may still fail. Gray background fallback ensures wells are visible regardless.
5. **Build output must go to stderr** — The stdio transport uses stdout for MCP protocol. Redirect build output with `>&2`.

## Testing

Use the ext-apps basic-host for visual testing without Claude:

```bash
git clone https://github.com/modelcontextprotocol/ext-apps.git /tmp/ext-apps
cd /tmp/ext-apps/examples/basic-host
npm install
SERVERS='["http://localhost:3001/mcp"]' npm run start
# Open http://localhost:8080
```

## Data flow

```
User asks question
    |
Claude calls Snowflake MCP (sql_exec_tool) -> gets JSON data
    |
Claude calls this server (visualize-production) -> passes JSON as tool args
    |
    +-- ontoolinputpartial fires as Claude generates -> chart renders progressively
    |
Host renders sandboxed iframe with bundled HTML
    |
UI receives data via app.ontoolresult -> renders ECharts / MapLibre
    |
User interacts (zoom, filter, click well)
    |
    +-- updateModelContext -> tells Claude what user is viewing
    +-- sendMessage (stretch) -> triggers Claude to take action
    |
User asks follow-up -> Claude has context from updateModelContext, responds intelligently
```

## Phase 2 (future)

- **App-only tools**: Register tools with `visibility: ["app"]` that the UI calls via `app.callServerTool()` for drill-down queries without LLM in the loop
- **Direct Snowflake connection**: Add `snowflake-sdk` to this server so the UI can fetch data directly (e.g., user clicks a well on the map -> UI fetches that well's production)
- **Financial dashboard tool**: ECharts treemap (LOE breakdown), bar+line combo (revenue vs cost), sunburst (entity hierarchy)
- **Single-well dashboard**: Composite view with production chart + pressure/temp series + ribbon timeline + KPIs in one MCP App

## Formentera context

- Basins: Permian, Eagle Ford, SCOOP/STACK, Williston
- Key systems: ProdView, Quorum OnDemand, Enverus, WellDrive, Snowflake (FORMENTERA-DATAHUB)
- O&G domain terms the tools handle: BOE (barrel of oil equivalent, gas/6), LOE (lease operating expense), NRI, working interest, decline curves, type curves, variance categories (downtime, decline, new wells, workovers)
- Well count: ~1,550 boxes of well files across Dallas, Midland, Austin -- DOM-based `maplibregl.Marker` elements work well at this scale (WebGL circle layers don't render in Claude Desktop's sandbox iframe)

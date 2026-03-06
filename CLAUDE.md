# CLAUDE.md — Formentera MCP App Server

## What this is

A companion MCP server that provides interactive visualization tools (charts, maps, dashboards) for Formentera Operations data. It renders rich HTML UIs inline in Claude conversations using the [MCP Apps extension](https://modelcontextprotocol.io/extensions/apps/overview).

This server does NOT query data itself. It accepts structured data (typically from the Snowflake MCP or Wise Rock MCP) and renders it. Claude orchestrates between the data MCP and this viz MCP.

Repo: https://github.com/Formentera-Operations/mcp-app.git

## Architecture

- **Runtime**: Node.js + TypeScript
- **Transport**: stdio (Claude Desktop, Claude Code) or HTTP (testing with basic-host)
- **MCP SDK**: `@modelcontextprotocol/sdk` + `@modelcontextprotocol/ext-apps`
- **Build**: Vite + `vite-plugin-singlefile` bundles each view into a single self-contained HTML file
- **Pattern**: Each tool registers with `registerAppTool` + `registerAppResource`, linked by a `ui://` resource URI
- **Frontend**: Vanilla JS (no React) -- ECharts and MapLibre are imperative APIs; a framework adds overhead with zero benefit

## Library choices (DO NOT CHANGE without discussion)

| Purpose | Library | Why |
|---------|---------|-----|
| Charts (all) | **Apache ECharts** | Canvas renderer handles 100K+ points, declarative config, dual Y-axis native, DataZoom built-in, ~400KB tree-shaken. NOT Plotly (3MB, WebGL context limits). NOT D3 (too low-level). NOT Chart.js (no dual axis, limited). |
| Maps | **MapLibre GL JS** | Open-source, bundled via npm (~1.5MB in single-file output), DOM-based markers for sandbox compatibility. NOT CesiumJS (3D globe overkill). NOT Leaflet (raster-only). |
| Map tiles | **OSM raster tiles** (`tile.openstreetmap.org`) | Inline style with raster source — no remote style JSON fetch needed. Gray background fallback if tiles blocked by CSP. |
| Bundling | **vite-plugin-singlefile** | Inlines all JS/CSS into one HTML file so the MCP resource is a single string. MapLibre bundled via npm (not CDN — CDN blocked in sandbox). |

## Brand system (from fp-brand-2026)

All views MUST use the official Formentera Partners brand. Source of truth: `fp-brand-2026.skill`.

### CSS custom properties (define in every view)

```css
:root {
  /* Theme accent colors */
  --fp-navy: #001F45;
  --fp-dark-slate: #3D4F5F;
  --fp-teal: #3D8B7A;
  --fp-purple: #553D8C;
  --fp-crimson: #A3192B;
  --fp-green: #6AAD4E;
  --fp-steel: #336699;

  /* Neutrals */
  --fp-black: #000000;
  --fp-white: #FFFFFF;
  --fp-light-gray: #E6E6E6;
  --fp-gray: #7F7F7F;
  --fp-off-white: #F2F2F2;

  /* Functional (indicators only -- never decorative) */
  --fp-positive: #00B050;
  --fp-negative: #C00000;
  --fp-caution: #FFC000;

  /* Typography */
  --fp-font: 'Arial', 'Helvetica Neue', Helvetica, sans-serif;
}
```

### Commodity colors (override chart order when showing oil/gas/NGL/water)

| Stream | Hex | Note |
|--------|-----|------|
| Oil | `#00B050` | Brand Positive Green -- industry standard for oil |
| Gas | `#FF0000` | Brand standard red for gas |
| NGL | `#7030A0` | Brand standard purple for NGL |
| Water | `#336699` | Steel -- blue family, consistent with industry convention |
| BOE | `#FFC000` | Caution Yellow -- amber, used only as aggregate indicator |
| Forecast | `#553D8C` | Brand Purple, dashed lines |

### Chart color order (1-18, for multi-series / non-commodity charts)

Use this when the chart is NOT distinguishing commodity streams (e.g., multi-well comparison, LOE categories, entity breakdown):

```javascript
const FP_CHART_COLORS = [
  '#001F45', '#336699', '#94C1FA',  // Navy family
  '#3D4F5F', '#6B818C', '#A3B4BC',  // Slate family
  '#3D8B7A', '#8EBBB3', '#B6D3CE',  // Teal family
  '#553D8C', '#978CB5', '#BCB5CF',  // Purple family
  '#A3192B', '#BF5E6B', '#D698A0',  // Crimson family
  '#6AAD4E', '#93C87A', '#B9DEA5',  // Green family
];
```

For <=6 series, use base colors only: positions 1, 4, 7, 10, 13, 16.

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

Register a custom ECharts theme that matches the brand:

```javascript
const FP_ECHARTS_THEME = {
  color: FP_CHART_COLORS,
  backgroundColor: '#FFFFFF',
  textStyle: { fontFamily: 'Arial, Helvetica Neue, Helvetica, sans-serif', color: '#001F45' },
  title: { textStyle: { color: '#001F45', fontWeight: 'bold' }, subtextStyle: { color: '#336699' } },
  legend: { textStyle: { color: '#7F7F7F', fontSize: 12 } },
  categoryAxis: { axisLine: { lineStyle: { color: '#E6E6E6' } }, axisLabel: { color: '#7F7F7F' }, splitLine: { lineStyle: { color: '#E6E6E6' } } },
  valueAxis: { axisLine: { lineStyle: { color: '#E6E6E6' } }, axisLabel: { color: '#7F7F7F' }, splitLine: { lineStyle: { color: '#E6E6E6' } } },
  dataZoom: { backgroundColor: '#F2F2F2', fillerColor: 'rgba(0,31,69,0.1)', handleColor: '#336699' },
};
```

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

### 1. `visualize-production` -- Time-series production chart
- **Resource**: `ui://production-chart/mcp-app.html`
- **Input**: JSON array of `{ date, oil_bbl, gas_mcf, water_bbl, well_name, ?boe, ?is_forecast }`
- **Features**: Dual Y-axis (BBL/D left, MCF/D right), DataZoom slider, log scale toggle, stream visibility toggles, KPI strip, forecast overlay (dashed), multi-well aggregation, cumulative mode, stacked area mode
- **Colors**: Uses commodity colors (Oil=#00B050, Gas=#FF0000, Water=#336699, BOE=#FFC000). For multi-well single-stream, uses FP_CHART_COLORS order
- **Streaming**: `ontoolinputpartial` renders chart incrementally as rows arrive
- **Context**: On DataZoom change, `updateModelContext` with visible date range and well names
- **CSP**: None needed (fully bundled)

### 2. `show-well-map` -- Geospatial well map
- **Resource**: `ui://well-map/mcp-app.html`
- **Input**: `{ data: [{ well_name, lat, lng, ?status, ?oil_rate, ?gas_rate, ?water_rate, ?loe_per_boe, ?field, ?basin }] }`
- **Features**: DOM-based `maplibregl.Marker` elements (not WebGL layers — sandbox blocks WebGL rendering), popups with well detail via `setDOMContent` (XSS-safe), auto-fit bounds, navigation controls, status-colored markers
- **Colors**: Status uses well status color map. Fallback: gray for unknown status
- **Streaming**: `ontoolinputpartial` renders wells incrementally (fitBounds skipped during streaming to prevent jank); map init gated behind `map.on('load')`
- **CSP**: `_meta.ui.csp: { connectDomains: ["https://tile.openstreetmap.org", "https://tiles.openfreemap.org", "https://demotiles.maplibre.org"] }`
- **Bundling**: MapLibre GL JS bundled via npm import (CDN script tags blocked in sandbox). Inline `StyleSpecification` with OSM raster tiles (remote style JSON fetch also blocked).

### 3. `visualize-variance` -- Waterfall chart
- **Resource**: `ui://variance-waterfall/mcp-app.html`
- **Input**: `{ base_boe, current_boe, period_label, components: [{ category, delta_boe }] }`
- **Features**: 3-series stacked bar waterfall (invisible base + positive + negative), sorted by absolute magnitude, signed labels, KPI strip with delta
- **Colors**: Positive=#00B050, Negative=#C00000, Totals=#001F45 (brand functional colors)
- **Streaming**: `ontoolinputpartial` renders chart incrementally
- **CSP**: None needed (fully bundled)

### 4. `visualize-decline` -- Decline curve analysis
- **Resource**: `ui://decline-curve/mcp-app.html`
- **Input**: `{ well_name, actual: [{ date, oil_bbl }], ?forecast: { method, ip, di, b, months } | { fit: true, months } }`
- **Features**: Scatter (actual) + Arps decline line (exponential/hyperbolic/harmonic), auto-fit mode computes exponential params client-side, EUR estimate in KPIs, log Y-axis default, DataZoom slider
- **Colors**: Actual=Navy scatter, Forecast=Purple dashed line
- **CSP**: None needed (fully bundled)

### 5. `show-data-table` -- Sortable data table
- **Resource**: `ui://data-table/mcp-app.html`
- **Input**: `{ title, columns: [{ key, label, type: "string"|"number"|"currency"|"date"|"percent" }], rows: [{}], ?sort_by, ?highlight_rules: [{ column, condition, color, ?threshold }] }`
- **Features**: Column sorting, text filter, conditional formatting (positive/negative/gt/lt), sticky headers, number formatting
- **Colors**: Header=Navy bg/white text, rows=alternating white/#F2F2F2, positive=#00B050, negative=#C00000
- **Streaming**: `ontoolinputpartial` renders rows progressively; sorting/filtering disabled until data finalized
- **CSP**: None needed (fully bundled)

### 6. `show-los-table` -- Lease Operating Statement
- **Resource**: `ui://los-table/mcp-app.html`
- **Input**: `{ title, ?entity, periods: string[], sections: [{ category, subtotal, items: [{ label, values }] }], ?grand_total }`
- **Features**: Hierarchical financial statement with collapsible category rows, monthly columns + computed total column, subtotal rows, grand total (net operating income) row, negative values in red
- **Colors**: Category rows=Off-white, subtotals=Navy top-border, grand total=Navy bg/white text, negatives=#C00000
- **CSP**: None needed (fully bundled)

## Project structure

```
mcp-app/
├── CLAUDE.md              <- You are here
├── package.json
├── tsconfig.json           <- IDE / type-checking (noEmit)
├── tsconfig.server.json    <- Server compilation (NodeNext)
├── vite.config.ts          <- Fallback single-view config
├── build-views.mjs         <- Builds all view HTML files via Vite
├── server.ts               <- Tool + resource registration
├── main.ts                 <- Entry point (stdio / HTTP)
├── src/
│   ├── shared/
│   │   ├── theme.ts        <- Host theming + FP brand ECharts theme registration
│   │   ├── colors.ts       <- All brand color constants (FP_CHART_COLORS, commodity, status, functional)
│   │   ├── lifecycle.ts    <- Common App init, IntersectionObserver, fullscreen
│   │   ├── format.ts       <- Number/date formatting (commas, BBL/D, MCF/D)
│   │   ├── security.ts     <- escapeHtml utility (XSS prevention)
│   │   └── decline-math.ts <- Arps decline curve formulas + auto-fit
│   ├── production-chart.ts <- ECharts production UI logic
│   ├── well-map.ts         <- MapLibre well map UI logic
│   ├── variance-waterfall.ts <- ECharts waterfall UI logic
│   ├── decline-curve.ts    <- ECharts decline curve UI logic
│   ├── data-table.ts       <- Sortable data table UI logic
│   └── los-table.ts        <- Hierarchical LOS financial table UI logic
├── views/
│   ├── production-chart.html
│   ├── well-map.html
│   ├── variance-waterfall.html
│   ├── decline-curve.html
│   ├── data-table.html
│   └── los-table.html
└── dist/                   <- Built output (gitignored)
```

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

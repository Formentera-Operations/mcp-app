---
title: "feat: Build remaining visualization tools (map, waterfall, decline, table, LOS)"
type: feat
date: 2026-03-06
deepened: 2026-03-06
---

# Build Remaining Visualization Tools

## Enhancement Summary

**Deepened on:** 2026-03-06
**Research agents used:** 12 (Architecture Strategist, Performance Oracle, Security Sentinel, Pattern Recognition, Kieran TypeScript Reviewer, Agent-Native Reviewer, Frontend Races Reviewer, Best Practices Researcher, Framework Docs Researcher, Tufte Data Visualization, MCP App Patterns, Code Simplicity Reviewer)

### Key Improvements from Research

1. **Well map must use circle/symbol layers** (not HTML markers) -- HTML markers cause jank at 1,550 wells; symbol layers render on GPU
2. **CSP configuration fixed** -- fields must nest under `_meta.ui.csp` with protocol prefixes (`https://unpkg.com`)
3. **Arps decline math needs edge-case handling** -- extract to `src/shared/decline-math.ts` with guards for b=0 (NaN), negative time, zero denominators
4. **Colorblind accessibility** -- Gas red (#FF0000) + Oil green (#00B050) fails for 8% of males; gas should use orange (#E66100)
5. **XSS prevention** -- add `escapeHtml()` utility; use `setDOMContent()` not `setHTML()` for MapLibre popups; escape ECharts tooltip formatters
6. **YAGNI cuts** -- drop type curve overlay, reduce map to status-only coloring, collapse LOS filter sidebar to summary line, skip CSV export, simplify conditional formatting
7. **Streaming + interaction races** -- gate MapLibre behind `map.on('load')`; separate collapse/sort state from streaming re-renders; add fullscreen transition guard
8. **Decline curve auto-fit mode** -- Claude can't reliably generate Arps params; offer `{ fit: true, months }` alternative to explicit parameters
9. **Wire `onteardown`** -- currently a no-op; must call `chart.dispose()` / `map.remove()` to prevent memory leaks
10. **Missing ECharts theme registration** -- new chart tools must call `echarts.registerTheme('formentera', FP_ECHARTS_THEME)`

### Scope Reductions (YAGNI)

| Cut | LOC Saved | Rationale |
|-----|-----------|-----------|
| Type curve P10/P50/P90 overlay (decline) | ~80 | Different analytical question; different Snowflake query |
| 4 extra map color modes | ~150-200 | Status covers primary use case; add modes when requested |
| LOS filter sidebar -> summary line | ~60-80 | 8 read-only labels don't warrant a sidebar layout |
| CSV export (data table) | ~40-50 | Claude can generate CSV natively from the same data |
| `above`/`below` conditional formatting | ~20 | `positive`/`negative` covers financial variance display |
| LOS streaming handler | ~20 | Pre-aggregated financial statement arrives complete |
| Waterfall `updateModelContext` | ~15 | Static chart with no meaningful interaction |
| **Total** | **~410-490** | ~15-18% reduction from estimated ~3,000 LOC |

---

## Overview

Build 5 MCP App tools to complete the Formentera viz server: well map (MapLibre), variance waterfall (ECharts), decline curve (ECharts), generic data table (DOM), and LOS financial statement table (DOM). Each follows the proven pattern from the production chart.

## Problem Statement

The mcp-app server currently has one working tool (`visualize-production`). The CLAUDE.md spec defines 4 more tools, and Formentera's finance/operations team needs an LOS (Lease Operating Statement) table that matches their standard Net Field LOS reporting format -- hierarchical rows, monthly columns, collapsible sections, and Formentera branding.

## Proposed Solution

Build each tool following the established 3-file pattern:
1. `views/<name>.html` -- HTML shell with CSS custom properties, loading/error states, fullscreen button
2. `src/<name>.ts` -- View logic with type guards, state, rendering, toolbar wiring, `createViewApp` initialization
3. Registration block in `server.ts` -- `registerAppTool` + `registerAppResource` pair

### Implementation Order

| Phase | Tool | Library | Complexity | Why This Order |
|-------|------|---------|-----------|----------------|
| 1 | `visualize-variance` | ECharts (BarChart) | Low | Simplest ECharts view, validates the pattern |
| 2 | `show-data-table` | DOM | Medium | Foundation for LOS table, broadly useful |
| 3 | `show-los-table` | DOM | Medium-High | Extends table patterns, high business value |
| 4 | `visualize-decline` | ECharts (Scatter+Line) | Medium | Arps math, domain-specific rendering |
| 5 | `show-well-map` | MapLibre (CDN) | Medium-High | Only external dependency (CDN + CSP), saved for last |

---

## Phase 1: `visualize-variance` -- Variance Waterfall Chart

### Files

- Create: `views/variance-waterfall.html`
- Create: `src/variance-waterfall.ts`
- Modify: `server.ts` (add tool + resource registration)

### Input Schema

```typescript
{
  base_boe: z.number().describe('Starting BOE value'),
  current_boe: z.number().describe('Ending BOE value'),
  period_label: z.string().describe('Period description, e.g. "Jan 2025 vs Dec 2024"'),
  components: z.array(z.object({
    category: z.string().describe('Variance category name'),
    delta_boe: z.number().describe('Signed change in BOE'),
  })).describe('Variance components (positive = increase, negative = decrease)'),
}
```

### Resource URI

`ui://variance-waterfall/mcp-app.html`

### ECharts Components Needed

```typescript
import { BarChart } from 'echarts/charts';
import type { BarSeriesOption } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
```

### Rendering Approach

ECharts **stacked bar** waterfall pattern:
- 3 series stacked: `invisible` (transparent base), `positive` (green), `negative` (red)
- First bar = `base_boe` (total, navy)
- Middle bars = cumulative waterfall (invisible base + colored delta)
- Last bar = `current_boe` (total, navy)
- Value labels on each bar showing signed delta

### Colors

- Positive delta: `FP_POSITIVE` (#00B050)
- Negative delta: `FP_NEGATIVE` (#C00000)
- Total bars (base + current): `FP_NAVY` (#001F45)

### Text Fallback

```
"Variance waterfall: 450 BOE/D -> 380 BOE/D (-70), 6 components. Largest: Downtime -45 BOE/D"
```

### Research Insights

**ECharts Waterfall Pattern (Best Practices):**
- The 3-series stacked approach (invisible + positive + negative) is the standard ECharts waterfall pattern -- confirmed as correct
- **Order bars by magnitude** (largest positive to largest negative, with totals bookending) rather than alphabetically -- alphabetical ordering destroys the visual narrative
- Conditional label display: show value labels when bar count <= 12; beyond that, rely on tooltip hover to prevent label collision

**Theme Registration (Pattern Recognition):**
- Must call `echarts.registerTheme('formentera', FP_ECHARTS_THEME)` and use `echarts.init(container, 'formentera')` -- missing from original plan
- If the option object does not include a `legend` key, `LegendComponent` can be omitted (verify during implementation)
- If period label is rendered as ECharts `option.title`, add `TitleComponent` to imports; otherwise render as DOM element above chart

**Streaming (Frontend Races):**
- The RAF debounce in `createViewApp` is sufficient for waterfall -- each partial re-render is sub-millisecond with 5-15 bars
- No race conditions expected for this simple chart

**Simplification (YAGNI):**
- Skip `updateModelContext` -- waterfall is a static chart with no meaningful interaction state to report
- No toolbar needed (no toggle states)

**Security:**
- Escape category labels in tooltip formatters -- data flows from Snowflake through Claude; treat as untrusted
- Use ECharts `textStyle` configuration instead of custom HTML formatters where possible

### Acceptance Criteria

- [ ] Waterfall renders with correct cumulative invisible bases
- [ ] Bars ordered by magnitude (largest positive first, largest negative last)
- [ ] Positive bars green, negative bars red, total bars navy
- [ ] Signed labels on each bar ("+45" or "-30"), conditional on <= 12 bars
- [ ] Period label shown as subtitle
- [ ] Tooltip shows category + delta on hover (escaped HTML)
- [ ] ECharts theme registered (`formentera`)
- [ ] Streaming partial input renders progressively
- [ ] `onteardown` calls `chart.dispose()`
- [ ] `npm run build` produces `dist/views/variance-waterfall.html`
- [ ] Bundle size ~850-900KB (realistic ECharts tree-shaken estimate)

---

## Phase 2: `show-data-table` -- Generic Sortable Data Table

### Files

- Create: `views/data-table.html`
- Create: `src/data-table.ts`
- Modify: `server.ts` (add tool + resource registration)

### Input Schema

```typescript
{
  title: z.string().describe('Table title'),
  columns: z.array(z.object({
    key: z.string().describe('Field key in row objects'),
    label: z.string().describe('Column header label'),
    type: z.enum(['string', 'number', 'currency', 'date', 'percent']).describe('Format type'),
  })).describe('Column definitions'),
  rows: z.array(z.record(z.union([z.string(), z.number(), z.null()]))).describe('Row data objects'),
  sort_by: z.string().optional().describe('Initial sort column key'),
  highlight_rules: z.array(z.object({
    column: z.string().describe('Column key to apply rule'),
    condition: z.enum(['positive', 'negative']).describe('Condition type'),
    color: z.string().optional().describe('Override color hex'),
  })).optional().describe('Conditional formatting rules'),
}
```

### Resource URI

`ui://data-table/mcp-app.html`

### Rendering Approach

**Pure DOM** -- no ECharts. Uses `createElement` throughout (no `innerHTML`).

Key elements:
- **Title bar** with table title
- **Filter input** -- text filter that matches across all string columns
- **Sticky header row** -- Navy background, white bold text, click-to-sort with chevron indicators
- **Body rows** -- formatted per column type using `format.ts` functions
- **Row count indicator** -- "Showing X of Y rows"
- **Row cap** -- render at most 200 rows in DOM; show "Showing 200 of 1,247 rows" indicator

### Column Type Formatting

| Type | Formatter | Example |
|------|-----------|---------|
| `string` | passthrough (escaped) | "Well A-1" |
| `number` | `fmtNum` | "1,234" |
| `currency` | `fmtCurrency` | "$1,234" |
| `date` | `fmtDate` | "Mar 2025" |
| `percent` | `fmtPercent` | "45.2%" |

### Conditional Formatting (v1: positive/negative only)

- `positive`: green text for values > 0
- `negative`: red text for values < 0

### Sorting

Click column header to sort ascending, click again for descending. Use a stable sort. Chevron indicator (up/down) in header.

### Streaming

`ontoolinputpartial` renders rows as they arrive. Use **differential streaming**: track `previousRowCount` and only append new rows rather than rebuilding the entire table DOM. Header renders immediately from `columns`; rows append as the `rows` array grows. During streaming, disable sort/filter interactions; re-enable on `onToolInput`/`onToolResult`.

### Colors (CSS custom properties)

```css
--fp-table-header-bg: var(--fp-navy);
--fp-table-header-text: var(--fp-white);
--fp-table-border: var(--fp-light-gray);
```

### Context Update

On sort or filter change, `updateModelContext` with:
```json
{
  "title": "LOE by Category",
  "sortColumn": "loe_per_boe",
  "sortDirection": "desc",
  "filterText": "Permian",
  "visibleRows": 23,
  "totalRows": 45
}
```

### Text Fallback

```
"Data table: 'LOE by Category' -- 45 rows, 8 columns. Top row: Category=Workover, Amount=$2,496,558"
```

### Research Insights

**DOM Performance (Performance Oracle):**
- Pure DOM tables break above 1,000 rows without virtual scrolling -- cap visible rows at 200-500
- Differential streaming (append only new rows) prevents O(n) re-renders during partial input
- Disable sort/filter during streaming to prevent visual inconsistency where sort is clobbered by next partial

**Accessibility (Tufte):**
- Remove zebra striping (alternating row colors) -- adds non-data ink; use adequate row padding (12-16px) and subtle 1px bottom borders instead
- Green text (`#00B050`) on white has only ~3.2:1 contrast -- fails WCAG AA. Darken to `#2D7A0E` (4.5:1+)
- Sticky headers with a 2px navy bottom border are sufficient -- avoid heavy background fill on the header row

**Schema Improvements (TypeScript Reviewer):**
- Changed `z.record(z.unknown())` to `z.record(z.union([z.string(), z.number(), z.null()]))` for better type safety downstream
- Simplified `highlight_rules` to `positive`/`negative` only (dropped `above`/`below` per YAGNI)
- A `COLUMN_FORMATTERS` map keyed by column type enables `COLUMN_FORMATTERS[col.type](value)` instead of a switch

**Security:**
- All cell values rendered via `.textContent` (never `.innerHTML`) -- safe
- String values displayed in cells must be treated as untrusted (data flows from Snowflake through Claude)

**Simplification (YAGNI):**
- Dropped CSV export -- Claude can generate CSV natively from the same data
- Dropped `above`/`below` conditional formatting -- build when requested
- Added `updateModelContext` on sort/filter (Agent-Native recommendation)

### Acceptance Criteria

- [ ] Table renders with sticky headers, 1px row borders (no zebra striping)
- [ ] Click-to-sort works (asc/desc toggle) with chevron indicator
- [ ] Text filter filters rows across string columns
- [ ] Number/currency/date/percent columns formatted correctly
- [ ] Conditional formatting applies (green/red text, green darkened to #2D7A0E)
- [ ] Row cap: max 200 visible rows, "Showing X of Y" indicator
- [ ] Differential streaming: append-only during partials, disable sort/filter
- [ ] `updateModelContext` on sort/filter change
- [ ] `onteardown` cleans up state
- [ ] No ECharts dependency -- bundle should be very small (<100KB)
- [ ] `npm run build` produces `dist/views/data-table.html`

---

## Phase 3: `show-los-table` -- Lease Operating Statement

### Files

- Create: `views/los-table.html`
- Create: `src/los-table.ts`
- Modify: `server.ts` (add tool + resource registration)
- Modify: `CLAUDE.md` (add tool #6 spec)

### Input Schema

```typescript
{
  title: z.string().describe('Report title, e.g. "Net Field LOS"'),
  periods: z.array(z.string()).min(1).describe('Column headers for periods, e.g. ["Feb 2025", "Mar 2025", ...]'),
  rows: z.array(z.object({
    key: z.string().describe('Unique row identifier'),
    label: z.string().describe('Row label, e.g. "OIL REVENUE" or "900 / 100: LOCATION & ROADWAY"'),
    level: z.number().describe('Indentation depth (0 = top-level, 1 = section, 2 = subsection, 3 = detail)'),
    is_total: z.boolean().optional().describe('True for summary/total rows (bold styling)'),
    is_expandable: z.boolean().optional().describe('True if row can be collapsed/expanded'),
    parent_key: z.string().optional().describe('Key of parent row for tree structure'),
    values: z.array(z.number().nullable()).describe('Values for each period column'),
    total: z.number().nullable().optional().describe('Row total (rightmost column)'),
  })).describe('Hierarchical row data, pre-aggregated from Snowflake'),
  filters: z.array(z.object({
    label: z.string().describe('Filter name, e.g. "Asset Company"'),
    value: z.string().describe('Applied filter value, e.g. "All"'),
  })).optional().describe('Applied filters (read-only display)'),
  footnotes: z.array(z.string()).optional().describe('Footnote text lines'),
}
```

### Resource URI

`ui://los-table/mcp-app.html`

### Rendering Approach

**Pure DOM** -- no ECharts. This is a specialized financial statement table.

#### Layout Structure (Simplified from original)

```
+-----------------------------------------------------+
| Title Bar (centered) + FP Logo                       |
+-----------------------------------------------------+
| Filter summary: Operated | All Asset Co | 2025-2026  |
+-----------------------------------------------------+
| Column Headers (Metric | periods... | Total)         |
+-----------------------------------------------------+
| Hierarchical rows with +/- toggles                   |
| ...                                                  |
+-----------------------------------------------------+
| Footnotes                                            |
+-----------------------------------------------------+
```

#### Row Hierarchy & Styling

| Level | Example | Style |
|-------|---------|-------|
| 0 | "OIL BARRELS", "GAS MCF" | Bold, no indent, top-level metrics |
| 1 | "Total Revenue", "Total Expenses" | Bold, navy background tint, collapsible (+/-) |
| 2 | "Revenue", "Lease Operating Expenses" | Bold, light indent, collapsible |
| 3 | "OIL REVENUE", "WORKOVER EXPENSES" | Normal weight, deeper indent, collapsible |
| 4 | "900 / 100: LOCATION & ROADWAY" | Normal weight, deepest indent, leaf row |

#### Collapse/Expand Behavior

- Click chevron (not +/-) on expandable rows to show/hide children
- Children identified by `parent_key` matching the row's `key`
- Collapsed state: hide all descendants (recursive)
- Default: all rows expanded (simpler than computing initial collapse state)
- Build parent-child index once (`Map<string, string[]>`) on data receipt -- do not walk array on every toggle
- Collapse/expand state stored in `expandedKeys: Set<string>` -- this state is never overwritten by data updates

#### Number Formatting

- All numeric values use `fmtNum` (commas, no decimals)
- Negative values shown with minus sign (NOT parentheses)
- Null/missing values shown as empty cell
- Total column (rightmost) has slightly heavier font weight

#### Filter Summary (simplified from sidebar)

Single collapsed `<details>` element above the table showing applied filters as inline text:
```
Operated | Accrual: All | Asset Co: All | Year: 2025-2026 | Field: All
```

No interactivity -- filters are informational only. User asks Claude to re-run with different filters.

#### Footnotes

Rendered below the table in small gray text as simple paragraphs.

### Colors

```css
/* LOS-specific -- uses Steel header as intentional differentiation from generic data table */
--los-header-bg: var(--fp-steel);       /* #336699 - column headers */
--los-header-text: var(--fp-white);
--los-total-bg: rgba(0, 31, 69, 0.05);  /* Very light navy for total rows */
--los-section-bg: rgba(0, 31, 69, 0.03); /* Lighter for section rows */
--los-border: var(--fp-light-gray);
```

### Text Fallback

```
"Net Field LOS: 45 line items, Feb 2025 - Feb 2026. Total Revenue: $39,301,841. Total Expenses: $20,731,126. LOE: $15,214,175."
```

### Research Insights

**Rendering Approach (No Streaming):**
- LOS is a pre-aggregated financial statement (~45 rows). Skip `ontoolinputpartial` -- use `onToolResult` only. No wasted render cycles on a small dataset.
- Build parent-child index as `Map<string, string[]>` once on data receipt for O(1) collapse/expand lookups.

**Hierarchy Design (Tufte):**
- Use typography weight (bold/semibold/normal) + indentation (16px per level, max 48px for level 4) instead of color coding for depth
- Total/subtotal rows: 1px top border + bold text + light background tint
- Use chevrons (small, 8-10px) for collapse/expand, not +/- icons or folder icons

**Financial Table Accessibility:**
- ARIA roles for tree tables: `role="treegrid"`, `aria-expanded`, `aria-level` on rows
- Sticky first column + sticky header intersection requires careful z-index stacking
- Right-align all numeric values (financial convention)
- Total column separated by additional padding, not colored background

**Schema (TypeScript Reviewer):**
- Added `.min(1)` on `periods` array to prevent zero-column table
- Validate `values.length === periods.length` for every row in the type guard
- The pre-aggregated Snowflake approach is correct -- the view renders, not computes

**Filter Panel Simplification (Code Simplicity):**
- Replaced sidebar layout with collapsed `<details>` element -- saves ~60-80 LOC of CSS
- Reclaims horizontal space for monthly columns (critical on smaller screens)

**Header Color (Pattern Recognition):**
- Uses Steel (#336699) intentionally to differentiate from generic data table Navy (#001F45)
- Document as an approved brand variation in CLAUDE.md

### Acceptance Criteria

- [ ] Hierarchical rows render with correct indentation (4 levels) and typography weight
- [ ] Chevron toggles collapse/expand sections recursively
- [ ] Total/summary rows are bold with top border and light background tint
- [ ] Monthly columns are horizontally scrollable with sticky first column
- [ ] Total column (rightmost) rendered with heavier weight, right-aligned numbers
- [ ] Filter summary shows as collapsed `<details>` element above table
- [ ] Footnotes render below table as paragraphs
- [ ] Number formatting: commas, negatives with minus, nulls as empty
- [ ] ARIA: `role="treegrid"`, `aria-expanded`, `aria-level` on rows
- [ ] FP branding: steel blue header, navy text
- [ ] `onToolResult` only (no streaming -- data arrives complete)
- [ ] `onteardown` cleans up state
- [ ] No ECharts -- pure DOM, small bundle (<100KB)
- [ ] `npm run build` produces `dist/views/los-table.html`
- [ ] CLAUDE.md updated with tool #6 spec

---

## Phase 4: `visualize-decline` -- Decline Curve Analysis

### Files

- Create: `views/decline-curve.html`
- Create: `src/decline-curve.ts`
- Create: `src/shared/decline-math.ts` (Arps formulas, extracted for testability)
- Modify: `server.ts` (add tool + resource registration)

### Input Schema

```typescript
{
  well_name: z.string().describe('Well identifier'),
  actual: z.array(z.object({
    date: z.string().describe('ISO date string'),
    oil_bbl: z.number().describe('Daily oil production in BBL/D'),
  })).describe('Actual production data points'),
  forecast: z.union([
    z.object({
      method: z.enum(['exponential', 'hyperbolic', 'harmonic']).describe('Arps decline method'),
      ip: z.number().describe('Initial production rate (BBL/D)'),
      di: z.number().min(0).describe('Initial decline rate (fraction/year)'),
      b: z.number().min(0).max(1).describe('Hyperbolic exponent (0=exp, 0<b<1=hyp, 1=harm)'),
      months: z.number().describe('Forecast duration in months'),
    }),
    z.object({
      fit: z.literal(true).describe('Auto-fit Arps parameters from actual data'),
      months: z.number().describe('Forecast duration in months'),
    }),
  ]).optional().describe('Decline curve forecast: explicit params OR auto-fit from actuals'),
}
```

### Resource URI

`ui://decline-curve/mcp-app.html`

### ECharts Components Needed

```typescript
import { ScatterChart, LineChart } from 'echarts/charts';
import type { ScatterSeriesOption, LineSeriesOption } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
```

### Rendering Approach

**Two-series chart (v1 -- type curve overlay deferred):**
1. **Actual production** -- Scatter plot, navy dots (3-4px for daily, 5-6px for monthly data)
2. **Decline forecast** -- Line, purple dashed (computed client-side from Arps parameters)

**Y-axis default: logarithmic** (standard for decline curves in O&G -- exponential decline appears as a straight line on semi-log)

### Arps Decline Math (`src/shared/decline-math.ts`)

Extract to a standalone module for testability. Must handle edge cases:

```
Exponential: q(t) = ip * exp(-di * t)
Hyperbolic:  q(t) = ip * (1 + b * di * t) ^ (-1/b)
Harmonic:    q(t) = ip / (1 + di * t)
```

Where `t` is time in years from IP.

**Edge case guards (critical):**
- Branch on `method` (or `b === 0`) before applying hyperbolic formula -- `(1 + 0*di*t)^(-1/0)` = `1^(-Infinity)` = `NaN`
- Clamp `t >= 0` to prevent rates above IP from negative time values
- Guard `(1 + b*di*t) > 0` -- if base goes zero/negative, well has reached economic limit; stop forecast
- When `di === 0`, all formulas return `ip` (flat line) -- mathematically correct, handle gracefully
- Use trapezoidal integration for EUR: `(q(t) + q(t+1)) / 2 * days_between` -- more accurate than left-point Riemann sums

**Auto-fit mode:**
When `forecast.fit === true`, compute best-fit Arps parameters from the `actual` data:
- Use least-squares regression on the log-rate vs. time relationship
- Fit exponential first (simplest), then try hyperbolic if residuals are high
- This allows Claude to say "fit a decline curve" without guessing ip/di/b

**EUR (Estimated Ultimate Recovery):**
Display EUR and remaining reserves as plain text annotations in the upper-right corner (not colored KPI badges -- Tufte: badges are high-ink, low-data).

### Toolbar

- Log/Linear scale toggle (default: Log)

### Colors

- Actual points: `FP_NAVY` (#001F45)
- Decline forecast: `FP_PURPLE` (#553D8C), dashed line, 2px width

### Context Update

On DataZoom change, `updateModelContext` with:
```json
{
  "well_name": "SMITH 1-14H",
  "visibleDateRange": { "start": "2023-01", "end": "2025-06" },
  "eur_bbl": 125000,
  "remaining_bbl": 45000,
  "declineMethod": "hyperbolic"
}
```

### Text Fallback

```
"Decline curve: SMITH 1-14H, 24 months actual, hyperbolic forecast (IP=450, Di=0.65, b=0.8). EUR: 125,000 BBL, 45,000 BBL remaining. Fit: R^2=0.92."
```

### Research Insights

**Agent-Native Design (Critical):**
- Claude can't reliably generate Arps parameters from raw production data -- this is a curve-fitting problem, not a knowledge problem. Added `fit: true` auto-fit mode so Claude can orchestrate without being a petroleum engineer.
- Include fit quality metric (R-squared) in text fallback so non-UI consumers can assess forecast reliability.

**Numerical Precision (TypeScript Reviewer):**
- IEEE 754 doubles are fine for O&G production rates (0-50,000 BBL/D). BigInt unnecessary.
- The edge cases (b=0 NaN, negative time, zero denominator) are the real concern, not floating-point precision.
- Trapezoidal integration for EUR can differ 5-10% from Riemann sums for aggressive declines.

**Visualization (Tufte):**
- Log Y default is correct for petroleum engineering -- exponential decline appears as a straight line
- Replace KPI badges with plain text annotations in upper-right corner
- If actual data has 500+ daily points, use 3-4px circles to avoid overplotting
- Differentiate forecast from actual by line style (dashed), not just color -- important for colorblind accessibility

**Simplification (YAGNI):**
- Dropped P10/P50/P90 type curve overlay -- different analytical question, different Snowflake query, different use case. Add in v2 when requested.
- Removed `MarkLineComponent` (was imported with no documented use)

**ECharts Theme:**
- Must call `echarts.registerTheme('formentera', FP_ECHARTS_THEME)` -- omitted in original plan

**DataZoom Listener Guard:**
- Reuse the `dataZoomWired` guard pattern from production chart
- Improve: use `chart.off('datazoom')` before `chart.on('datazoom', ...)` instead of a boolean (survives chart re-creation)
- Cancel `zoomTimeout` in `onteardown` callback

### Acceptance Criteria

- [ ] Actual production renders as scatter points (navy, 3-4px)
- [ ] Decline forecast line computed from Arps parameters (explicit or auto-fit)
- [ ] Auto-fit mode: compute best-fit Arps params when `forecast.fit === true`
- [ ] Arps math edge cases handled: b=0, negative t, zero denominator, economic limit
- [ ] Log scale Y-axis by default, toggle to linear
- [ ] EUR and remaining reserves displayed as plain text annotations
- [ ] DataZoom for time range selection with listener guard
- [ ] Tooltip shows date + rate on hover (escaped)
- [ ] Colors match spec (navy actual, purple dashed forecast)
- [ ] ECharts theme registered (`formentera`)
- [ ] Streaming partial input renders progressively
- [ ] `onteardown` calls `chart.dispose()` and cancels `zoomTimeout`
- [ ] `npm run build` produces `dist/views/decline-curve.html`
- [ ] Bundle size ~850-900KB (realistic ECharts estimate)
- [ ] `src/shared/decline-math.ts` unit-testable in isolation

---

## Phase 5: `show-well-map` -- Geospatial Well Map

### Files

- Create: `views/well-map.html`
- Create: `src/well-map.ts`
- Create: `src/types/maplibre-gl.d.ts` (ambient type declarations for CDN-loaded library)
- Modify: `server.ts` (add tool + resource registration with CSP)

### Input Schema

```typescript
{
  wells: z.array(z.object({
    well_name: z.string().describe('Well identifier'),
    lat: z.number().describe('Latitude'),
    lng: z.number().describe('Longitude'),
    status: z.enum(['producing', 'shut-in', 'p&a', 'drilling', 'completing']).describe('Well status'),
    oil_rate: z.number().optional().describe('Current oil rate BBL/D'),
    gas_rate: z.number().optional().describe('Current gas rate MCF/D'),
    water_rate: z.number().optional().describe('Current water rate BBL/D'),
    loe_per_boe: z.number().optional().describe('LOE per BOE ($/BOE)'),
    field: z.string().optional().describe('Field name'),
    basin: z.string().optional().describe('Basin name'),
  })).describe('Array of well locations and attributes'),
}
```

### Resource URI

`ui://well-map/mcp-app.html`

### MapLibre Loading Strategy

**CDN via `<script>` tag** in the HTML view (NOT npm dependency). Pin to exact version with integrity hash:

```html
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.19.0/dist/maplibre-gl.css">
<script src="https://unpkg.com/maplibre-gl@5.19.0/dist/maplibre-gl.js"></script>
```

**CSP Fallback**: If blob: workers are blocked by the host's CSP, switch to the CSP bundle:
```html
<script src="https://unpkg.com/maplibre-gl@5.19.0/dist/maplibre-gl-csp.js"></script>
<script>
  maplibregl.setWorkerUrl('https://unpkg.com/maplibre-gl@5.19.0/dist/maplibre-gl-csp-worker.js');
</script>
```

**TypeScript declarations**: Since MapLibre is loaded via CDN `<script>`, the `maplibregl` global has no TypeScript types. Create `src/types/maplibre-gl.d.ts`:
```typescript
declare const maplibregl: typeof import('maplibre-gl');
```

### CSP Configuration (CORRECTED)

CSP must be nested under `_meta.ui.csp` with protocol prefixes:

```typescript
registerAppResource(
  server,
  mapUri,
  mapUri,
  { mimeType: RESOURCE_MIME_TYPE },
  async (): Promise<ReadResourceResult> => {
    const html = await readViewHtml('well-map.html');
    return {
      contents: [{
        uri: mapUri,
        mimeType: RESOURCE_MIME_TYPE,
        text: html,
        _meta: {
          ui: {
            csp: {
              resourceDomains: ['https://unpkg.com', 'https://cdn.jsdelivr.net'],
              connectDomains: ['https://tiles.openfreemap.org', 'https://demotiles.maplibre.org'],
            },
          },
        },
      }],
    };
  },
);
```

### Rendering Approach

**GeoJSON source + circle layer** (NOT HTML markers -- critical performance decision):

At 1,550 wells, HTML markers cause visible pan/zoom jank (1,550 absolutely-positioned DOM elements). Circle layers render entirely in WebGL with smooth 60fps.

```typescript
// Add GeoJSON source
map.addSource('wells', {
  type: 'geojson',
  data: wellsToGeoJSON(wells),
});

// Add circle layer
map.addLayer({
  id: 'wells-layer',
  type: 'circle',
  source: 'wells',
  paint: {
    'circle-radius': 6,
    'circle-color': ['match', ['get', 'status'],
      'producing', STATUS_COLORS.producing,
      'shut-in', STATUS_COLORS['shut-in'],
      'p&a', STATUS_COLORS['p&a'],
      'drilling', STATUS_COLORS.drilling,
      'completing', STATUS_COLORS.completing,
      FP_GRAY, // fallback
    ],
    'circle-stroke-width': 1,
    'circle-stroke-color': '#FFFFFF',
  },
});
```

### Color Mode (v1: Status only)

v1 ships with status coloring only. Status is the only mode that requires no optional fields and uses the existing `STATUS_COLORS` map.

Additional color modes (basin, field, rate gradient, LOE/BOE gradient) deferred to v2 when requested.

### Popup Content

On marker click via `map.on('click', 'wells-layer', ...)`, show popup using `setDOMContent()`:

```typescript
// NEVER use setHTML() with data -- XSS risk
const el = document.createElement('div');
const nameEl = document.createElement('strong');
nameEl.textContent = well.well_name; // .textContent is safe
el.appendChild(nameEl);
// ... build popup DOM with createElement + textContent

popup.setDOMContent(el).setLngLat([well.lng, well.lat]).addTo(map);
```

Popup includes:
- Well name (bold)
- Status (colored text)
- Oil/Gas/Water rates (if present)
- LOE/BOE (if present)
- Field, Basin
- **"Show Production" button** -- calls `app.sendMessage({ message: \`Show production for ${well.well_name}\` })` (promoted from stretch to required)

### Map Initialization Race Handling

Gate all data operations behind `map.on('load')`:

```typescript
let mapReady = false;
let pendingWells: WellRecord[] = [];

map.on('load', () => {
  mapReady = true;
  if (pendingWells.length > 0) {
    addWellsToMap(pendingWells);
    pendingWells = [];
  }
});

// In partial handler:
if (!mapReady) {
  pendingWells.push(...newWells);
  return;
}
addWellsToMap(newWells);
```

Add 8-second timeout on map load: if tiles don't load, switch to fallback `demotiles.maplibre.org`.

### Visibility-Based Pause (Critical for WebGL)

```typescript
onPause: () => {
  if (!map || !mapReady) return;
  map.stop();
  // After 30s still paused, release WebGL context entirely
  pauseTimer = setTimeout(() => {
    if (map) { mapData = getCurrentGeoJSON(); map.remove(); map = null; }
  }, 30_000);
},
onResume: () => {
  if (pauseTimer) { clearTimeout(pauseTimer); pauseTimer = null; }
  if (!map) {
    // Recreate map from cached data
    initializeMap();
    addWellsToMap(mapData);
  } else {
    map.resize();
    map.triggerRepaint();
  }
},
```

### Context Update

On well click, `updateModelContext` with:
```json
{
  "selectedWell": {
    "well_name": "SMITH 1-14H",
    "status": "producing",
    "oil_rate": 125,
    "gas_rate": 450,
    "field": "Spraberry",
    "basin": "Permian"
  },
  "visibleBounds": { "ne": [32.5, -101.2], "sw": [31.8, -102.1] },
  "colorMode": "status",
  "wellCount": 45
}
```

### Text Fallback

```
"Well map: 45 wells (38 producing, 4 shut-in, 2 drilling, 1 P&A). Bounds: Permian Basin. Top producer: SMITH 1-14H (125 BBL/D)."
```

### Research Insights

**Performance (Critical -- Performance Oracle):**
- HTML markers cause jank at 1,550 wells. Changed to GeoJSON source + circle layer (GPU-rendered, smooth at 10K+ points).
- `fitBounds` silently fails before map style loads -- must gate behind `map.on('load')`.
- After 30s off-screen, call `map.remove()` to release WebGL context. Browsers limit to 8-16 contexts.
- `map.triggerRepaint()` needed on resume (not just `resize()`).

**MapLibre CDN (MapLibre Research Agent):**
- Pin to exact version (5.19.0 as of March 2026) with integrity hash
- Standard bundle creates workers via blob: URL -- works if CSP allows via `script-src` fallback
- CSP bundle alternative (`maplibre-gl-csp.js` + separate worker file) eliminates blob: requirement
- MapLibre CSS required for popups, markers, navigation controls
- OpenFreeMap: free, no key, survived 100K req/sec. Fallback: `demotiles.maplibre.org`

**Security (Security Sentinel):**
- CDN version pinning with SRI hashes prevents supply-chain attacks
- Use `setDOMContent()` not `setHTML()` for popups -- XSS risk from well names
- Set `Referrer-Policy: no-referrer` to prevent tile request leakage (well locations could be commercially sensitive during acquisitions)
- CSP must nest under `_meta.ui.csp` with `https://` protocol prefixes

**Agent-Native (Promoted to required):**
- `sendMessage` in popup ("Show Production" button) enables UI-initiated agent action -- the canonical agent-native interaction
- `status` field changed to `z.enum()` for stronger validation and agent-friendly choices

**Frontend Races:**
- Gate all map operations behind `map.on('load')` -- buffer partials until map ready
- Do not call `map.stop()` before load event completes
- Fullscreen: disable button during `requestDisplayMode` to prevent double-click race

### Acceptance Criteria

- [ ] Map renders with OpenFreeMap tiles (8s timeout, fallback to demo tiles)
- [ ] Well markers as circle layer (NOT HTML markers), colored by status
- [ ] Click marker shows popup with well details (built with `setDOMContent`, not `setHTML`)
- [ ] "Show Production" button in popup calls `app.sendMessage()`
- [ ] Auto-fit bounds on initial render (gated behind `map.on('load')`)
- [ ] `updateModelContext` fires on well click
- [ ] IntersectionObserver pauses WebGL; 30s timeout releases context entirely
- [ ] CSP nested under `_meta.ui.csp` with `https://` protocol prefixes
- [ ] MapLibre pinned to exact version (5.19.0) in CDN URL
- [ ] Ambient TypeScript declarations for `maplibregl` global
- [ ] Navigation controls (zoom, compass) present
- [ ] Streaming partial input buffers wells until map ready, then adds progressively
- [ ] `onteardown` calls `map.remove()`
- [ ] `npm run build` produces `dist/views/well-map.html`
- [ ] Bundle size <50KB (MapLibre ~800KB loaded from CDN at runtime)

---

## Cross-Cutting Concerns

### server.ts Growth

With 6 tools, `server.ts` will be ~330 lines. After phase 2 (when both an ECharts and DOM tool exist), evaluate extracting each tool's registration into `src/tools/<name>.ts`. This keeps `server.ts` under 50 lines as a pure wiring file.

### Shared Code Additions

| File | Change | Phase |
|------|--------|-------|
| `src/shared/decline-math.ts` | New: Arps formulas with edge-case guards | Phase 4 |
| `src/types/maplibre-gl.d.ts` | New: Ambient type declarations | Phase 5 |
| `src/shared/colors.ts` | Minor: add `getStatusColor()` with case-insensitive lookup + fallback | Phase 5 |
| `src/shared/security.ts` | New: `escapeHtml()` utility for tooltip/popup content | Phase 1 |

### ECharts Bundle Isolation

Each view bundles its own copy of ECharts components. Realistic bundle sizes:
- `variance-waterfall.html`: ~850-900KB (ECharts BarChart -- core + zrender dominate)
- `decline-curve.html`: ~850-900KB (ECharts Scatter+Line)
- `data-table.html`: <100KB (no ECharts)
- `los-table.html`: <100KB (no ECharts)
- `well-map.html`: <50KB (MapLibre ~800KB loaded from CDN)

### Type Guard Pattern (repeated per tool)

Every tool needs its own `isXxxRecord` + `extractData` functions. Add a one-liner shared helper:

```typescript
// shared/validation.ts
export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
```

This eliminates the `as Record<string, unknown>` assertion inside each type guard.

### `onteardown` Wiring (NEW -- missing from original plan)

Every view must wire `onteardown` to actual cleanup:
- ECharts views: `chart.dispose()`, cancel pending timeouts
- MapLibre view: `map.remove()` (releases WebGL context)
- DOM table views: clear state, remove event listeners

### Fullscreen Transition Guard (NEW)

Add to `lifecycle.ts`: disable fullscreen button during `requestDisplayMode` to prevent double-click race. Let `onhostcontextchanged` be the sole authority on `currentDisplayMode`.

### Security Layer (NEW)

Create `src/shared/security.ts`:
```typescript
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!));
}
```

Use in: ECharts tooltip formatters, MapLibre popup text, table cell content where HTML context is possible.

### Colorblind Accessibility (NEW)

Gas commodity color changed from `#FF0000` (red) to `#E66100` (orange) in `colors.ts`. Green + red fails for 8% of males with deuteranopia/protanopia. Orange is clearly distinct from green under all forms of color vision deficiency.

Also: darken green conditional formatting text from `#00B050` to `#2D7A0E` for WCAG AA contrast (4.5:1+).

### Dev Workflow

After phase 1 (when 2 views exist), update the `dev` script to watch all views instead of just production-chart. Use `build-views.mjs` with `chokidar-cli` or `nodemon --watch views --watch src`.

### Testing Infrastructure

Before or during phase 1, add a minimal test suite with `vitest`:
- `readViewHtml()` loads and caches correctly
- Each tool handler returns valid `CallToolResult` with text content
- Type guards accept/reject edge cases (null, wrong types, partial objects)
- Format functions handle null/NaN/undefined
- Arps decline math: known-value assertions for each method + edge cases

### Build Verification

After each phase, verify:
```bash
npm run build        # tsc --noEmit passes, all views built
ls -lh dist/views/   # Check bundle sizes
npm run serve        # Server starts, all tools registered
```

---

## Dependencies

- **No new npm dependencies** for any tool
- MapLibre GL JS v5.19.0 loaded via CDN `<script>` tag in well-map.html
- All ECharts components already available from existing `echarts ^5.6.0` dependency
- `vitest` as devDependency for testing (Phase 1)

## CLAUDE.md Updates Needed

1. Add `show-los-table` as tool #6 with full spec
2. Update `show-well-map` input to use `{ wells: [...] }` wrapper (not bare array)
3. Update gas commodity color from `#FF0000` to `#E66100`
4. Add `src/shared/decline-math.ts`, `src/shared/security.ts`, `src/types/maplibre-gl.d.ts` to project structure
5. Document LOS header Steel color as intentional brand variation

## References

- CLAUDE.md tool specs: `/Users/robstover/Development/formentera/mcp-app/CLAUDE.md:173-214`
- Production chart reference: `src/production-chart.ts`, `views/production-chart.html`
- Scaffold plan: `docs/plans/2026-03-05-feat-mcp-app-scaffold-plan.md`
- LOS screenshot: User-provided (Net Field LOS format with hierarchical rows, monthly columns, filter panel)
- MCP Apps ext-apps spec: `https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx`
- MapLibre GL JS docs: `https://maplibre.org/maplibre-gl-js/docs/`
- OpenFreeMap: `https://openfreemap.org/`
- ECharts tree-shaking guide: `echarts/core` selective imports

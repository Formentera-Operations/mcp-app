---
status: complete
priority: p2
issue_id: "005"
tags: [code-review, performance, bundle-size]
dependencies: []
---

# Tree-shake ECharts to reduce bundle size

## Problem Statement

`src/production-chart.ts:1` imports `import * as echarts from 'echarts'`, pulling the entire ECharts library (~1.4MB minified). The production chart only uses line series, category axis, value axis, tooltip, legend, and dataZoom — roughly 40% of the library. Tree-shaking could reduce the bundle to ~500-600KB.

## Findings

- **Performance Oracle**: Flagged as P1 — 60-65% bundle reduction possible

## Proposed Solutions

### Option A: Selective ECharts imports (Recommended)
```typescript
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, CanvasRenderer]);
```

**Pros:** ~60% smaller bundle, same functionality
**Cons:** Must explicitly register each component; easy to miss one and get a runtime error
**Effort:** Medium

### Option B: Keep full import, defer to Phase 2
Since there's only one view currently, the full import is simpler. Optimize when adding more views.

**Pros:** No risk of missing a component
**Cons:** Larger bundle
**Effort:** None

## Recommended Action

Option A — but test thoroughly. The single-file bundle is served as a resource string, so size directly impacts load time.

## Technical Details

- **File:** `src/production-chart.ts:1`
- **Current components used:** LineChart, GridComponent, TooltipComponent, DataZoomComponent, CategoryAxis, ValueAxis, LogAxis

## Acceptance Criteria

- [ ] ECharts imported selectively via `echarts/core`
- [ ] All chart features still work (line chart, dual axis, datazoom, tooltip, log scale)
- [ ] Bundle size reduced (verify with `ls -la dist/views/production-chart.html`)

## Work Log

| Date | Action |
|------|--------|
| 2026-03-06 | Created from code review |

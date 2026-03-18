import * as echarts from 'echarts/core';
import { LineChart, ScatterChart } from 'echarts/charts';
import type { LineSeriesOption, ScatterSeriesOption } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkPointComponent,
  MarkLineComponent,
} from 'echarts/components';
import type {
  GridComponentOption,
  TooltipComponentOption,
  LegendComponentOption,
  MarkPointComponentOption,
  MarkLineComponentOption,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ComposeOption } from 'echarts/core';
import { createViewApp } from './shared/lifecycle.ts';
import { showError } from './shared/errors.ts';
import {
  FP_ECHARTS_THEME,
  FP_NAVY,
  FP_GRAY,
  FP_LIGHT_GRAY,
  FP_POSITIVE,
  FP_CHART_COLORS_BASE,
} from './shared/colors.ts';
import { fmtNum, fmtPressure } from './shared/format.ts';
import { findCurveIntersection } from './shared/reservoir-math.ts';
import type { Point2D } from './shared/reservoir-math.ts';

echarts.use([
  LineChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkPointComponent,
  MarkLineComponent,
  CanvasRenderer,
]);

type ECOption = ComposeOption<
  | LineSeriesOption
  | ScatterSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | MarkPointComponentOption
  | MarkLineComponentOption
>;

echarts.registerTheme('formentera', FP_ECHARTS_THEME);

// --- Types ---

interface CurvePoint {
  rate_stb_d: number;
  bhp_psi: number;
}

interface OperatingPoint {
  rate_stb_d: number;
  bhp_psi: number;
}

interface VlpCase {
  label: string;
  curve: CurvePoint[];
  operating_point?: OperatingPoint;
}

interface NodalData {
  well_name: string;
  date?: string;
  reservoir_pressure_psi?: number;
  ipr: CurvePoint[];
  vlp_cases: VlpCase[];
}

// --- Type guards ---

function isCurvePoint(v: unknown): v is CurvePoint {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.rate_stb_d === 'number' && typeof r.bhp_psi === 'number';
}

function isVlpCase(v: unknown): v is VlpCase {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.label === 'string' &&
    Array.isArray(r.curve) &&
    r.curve.length > 0 &&
    r.curve.every(isCurvePoint)
  );
}

function isNodalData(v: unknown): v is NodalData {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.well_name === 'string' &&
    Array.isArray(r.ipr) &&
    r.ipr.length > 0 &&
    r.ipr.every(isCurvePoint) &&
    Array.isArray(r.vlp_cases) &&
    r.vlp_cases.length > 0 &&
    r.vlp_cases.every(isVlpCase)
  );
}

function extractData(args: Record<string, unknown>): NodalData | null {
  if (isNodalData(args)) return args;
  return null;
}

// --- Helpers ---

function curveToPoints(curve: CurvePoint[]): Point2D[] {
  return curve
    .sort((a, b) => a.rate_stb_d - b.rate_stb_d)
    .map((p) => ({ x: p.rate_stb_d, y: p.bhp_psi }));
}

// --- State ---

let chart: echarts.ECharts | null = null;

// --- UI helpers ---

function buildKpiStrip(data: NodalData, opPoints: OperatingPoint[]): void {
  const strip = document.getElementById('kpi-strip');
  if (!strip) return;

  strip.replaceChildren();

  const kpis: Array<{ value: string; label: string }> = [
    { value: data.well_name, label: 'Well' },
  ];

  if (data.date) {
    kpis.push({ value: data.date, label: 'Date' });
  }
  if (data.reservoir_pressure_psi != null) {
    kpis.push({ value: fmtPressure(data.reservoir_pressure_psi), label: 'Reservoir Pressure' });
  }

  // Show operating point for the first VLP case
  if (opPoints.length > 0) {
    const best = opPoints[0];
    kpis.push({ value: `${fmtNum(Math.round(best.rate_stb_d))} STB/D`, label: 'Operating Rate' });
    kpis.push({ value: fmtPressure(Math.round(best.bhp_psi)), label: 'Flowing BHP' });
  }

  kpis.push({ value: `${data.vlp_cases.length}`, label: 'VLP Cases' });

  for (const kpi of kpis) {
    const div = document.createElement('div');
    div.className = 'kpi';

    const valEl = document.createElement('div');
    valEl.className = 'kpi-value';
    valEl.textContent = kpi.value;

    const labelEl = document.createElement('div');
    labelEl.className = 'kpi-label';
    labelEl.textContent = kpi.label;

    div.appendChild(valEl);
    div.appendChild(labelEl);
    strip.appendChild(div);
  }

  strip.style.display = 'flex';
}

function buildChart(data: NodalData): void {
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';

  const container = document.getElementById('chart');
  if (!container) return;

  if (!chart) {
    chart = echarts.init(container, 'formentera');
    window.addEventListener('resize', () => chart?.resize());
  }

  const series: (LineSeriesOption | ScatterSeriesOption)[] = [];

  // IPR curve (bold Navy, downward-sloping)
  const iprSorted = [...data.ipr].sort((a, b) => a.rate_stb_d - b.rate_stb_d);
  series.push({
    name: 'IPR',
    type: 'line',
    data: iprSorted.map((p) => [p.rate_stb_d, p.bhp_psi]),
    symbol: 'none',
    lineStyle: { color: FP_NAVY, width: 3 },
    itemStyle: { color: FP_NAVY },
  });

  // IPR as Point2D array for intersection
  const iprPoints = curveToPoints(data.ipr);

  // VLP curves + operating points
  const opPoints: OperatingPoint[] = [];

  for (let i = 0; i < data.vlp_cases.length; i++) {
    const vlp = data.vlp_cases[i];
    const color = FP_CHART_COLORS_BASE[(i + 1) % FP_CHART_COLORS_BASE.length]; // Skip Navy (used by IPR)
    const vlpSorted = [...vlp.curve].sort((a, b) => a.rate_stb_d - b.rate_stb_d);

    series.push({
      name: vlp.label,
      type: 'line',
      data: vlpSorted.map((p) => [p.rate_stb_d, p.bhp_psi]),
      symbol: 'none',
      lineStyle: { color, width: 2 },
      itemStyle: { color },
    });

    // Resolve operating point: use provided, or compute intersection
    let op = vlp.operating_point;
    if (!op) {
      const vlpPoints = curveToPoints(vlp.curve);
      const intersection = findCurveIntersection(iprPoints, vlpPoints);
      if (intersection) {
        op = { rate_stb_d: intersection.x, bhp_psi: intersection.y };
      }
    }

    if (op) {
      opPoints.push(op);
      series.push({
        name: `${vlp.label} OP`,
        type: 'scatter',
        data: [[op.rate_stb_d, op.bhp_psi]],
        symbolSize: 14,
        itemStyle: { color: FP_POSITIVE, borderColor: '#FFFFFF', borderWidth: 2 },
        z: 10,
      });
    }
  }

  // Reservoir pressure horizontal line (if provided)
  if (data.reservoir_pressure_psi != null) {
    // Add to IPR series as markLine
    const iprSeries = series[0] as LineSeriesOption;
    iprSeries.markLine = {
      silent: true,
      symbol: 'none',
      lineStyle: { color: FP_GRAY, type: 'dashed', width: 1 },
      label: { formatter: 'Pr', color: FP_GRAY, fontSize: 10, position: 'start' },
      data: [{ yAxis: data.reservoir_pressure_psi }],
    };
  }

  buildKpiStrip(data, opPoints);

  const option: ECOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: FP_NAVY,
      borderColor: FP_NAVY,
      textStyle: { color: '#FFFFFF', fontFamily: 'Arial, sans-serif', fontSize: 12 },
      formatter: (params: unknown) => {
        const p = params as { seriesName: string; data: [number, number] };
        if (!Array.isArray(p.data)) return '';
        return `${p.seriesName}<br/>Rate: ${fmtNum(Math.round(p.data[0]))} STB/D<br/>BHP: ${fmtNum(Math.round(p.data[1]))} psi`;
      },
    },
    legend: {
      show: true,
      bottom: 8,
      textStyle: { color: FP_GRAY, fontSize: 11 },
      // Hide operating point series from legend
      data: series
        .filter((s) => !String(s.name).endsWith(' OP'))
        .map((s) => s.name as string),
    },
    grid: { left: 70, right: 24, top: 16, bottom: 44 },
    xAxis: {
      type: 'value',
      name: 'Rate (STB/D)',
      nameTextStyle: { color: FP_GRAY, fontSize: 11 },
      axisLabel: { color: FP_GRAY, fontSize: 11 },
      axisLine: { lineStyle: { color: FP_LIGHT_GRAY } },
      splitLine: { lineStyle: { color: FP_LIGHT_GRAY } },
    },
    yAxis: {
      type: 'value',
      name: 'BHP (psi)',
      nameTextStyle: { color: FP_GRAY, fontSize: 11 },
      axisLabel: { color: FP_GRAY, fontSize: 11 },
      axisLine: { lineStyle: { color: FP_LIGHT_GRAY } },
      splitLine: { lineStyle: { color: FP_LIGHT_GRAY } },
    },
    series,
  };

  chart.setOption(option, true);
}

// --- Initialize ---

createViewApp('Nodal Analysis', '0.1.0', {
  onToolInputPartial: (args) => {
    const data = extractData(args);
    if (data) buildChart(data);
  },
  onToolInput: (args) => {
    const data = extractData(args);
    if (data) buildChart(data);
  },
  onToolResult: (sc) => {
    const data = extractData(sc);
    if (data) {
      buildChart(data);
    } else {
      showError('No nodal analysis data received.');
    }
  },
  onToolCancelled: () => {
    showError('Tool call was cancelled.');
  },
  onPause: () => {},
  onResume: () => { chart?.resize(); },
  onTeardown: () => { chart?.dispose(); chart = null; },
});

import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import type { BarSeriesOption } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
} from 'echarts/components';
import type {
  GridComponentOption,
  TooltipComponentOption,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ComposeOption } from 'echarts/core';
import { createViewApp } from './shared/lifecycle.ts';
import {
  FP_ECHARTS_THEME,
  FP_NAVY,
  FP_POSITIVE,
  FP_NEGATIVE,
  FP_GRAY,
  FP_LIGHT_GRAY,
} from './shared/colors.ts';
import { fmtNum } from './shared/format.ts';

// Register required ECharts components (tree-shaking)
echarts.use([
  BarChart,
  GridComponent,
  TooltipComponent,
  CanvasRenderer,
]);

type ECOption = ComposeOption<
  | BarSeriesOption
  | GridComponentOption
  | TooltipComponentOption
>;

echarts.registerTheme('formentera', FP_ECHARTS_THEME);

// --- Type guard for variance data ---

interface VarianceComponent {
  category: string;
  delta_boe: number;
}

interface VarianceData {
  base_boe: number;
  current_boe: number;
  period_label: string;
  components: VarianceComponent[];
}

function isVarianceComponent(v: unknown): v is VarianceComponent {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.category === 'string' && typeof r.delta_boe === 'number';
}

function isVarianceData(v: unknown): v is VarianceData {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.base_boe === 'number' &&
    typeof r.current_boe === 'number' &&
    typeof r.period_label === 'string' &&
    Array.isArray(r.components) &&
    r.components.length > 0 &&
    r.components.every(isVarianceComponent)
  );
}

function extractData(args: Record<string, unknown>): VarianceData | null {
  if (isVarianceData(args)) return args;
  return null;
}

// --- State ---

let chart: echarts.ECharts | null = null;

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

function buildKpiStrip(data: VarianceData): void {
  const strip = document.getElementById('kpi-strip');
  if (!strip) return;

  const delta = data.current_boe - data.base_boe;
  const deltaColor = delta >= 0 ? FP_POSITIVE : FP_NEGATIVE;
  const deltaSign = delta >= 0 ? '+' : '';

  strip.replaceChildren();

  const kpis: Array<{ value: string; label: string; color?: string }> = [
    { value: fmtNum(data.base_boe), label: 'Base BOE/D' },
    { value: fmtNum(data.current_boe), label: 'Current BOE/D' },
    { value: `${deltaSign}${fmtNum(delta)}`, label: 'Delta BOE/D', color: deltaColor },
    { value: data.period_label, label: 'Period' },
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

function buildChart(data: VarianceData): void {
  if (data.components.length === 0) {
    showError('No variance components provided.');
    return;
  }

  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';

  buildKpiStrip(data);

  const container = document.getElementById('chart');
  if (!container) return;

  if (!chart) {
    chart = echarts.init(container, 'formentera');
    window.addEventListener('resize', () => chart?.resize());
  }

  // Sort components by absolute magnitude (largest first)
  const sorted = [...data.components].sort(
    (a, b) => Math.abs(b.delta_boe) - Math.abs(a.delta_boe),
  );

  // Build waterfall data:
  // Categories: [Base, ...sorted components..., Current]
  // For each bar: invisible base height, positive delta, negative delta
  const categories = ['Base', ...sorted.map((c) => c.category), 'Current'];
  const baseValues: (number | '-')[] = [];
  const positiveValues: (number | '-')[] = [];
  const negativeValues: (number | '-')[] = [];

  // "Base" total bar
  baseValues.push(0);
  positiveValues.push(data.base_boe);
  negativeValues.push('-');

  // Running total for waterfall
  let running = data.base_boe;
  for (const comp of sorted) {
    if (comp.delta_boe >= 0) {
      baseValues.push(running);
      positiveValues.push(comp.delta_boe);
      negativeValues.push('-');
      running += comp.delta_boe;
    } else {
      const absVal = Math.abs(comp.delta_boe);
      baseValues.push(running - absVal);
      positiveValues.push('-');
      negativeValues.push(absVal);
      running -= absVal;
    }
  }

  // "Current" total bar
  baseValues.push(0);
  positiveValues.push(data.current_boe);
  negativeValues.push('-');

  // Label formatting for total bars
  const labelFormatter = (params: { dataIndex: number; value: unknown }) => {
    const val = params.value;
    if (typeof val !== 'number' || val === 0) return '';
    const idx = params.dataIndex;
    if (idx === 0 || idx === categories.length - 1) return fmtNum(val);
    return '';
  };

  const option: ECOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: FP_NAVY,
      borderColor: FP_NAVY,
      textStyle: { color: '#FFFFFF', fontFamily: 'Arial, sans-serif', fontSize: 12 },
      formatter: (params: unknown) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const p = params[0] as { axisValue: string; dataIndex: number };
        const idx = p.dataIndex;
        const catName = p.axisValue;

        // Total bars
        if (idx === 0) return `<b>${catName}</b><br/>BOE/D: ${fmtNum(data.base_boe)}`;
        if (idx === categories.length - 1) return `<b>${catName}</b><br/>BOE/D: ${fmtNum(data.current_boe)}`;

        // Delta bar
        const comp = sorted[idx - 1];
        const sign = comp.delta_boe >= 0 ? '+' : '';
        return `<b>${catName}</b><br/>Delta: ${sign}${fmtNum(comp.delta_boe)} BOE/D`;
      },
    },
    grid: { left: 70, right: 24, top: 24, bottom: 40 },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        color: FP_GRAY,
        fontSize: 11,
        rotate: categories.length > 8 ? 30 : 0,
        interval: 0,
      },
      axisLine: { lineStyle: { color: FP_LIGHT_GRAY } },
    },
    yAxis: {
      type: 'value',
      name: 'BOE/D',
      nameTextStyle: { color: FP_GRAY, fontSize: 11 },
      axisLabel: { color: FP_GRAY, fontSize: 11 },
      axisLine: { lineStyle: { color: FP_LIGHT_GRAY } },
      splitLine: { lineStyle: { color: FP_LIGHT_GRAY } },
    },
    series: [
      // Invisible base (transparent)
      {
        name: 'Base',
        type: 'bar',
        stack: 'waterfall',
        data: baseValues,
        itemStyle: { color: 'transparent', borderColor: 'transparent' },
        emphasis: { itemStyle: { color: 'transparent', borderColor: 'transparent' } },
        tooltip: { show: false },
      },
      // Positive deltas + total bars
      {
        name: 'Increase',
        type: 'bar',
        stack: 'waterfall',
        data: positiveValues.map((v, i) => ({
          value: v,
          itemStyle: {
            color: (i === 0 || i === categories.length - 1) ? FP_NAVY : FP_POSITIVE,
          },
        })),
        label: {
          show: true,
          position: 'top',
          fontSize: 11,
          color: FP_GRAY,
          formatter: labelFormatter,
        },
      },
      // Negative deltas
      {
        name: 'Decrease',
        type: 'bar',
        stack: 'waterfall',
        data: negativeValues,
        itemStyle: { color: FP_NEGATIVE },
        label: {
          show: true,
          position: 'bottom',
          fontSize: 11,
          color: FP_GRAY,
          formatter: (params: { value: unknown }) => {
            if (typeof params.value !== 'number' || params.value === 0) return '';
            return `-${fmtNum(params.value)}`;
          },
        },
      },
    ],
  };

  chart.setOption(option, true);
}

// --- Initialize ---

createViewApp('Variance Waterfall', '0.1.0', {
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
      showError('No variance data received.');
    }
  },
  onToolCancelled: () => {
    showError('Tool call was cancelled.');
  },
  onPause: () => {},
  onResume: () => { chart?.resize(); },
});

import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import type { LineSeriesOption } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
} from 'echarts/components';
import type {
  GridComponentOption,
  TooltipComponentOption,
  LegendComponentOption,
  DataZoomComponentOption,
  MarkLineComponentOption,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ComposeOption } from 'echarts/core';
import { createViewApp } from './shared/lifecycle.ts';
import { showError } from './shared/errors.ts';
import {
  FP_ECHARTS_THEME,
  FP_GRAY,
  FP_LIGHT_GRAY,
  FP_OFF_WHITE,
  FP_NAVY,
  PVT_PROPERTY_COLORS,
  FP_CAUTION,
} from './shared/colors.ts';
import { fmtNum, fmtDec, fmtPressure } from './shared/format.ts';

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  CanvasRenderer,
]);

type ECOption = ComposeOption<
  | LineSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | DataZoomComponentOption
  | MarkLineComponentOption
>;

echarts.registerTheme('formentera', FP_ECHARTS_THEME);

// --- Types ---

interface PvtPoint {
  pressure_psi: number;
  bo?: number;
  bg?: number;
  rs?: number;
  oil_viscosity_cp?: number;
  gas_viscosity_cp?: number;
  oil_density?: number;
  gas_density?: number;
  z_factor?: number;
}

interface PvtData {
  well_name: string;
  bubble_point_psi?: number;
  properties: PvtPoint[];
}

// --- Property metadata ---

interface PropertyMeta {
  key: keyof PvtPoint;
  label: string;
  unit: string;
  axisGroup: 'fvf' | 'gor' | 'viscosity' | 'density' | 'zfactor';
  color: string;
}

const PROPERTY_DEFS: PropertyMeta[] = [
  { key: 'bo', label: 'Bo', unit: 'RB/STB', axisGroup: 'fvf', color: PVT_PROPERTY_COLORS.bo },
  { key: 'bg', label: 'Bg', unit: 'RB/SCF', axisGroup: 'fvf', color: PVT_PROPERTY_COLORS.bg },
  { key: 'rs', label: 'Rs', unit: 'SCF/STB', axisGroup: 'gor', color: PVT_PROPERTY_COLORS.rs },
  { key: 'oil_viscosity_cp', label: 'μo', unit: 'cp', axisGroup: 'viscosity', color: PVT_PROPERTY_COLORS.oil_viscosity },
  { key: 'gas_viscosity_cp', label: 'μg', unit: 'cp', axisGroup: 'viscosity', color: PVT_PROPERTY_COLORS.gas_viscosity },
  { key: 'oil_density', label: 'ρo', unit: 'lb/ft³', axisGroup: 'density', color: PVT_PROPERTY_COLORS.oil_density },
  { key: 'gas_density', label: 'ρg', unit: 'lb/ft³', axisGroup: 'density', color: PVT_PROPERTY_COLORS.gas_density },
  { key: 'z_factor', label: 'Z', unit: '', axisGroup: 'zfactor', color: PVT_PROPERTY_COLORS.z_factor },
];

// --- Type guards ---

function isPvtPoint(v: unknown): v is PvtPoint {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.pressure_psi === 'number';
}

function isPvtData(v: unknown): v is PvtData {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.well_name === 'string' &&
    Array.isArray(r.properties) &&
    r.properties.length > 0 &&
    r.properties.every(isPvtPoint)
  );
}

function extractData(args: Record<string, unknown>): PvtData | null {
  if (isPvtData(args)) return args;
  return null;
}

// --- State ---

let chart: echarts.ECharts | null = null;

// --- UI helpers ---

function buildKpiStrip(data: PvtData): void {
  const strip = document.getElementById('kpi-strip');
  if (!strip) return;

  strip.replaceChildren();

  const kpis: Array<{ value: string; label: string }> = [
    { value: data.well_name, label: 'Well' },
  ];

  if (data.bubble_point_psi != null) {
    kpis.push({ value: fmtPressure(data.bubble_point_psi), label: 'Bubble Point' });
  }

  // Find Bo and Rs at bubble point (or at max pressure)
  const sorted = [...data.properties].sort((a, b) => a.pressure_psi - b.pressure_psi);
  const pbPoint = data.bubble_point_psi != null
    ? sorted.reduce((best, p) =>
        Math.abs(p.pressure_psi - data.bubble_point_psi!) < Math.abs(best.pressure_psi - data.bubble_point_psi!)
          ? p : best
      )
    : null;

  if (pbPoint?.bo != null) {
    kpis.push({ value: fmtDec(pbPoint.bo), label: 'Bo at Pb' });
  }
  if (pbPoint?.rs != null) {
    kpis.push({ value: fmtNum(pbPoint.rs), label: 'Rs at Pb' });
  }

  kpis.push({ value: `${data.properties.length}`, label: 'Data Points' });

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

function buildChart(data: PvtData): void {
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';

  const container = document.getElementById('chart');
  if (!container) return;

  if (!chart) {
    chart = echarts.init(container, 'formentera');
    window.addEventListener('resize', () => chart?.resize());
  }

  const sorted = [...data.properties].sort((a, b) => a.pressure_psi - b.pressure_psi);
  const pressures = sorted.map((d) => d.pressure_psi);

  // Determine which properties have data
  const availableProps = PROPERTY_DEFS.filter((prop) =>
    sorted.some((d) => d[prop.key] != null),
  );

  if (availableProps.length === 0) {
    showError('No PVT property data found in input.');
    return;
  }

  // Build Y-axes for each axis group that has data
  const activeGroups = [...new Set(availableProps.map((p) => p.axisGroup))];

  // Limit to 2 Y-axes for readability: left (first group) + right (second group)
  const leftGroup = activeGroups[0];
  const rightGroup = activeGroups.length > 1 ? activeGroups[1] : null;

  const leftProps = availableProps.filter((p) => p.axisGroup === leftGroup);
  const rightProps = rightGroup ? availableProps.filter((p) => p.axisGroup === rightGroup) : [];
  const otherProps = availableProps.filter(
    (p) => p.axisGroup !== leftGroup && p.axisGroup !== rightGroup,
  );

  const leftLabel = leftProps.map((p) => `${p.label} (${p.unit})`).join(' / ');
  const rightLabel = rightProps.map((p) => `${p.label} (${p.unit})`).join(' / ');

  const yAxes: ECOption['yAxis'] = [
    {
      type: 'value',
      name: leftLabel,
      nameTextStyle: { color: FP_GRAY, fontSize: 11 },
      axisLabel: { color: FP_GRAY, fontSize: 11 },
      axisLine: { lineStyle: { color: FP_LIGHT_GRAY } },
      splitLine: { lineStyle: { color: FP_LIGHT_GRAY } },
    },
  ];

  if (rightProps.length > 0) {
    yAxes.push({
      type: 'value',
      name: rightLabel,
      nameTextStyle: { color: FP_GRAY, fontSize: 11 },
      axisLabel: { color: FP_GRAY, fontSize: 11 },
      axisLine: { lineStyle: { color: FP_LIGHT_GRAY } },
      splitLine: { show: false },
    });
  }

  // Build series
  const series: LineSeriesOption[] = [];

  const addSeries = (prop: PropertyMeta, yAxisIdx: number) => {
    const seriesData = sorted
      .map((d) => [d.pressure_psi, d[prop.key] ?? null] as [number, number | null])
      .filter((d) => d[1] !== null);

    const markLine: LineSeriesOption['markLine'] =
      data.bubble_point_psi != null && series.length === 0
        ? {
            silent: true,
            symbol: 'none',
            lineStyle: { color: FP_CAUTION, type: 'dashed', width: 1.5 },
            label: { formatter: 'Pb', color: FP_CAUTION, fontSize: 10 },
            data: [{ xAxis: data.bubble_point_psi }],
          }
        : undefined;

    series.push({
      name: `${prop.label} (${prop.unit})`,
      type: 'line',
      data: seriesData,
      yAxisIndex: yAxisIdx,
      symbol: 'circle',
      symbolSize: 4,
      lineStyle: { color: prop.color, width: 2 },
      itemStyle: { color: prop.color },
      markLine,
    });
  };

  for (const prop of leftProps) addSeries(prop, 0);
  for (const prop of rightProps) addSeries(prop, 1);
  // Other groups on right axis (or left if no right)
  for (const prop of otherProps) addSeries(prop, rightProps.length > 0 ? 1 : 0);

  buildKpiStrip(data);

  const option: ECOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: FP_NAVY,
      borderColor: FP_NAVY,
      textStyle: { color: '#FFFFFF', fontFamily: 'Arial, sans-serif', fontSize: 12 },
      axisPointer: { type: 'cross', crossStyle: { color: FP_LIGHT_GRAY } },
    },
    legend: {
      show: true,
      bottom: 36,
      textStyle: { color: FP_GRAY, fontSize: 11 },
    },
    grid: {
      left: 70,
      right: rightProps.length > 0 ? 80 : 24,
      top: 16,
      bottom: 80,
    },
    xAxis: {
      type: 'value',
      name: 'Pressure (psi)',
      nameTextStyle: { color: FP_GRAY, fontSize: 11 },
      axisLabel: { color: FP_GRAY, fontSize: 11 },
      axisLine: { lineStyle: { color: FP_LIGHT_GRAY } },
      min: Math.min(...pressures),
      max: Math.max(...pressures),
    },
    yAxis: yAxes,
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

// --- Initialize ---

createViewApp('PVT Properties', '0.1.0', {
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
      showError('No PVT data received.');
    }
  },
  onToolCancelled: () => {
    showError('Tool call was cancelled.');
  },
  onPause: () => {},
  onResume: () => { chart?.resize(); },
  onTeardown: () => { chart?.dispose(); chart = null; },
});

import * as echarts from 'echarts/core';
import { LineChart, ScatterChart } from 'echarts/charts';
import type { LineSeriesOption, ScatterSeriesOption } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
} from 'echarts/components';
import type {
  GridComponentOption,
  TooltipComponentOption,
  LegendComponentOption,
  DataZoomComponentOption,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ComposeOption } from 'echarts/core';
import { createViewApp } from './shared/lifecycle.ts';
import { showError } from './shared/errors.ts';
import {
  FP_ECHARTS_THEME,
  FP_NAVY,
  FP_PURPLE,
  FP_GRAY,
  FP_LIGHT_GRAY,
  FP_OFF_WHITE,
  SCENARIO_COLORS,
  FP_CHART_COLORS_BASE,
} from './shared/colors.ts';
import { fmtNum } from './shared/format.ts';
import {
  generateForecast,
  calculateEur,
  fitExponential,
} from './shared/decline-math.ts';
import type { DeclineParams } from './shared/decline-math.ts';

echarts.use([
  LineChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

type ECOption = ComposeOption<
  | LineSeriesOption
  | ScatterSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | DataZoomComponentOption
>;

echarts.registerTheme('formentera', FP_ECHARTS_THEME);

// --- Types ---

interface ActualPoint {
  date: string;
  oil_bbl: number;
}

interface ForecastInput {
  method: string;
  ip: number;
  di: number;
  b: number;
  months: number;
}

interface AutoFitInput {
  fit: true;
  months: number;
}

interface PreComputedForecast {
  rates: ActualPoint[];
  label?: string;
}

interface ScenarioCase {
  label: string;
  rates: ActualPoint[];
  eur_bbl?: number;
  params?: { method: string; ip: number; di: number; b: number };
}

interface TypeCurve {
  label: string;
  rates: Array<{ month: number; oil_bbl: number }>;
}

interface DeclineData {
  well_name: string;
  actual: ActualPoint[];
  forecast?: ForecastInput | AutoFitInput | PreComputedForecast;
  scenarios?: ScenarioCase[];
  type_curve?: TypeCurve;
}

// --- Type guards ---

function isActualPoint(v: unknown): v is ActualPoint {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.date === 'string' && typeof r.oil_bbl === 'number';
}

function isDeclineData(v: unknown): v is DeclineData {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.well_name === 'string' &&
    Array.isArray(r.actual) &&
    r.actual.length > 0 &&
    r.actual.every(isActualPoint)
  );
}

function extractData(args: Record<string, unknown>): DeclineData | null {
  if (isDeclineData(args)) return args;
  return null;
}

function isForecastInput(v: unknown): v is ForecastInput {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.method === 'string' &&
    typeof r.ip === 'number' &&
    typeof r.di === 'number' &&
    typeof r.b === 'number' &&
    typeof r.months === 'number'
  );
}

function isAutoFitInput(v: unknown): v is AutoFitInput {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return r.fit === true && typeof r.months === 'number';
}

function isPreComputedForecast(v: unknown): v is PreComputedForecast {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return Array.isArray(r.rates) && r.rates.length > 0 && r.rates.every(isActualPoint);
}

// --- Scenario color resolution ---

function scenarioColor(label: string, index: number): string {
  const lower = label.toLowerCase();
  if (lower.includes('p90')) return SCENARIO_COLORS.p90;
  if (lower.includes('p50')) return SCENARIO_COLORS.p50;
  if (lower.includes('p10')) return SCENARIO_COLORS.p10;
  if (lower.includes('best') || lower.includes('fit')) return SCENARIO_COLORS.best_fit;
  return FP_CHART_COLORS_BASE[index % FP_CHART_COLORS_BASE.length];
}

// --- State ---

let chart: echarts.ECharts | null = null;

// --- UI helpers ---

function buildKpiStrip(
  data: DeclineData,
  eurBbl: number | null,
  params: DeclineParams | null,
): void {
  const strip = document.getElementById('kpi-strip');
  if (!strip) return;

  const peakOil = Math.max(...data.actual.map((d) => d.oil_bbl));
  const latestOil = data.actual[data.actual.length - 1].oil_bbl;

  strip.replaceChildren();

  const kpis: Array<{ value: string; label: string }> = [
    { value: data.well_name, label: 'Well' },
    { value: fmtNum(peakOil), label: 'Peak Oil BBL/D' },
    { value: fmtNum(latestOil), label: 'Latest BBL/D' },
  ];

  if (params) {
    kpis.push({ value: params.method, label: 'Decline Type' });
    kpis.push({ value: `${(params.di * 100).toFixed(1)}%/mo`, label: 'Di' });
  }
  if (eurBbl !== null) {
    kpis.push({ value: `${fmtNum(Math.round(eurBbl / 1000))}K`, label: 'EUR BBL' });
  }

  // Show scenario EURs if available
  if (data.scenarios) {
    for (const sc of data.scenarios) {
      if (sc.eur_bbl != null) {
        kpis.push({ value: `${fmtNum(Math.round(sc.eur_bbl / 1000))}K`, label: `EUR ${sc.label}` });
      }
    }
  }

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

function buildChart(data: DeclineData): void {
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';

  const container = document.getElementById('chart');
  if (!container) return;

  if (!chart) {
    chart = echarts.init(container, 'formentera');
    window.addEventListener('resize', () => chart?.resize());
  }

  // Sort actual data by date
  const sorted = [...data.actual].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const dates = sorted.map((d) => d.date);
  const rates = sorted.map((d) => d.oil_bbl);

  // Filter zeros for log axis safety (log(0) is undefined, ECharts #17725)
  const series: (LineSeriesOption | ScatterSeriesOption)[] = [
    {
      name: 'Actual',
      type: 'scatter',
      data: sorted.filter((d) => d.oil_bbl > 0).map((d) => [d.date, d.oil_bbl]),
      symbolSize: 5,
      itemStyle: { color: FP_NAVY },
    },
  ];

  // Resolve forecast params (original Arps / auto-fit / pre-computed)
  let declineParams: DeclineParams | null = null;
  let eurBbl: number | null = null;

  if (data.forecast) {
    if (isAutoFitInput(data.forecast)) {
      const fit = fitExponential(rates);
      if (fit) {
        declineParams = {
          method: 'exponential',
          ip: fit.ip,
          di: fit.di,
          b: 0,
          months: data.forecast.months,
        };
      }
    } else if (isPreComputedForecast(data.forecast)) {
      // Pre-computed rates from whitson DCA — render directly
      const forecastData = data.forecast.rates
        .filter((d) => d.oil_bbl > 0)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      series.push({
        name: data.forecast.label ?? 'Forecast',
        type: 'line',
        data: forecastData.map((d) => [d.date, d.oil_bbl]),
        symbol: 'none',
        lineStyle: { color: FP_PURPLE, width: 2, type: 'dashed' },
        itemStyle: { color: FP_PURPLE },
      });
    } else if (isForecastInput(data.forecast)) {
      const method = (['exponential', 'hyperbolic', 'harmonic'].includes(data.forecast.method)
        ? data.forecast.method
        : 'exponential') as DeclineParams['method'];
      declineParams = {
        method,
        ip: data.forecast.ip,
        di: data.forecast.di,
        b: data.forecast.b,
        months: data.forecast.months,
      };
    }

    if (declineParams) {
      const forecastRates = generateForecast(declineParams);
      eurBbl = calculateEur(declineParams);

      const lastDate = new Date(dates[dates.length - 1]);
      const forecastDates = forecastRates.map((_, i) => {
        const d = new Date(lastDate);
        d.setMonth(d.getMonth() + i);
        return d.toISOString().slice(0, 10);
      });

      series.push({
        name: 'Forecast',
        type: 'line',
        data: forecastDates.map((d, i) => [d, forecastRates[i]]),
        symbol: 'none',
        lineStyle: { color: FP_PURPLE, width: 2, type: 'dashed' },
        itemStyle: { color: FP_PURPLE },
      });
    }
  }

  // --- Scenarios (P10/P50/P90 or saved cases from whitson DCA) ---
  if (data.scenarios && data.scenarios.length > 0) {
    // Sort scenarios for consistent band rendering: P90 first (optimistic), then P50, then P10
    const scenariosSorted = [...data.scenarios];

    // Find P10/P90 pair for confidence band
    const p10 = scenariosSorted.find((s) => s.label.toLowerCase().includes('p10'));
    const p90 = scenariosSorted.find((s) => s.label.toLowerCase().includes('p90'));

    // If we have both P10 and P90, render a confidence band between them
    if (p10 && p90) {
      const p90Sorted = [...p90.rates]
        .filter((d) => d.oil_bbl > 0)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const p10Sorted = [...p10.rates]
        .filter((d) => d.oil_bbl > 0)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Build a date-aligned map for the band
      const bandDates = new Set([
        ...p90Sorted.map((d) => d.date),
        ...p10Sorted.map((d) => d.date),
      ]);
      const p90Map = new Map(p90Sorted.map((d) => [d.date, d.oil_bbl]));
      const p10Map = new Map(p10Sorted.map((d) => [d.date, d.oil_bbl]));

      const bandDatesSorted = [...bandDates].sort();

      // Upper band (P90 line, filled down to P10)
      series.push({
        name: 'P90-P10 Band',
        type: 'line',
        data: bandDatesSorted.map((d) => [d, p90Map.get(d) ?? null]),
        symbol: 'none',
        lineStyle: { opacity: 0 },
        areaStyle: { color: FP_NAVY, opacity: 0.08 },
        z: -1,
      });
      // Lower band boundary (P10, invisible line for area fill reference)
      series.push({
        name: '_p10_band',
        type: 'line',
        data: bandDatesSorted.map((d) => [d, p10Map.get(d) ?? null]),
        symbol: 'none',
        lineStyle: { opacity: 0 },
        stack: undefined,
        z: -1,
      });
    }

    // Render each scenario as a line
    for (let i = 0; i < scenariosSorted.length; i++) {
      const sc = scenariosSorted[i];
      const scData = [...sc.rates]
        .filter((d) => d.oil_bbl > 0)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const color = scenarioColor(sc.label, i);
      const isP50 = sc.label.toLowerCase().includes('p50');

      series.push({
        name: sc.label,
        type: 'line',
        data: scData.map((d) => [d.date, d.oil_bbl]),
        symbol: 'none',
        lineStyle: {
          color,
          width: isP50 ? 2.5 : 1.5,
          type: isP50 ? 'solid' : 'dashed',
        },
        itemStyle: { color },
      });
    }
  }

  // --- Type curve overlay ---
  if (data.type_curve && data.type_curve.rates.length > 0) {
    // Convert month indices to calendar dates relative to first production
    const firstProdDate = new Date(dates[0]);
    const tcData = data.type_curve.rates
      .filter((d) => d.oil_bbl > 0)
      .sort((a, b) => a.month - b.month)
      .map((d) => {
        const tcDate = new Date(firstProdDate);
        tcDate.setMonth(tcDate.getMonth() + d.month);
        return [tcDate.toISOString().slice(0, 10), d.oil_bbl] as [string, number];
      });

    series.push({
      name: `TC: ${data.type_curve.label}`,
      type: 'line',
      data: tcData,
      symbol: 'none',
      lineStyle: {
        color: SCENARIO_COLORS.type_curve,
        width: 2,
        type: [8, 4], // Long dash
      },
      itemStyle: { color: SCENARIO_COLORS.type_curve },
    });
  }

  buildKpiStrip(data, eurBbl, declineParams);

  const option: ECOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: FP_NAVY,
      borderColor: FP_NAVY,
      textStyle: { color: '#FFFFFF', fontFamily: 'Arial, sans-serif', fontSize: 12 },
    },
    legend: {
      show: true,
      bottom: 36,
      textStyle: { color: FP_GRAY, fontSize: 11 },
      // Hide internal band series from legend
      data: series
        .filter((s) => s.name !== '_p10_band' && s.name !== 'P90-P10 Band')
        .map((s) => s.name as string),
    },
    grid: { left: 70, right: 24, top: 16, bottom: 80 },
    xAxis: {
      type: 'time',
      axisLabel: { color: FP_GRAY, fontSize: 11 },
      axisLine: { lineStyle: { color: FP_LIGHT_GRAY } },
    },
    yAxis: {
      type: 'log',
      name: 'BBL/D',
      min: 1, // Prevent log(0); acts as visual economic limit
      nameTextStyle: { color: FP_GRAY, fontSize: 11 },
      axisLabel: { color: FP_GRAY, fontSize: 11 },
      axisLine: { lineStyle: { color: FP_LIGHT_GRAY } },
      splitLine: { lineStyle: { color: FP_LIGHT_GRAY } },
    },
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

createViewApp('Decline Curve', '0.2.0', {
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
      showError('No decline data received.');
    }
  },
  onToolCancelled: () => {
    showError('Tool call was cancelled.');
  },
  onPause: () => {},
  onResume: () => { chart?.resize(); },
  onTeardown: () => { chart?.dispose(); chart = null; },
});

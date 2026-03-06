import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import type { LineSeriesOption } from 'echarts/charts';
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
import {
  COMMODITY_COLORS,
  FP_ECHARTS_THEME,
  FP_NAVY,
  FP_GRAY,
  FP_LIGHT_GRAY,
  FP_OFF_WHITE,
} from './shared/colors.ts';
import { fmtNum } from './shared/format.ts';
import { showError } from './shared/errors.ts';

// Register required ECharts components (tree-shaking)
echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

type ECOption = ComposeOption<
  | LineSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | DataZoomComponentOption
>;

// Register Formentera brand theme
echarts.registerTheme('formentera', FP_ECHARTS_THEME);

// --- Type guard for production data (no `as` assertions on external input) ---

interface ProductionRecord {
  date: string;
  oil_bbl: number;
  gas_mcf: number;
  water_bbl: number;
  well_name: string;
  boe?: number;
  is_forecast?: boolean;
}

function isProductionRecord(v: unknown): v is ProductionRecord {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.date === 'string' &&
    typeof r.oil_bbl === 'number' &&
    typeof r.gas_mcf === 'number' &&
    typeof r.water_bbl === 'number' &&
    typeof r.well_name === 'string'
  );
}

function extractData(args: Record<string, unknown>): ProductionRecord[] | null {
  const raw = args.data;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const valid = raw.filter(isProductionRecord);
  return valid.length > 0 ? valid : null;
}

// --- State ---

let chart: echarts.ECharts | null = null;
let currentData: ProductionRecord[] = [];
let chartDates: string[] = [];
let logScale = false;
let dataZoomWired = false;
const visibleStreams = { oil: true, gas: true, water: true };

// --- UI helpers ---

function buildKpiStrip(data: ProductionRecord[]): void {
  const strip = document.getElementById('kpi-strip');
  if (!strip) return;

  const wells = [...new Set(data.map((d) => d.well_name))];
  const latestDate = data.reduce(
    (max, d) => (d.date > max ? d.date : max),
    data[0].date,
  );
  const latest = data.filter((d) => d.date === latestDate && !d.is_forecast);
  const totalOil = latest.reduce((s, d) => s + d.oil_bbl, 0);
  const totalGas = latest.reduce((s, d) => s + d.gas_mcf, 0);
  const totalWater = latest.reduce((s, d) => s + d.water_bbl, 0);

  // Build KPIs with createElement (no innerHTML — avoids XSS)
  strip.replaceChildren();

  const kpis: Array<{ value: string; label: string; color?: string }> = [
    { value: String(wells.length), label: 'Wells' },
    { value: fmtNum(totalOil), label: 'Oil BBL/D', color: COMMODITY_COLORS.oil },
    { value: fmtNum(totalGas), label: 'Gas MCF/D', color: COMMODITY_COLORS.gas },
    { value: fmtNum(totalWater), label: 'Water BBL/D', color: COMMODITY_COLORS.water },
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

function buildChart(data: ProductionRecord[]): void {
  if (data.length === 0) {
    showError('No production data provided.');
    return;
  }

  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';
  const toolbar = document.getElementById('toolbar');
  if (toolbar) toolbar.style.display = 'flex';

  buildKpiStrip(data);

  const container = document.getElementById('chart');
  if (!container) return;

  if (!chart) {
    chart = echarts.init(container, 'formentera');
    window.addEventListener('resize', () => chart?.resize());
  }

  // Aggregate by date across wells
  const byDate = new Map<string, { oil: number; gas: number; water: number; forecast: boolean }>();
  for (const row of data) {
    const existing = byDate.get(row.date) ?? { oil: 0, gas: 0, water: 0, forecast: false };
    existing.oil += row.oil_bbl;
    existing.gas += row.gas_mcf;
    existing.water += row.water_bbl;
    if (row.is_forecast) existing.forecast = true;
    byDate.set(row.date, existing);
  }

  const dates = [...byDate.keys()].sort();
  chartDates = dates;
  const oilValues = dates.map((d) => byDate.get(d)?.oil ?? 0);
  const gasValues = dates.map((d) => byDate.get(d)?.gas ?? 0);
  const waterValues = dates.map((d) => byDate.get(d)?.water ?? 0);
  const forecastMask = dates.map((d) => byDate.get(d)?.forecast ?? false);

  // Build series with forecast split (dashed purple lines)
  const makeSeries = (
    name: string,
    values: number[],
    color: string,
    yAxisIndex: number,
  ): LineSeriesOption[] => {
    const actual = values.map((v, i) => (forecastMask[i] ? null : v));
    const forecast = values.map((v, i) => (forecastMask[i] ? v : null));
    const hasForecast = forecast.some((v) => v !== null);

    const series: LineSeriesOption[] = [
      {
        name,
        type: 'line',
        yAxisIndex,
        data: actual,
        symbol: 'none',
        lineStyle: { color, width: 2 },
        itemStyle: { color },
        areaStyle: { color: `${color}18` },
      },
    ];

    if (hasForecast) {
      series.push({
        name: `${name} (Forecast)`,
        type: 'line',
        yAxisIndex,
        data: forecast,
        symbol: 'none',
        lineStyle: { color: COMMODITY_COLORS.forecast, width: 2, type: 'dashed' },
        itemStyle: { color: COMMODITY_COLORS.forecast },
      });
    }

    return series;
  };

  const series: LineSeriesOption[] = [];
  if (visibleStreams.oil) series.push(...makeSeries('Oil (BBL/D)', oilValues, COMMODITY_COLORS.oil, 0));
  if (visibleStreams.gas) series.push(...makeSeries('Gas (MCF/D)', gasValues, COMMODITY_COLORS.gas, 1));
  if (visibleStreams.water) series.push(...makeSeries('Water (BBL/D)', waterValues, COMMODITY_COLORS.water, 0));

  const option: ECOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: FP_NAVY,
      borderColor: FP_NAVY,
      textStyle: { color: '#FFFFFF', fontFamily: 'Arial, sans-serif', fontSize: 12 },
    },
    legend: { show: false },
    grid: { left: 70, right: 70, top: 16, bottom: 60 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { color: FP_GRAY, fontSize: 11 },
      axisLine: { lineStyle: { color: FP_LIGHT_GRAY } },
    },
    yAxis: [
      {
        type: logScale ? 'log' : 'value',
        name: 'BBL/D',
        min: logScale ? 1 : undefined,
        nameTextStyle: { color: FP_GRAY, fontSize: 11 },
        axisLabel: { color: FP_GRAY, fontSize: 11 },
        axisLine: { lineStyle: { color: FP_LIGHT_GRAY } },
        splitLine: { lineStyle: { color: FP_LIGHT_GRAY } },
      },
      {
        type: logScale ? 'log' : 'value',
        name: 'MCF/D',
        min: logScale ? 1 : undefined,
        nameTextStyle: { color: FP_GRAY, fontSize: 11 },
        axisLabel: { color: FP_GRAY, fontSize: 11 },
        axisLine: { lineStyle: { color: FP_LIGHT_GRAY } },
        splitLine: { show: false },
      },
    ],
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

// --- Toolbar wiring ---

function setupToolbar(): void {
  const btnLinear = document.getElementById('btn-linear');
  const btnLog = document.getElementById('btn-log');
  const btnOil = document.getElementById('btn-oil');
  const btnGas = document.getElementById('btn-gas');
  const btnWater = document.getElementById('btn-water');

  btnLinear?.addEventListener('click', () => {
    logScale = false;
    btnLinear.classList.add('active');
    btnLog?.classList.remove('active');
    buildChart(currentData);
  });

  btnLog?.addEventListener('click', () => {
    logScale = true;
    btnLog.classList.add('active');
    btnLinear?.classList.remove('active');
    buildChart(currentData);
  });

  const toggleStream = (stream: keyof typeof visibleStreams, btn: HTMLElement) => {
    visibleStreams[stream] = !visibleStreams[stream];
    btn.classList.toggle('active', visibleStreams[stream]);
    buildChart(currentData);
  };

  btnOil?.addEventListener('click', () => toggleStream('oil', btnOil));
  btnGas?.addEventListener('click', () => toggleStream('gas', btnGas));
  btnWater?.addEventListener('click', () => toggleStream('water', btnWater));
}

// --- DataZoom -> updateModelContext ---

function setupDataZoomContext(app: ReturnType<typeof createViewApp>): void {
  if (!chart || dataZoomWired) return;
  dataZoomWired = true;

  let zoomTimeout = 0;
  chart.on('datazoom', () => {
    clearTimeout(zoomTimeout);
    zoomTimeout = window.setTimeout(() => {
      if (!chart || chartDates.length === 0) return;

      // Read zoom range — getOption() returns our own option data
      const dz = chart.getOption().dataZoom as
        | Array<{ startValue?: number; endValue?: number }>
        | undefined;
      const zoom = dz?.[0];
      if (!zoom) return;

      const startIdx = Math.max(0, Math.round(zoom.startValue ?? 0));
      const endIdx = Math.min(
        chartDates.length - 1,
        Math.round(zoom.endValue ?? chartDates.length - 1),
      );
      const wells = [...new Set(currentData.map((d) => d.well_name))];

      app.updateModelContext({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              visibleDateRange: { start: chartDates[startIdx], end: chartDates[endIdx] },
              wells,
              streamVisibility: visibleStreams,
              scaleMode: logScale ? 'log' : 'linear',
            }),
          },
        ],
      });
    }, 500);
  });
}

// --- Initialize ---

const app = createViewApp('Production Chart', '0.1.0', {
  onToolInputPartial: (args) => {
    const data = extractData(args);
    if (data) {
      currentData = data;
      buildChart(currentData);
    }
  },
  onToolInput: (args) => {
    const data = extractData(args);
    if (data) {
      currentData = data;
      buildChart(currentData);
      setupDataZoomContext(app);
    }
  },
  onToolResult: (sc) => {
    const data = extractData(sc);
    if (data) {
      currentData = data;
      buildChart(currentData);
      setupDataZoomContext(app);
    } else if (currentData.length === 0) {
      showError('No production data received.');
    }
  },
  onToolCancelled: () => {
    if (currentData.length === 0) {
      showError('Tool call was cancelled.');
    }
  },
  onPause: () => { /* ECharts auto-pauses canvas rendering when hidden */ },
  onResume: () => { chart?.resize(); },
  onTeardown: () => { chart?.dispose(); chart = null; },
});

setupToolbar();

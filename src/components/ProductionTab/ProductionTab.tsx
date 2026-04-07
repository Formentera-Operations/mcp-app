import React, { useEffect, useRef, useState, useCallback } from 'react';
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
import type { ProductionData } from '../../dashboard-app';
import { FP_ECHARTS_THEME, COMMODITY_COLORS } from './chartTheme';

// Register ECharts components
echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

// Register Formentera theme
echarts.registerTheme('formentera', FP_ECHARTS_THEME);

type ECOption = ComposeOption<
  | LineSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | DataZoomComponentOption
>;

interface ProductionTabProps {
  production: ProductionData[];
}

export function ProductionTab({ production }: ProductionTabProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [logScale, setLogScale] = useState(false);
  const [showOil, setShowOil] = useState(true);
  const [showGas, setShowGas] = useState(true);
  const [showWater, setShowWater] = useState(true);

  // Calculate KPIs
  const wells = Array.from(new Set(production.map((d) => d.well_name).filter(Boolean)));
  const latestDate = production.reduce((max, d) => (d.date > max ? d.date : max), production[0]?.date ?? '');
  const latest = production.filter((d) => d.date === latestDate && !d.is_forecast);
  const totalOil = latest.reduce((s, d) => s + d.oil_bbl, 0);
  const totalGas = latest.reduce((s, d) => s + d.gas_mcf, 0);
  const totalWater = latest.reduce((s, d) => s + (d.water_bbl ?? 0), 0);

  // Build chart
  useEffect(() => {
    if (!chartRef.current || production.length === 0) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, 'formentera');
    }

    // Aggregate by date
    const byDate = new Map<string, { oil: number; gas: number; water: number; forecast: boolean }>();
    for (const row of production) {
      const existing = byDate.get(row.date) ?? { oil: 0, gas: 0, water: 0, forecast: false };
      existing.oil += row.oil_bbl;
      existing.gas += row.gas_mcf;
      existing.water += row.water_bbl ?? 0;
      if (row.is_forecast) existing.forecast = true;
      byDate.set(row.date, existing);
    }

    const dates = [...byDate.keys()].sort();
    const oilValues = dates.map((d) => byDate.get(d)?.oil ?? 0);
    const gasValues = dates.map((d) => byDate.get(d)?.gas ?? 0);
    const waterValues = dates.map((d) => byDate.get(d)?.water ?? 0);
    const forecastMask = dates.map((d) => byDate.get(d)?.forecast ?? false);

    // Build series with forecast split
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
    if (showOil) series.push(...makeSeries('Oil (BBL/D)', oilValues, COMMODITY_COLORS.oil, 0));
    if (showGas) series.push(...makeSeries('Gas (MCF/D)', gasValues, COMMODITY_COLORS.gas, 1));
    if (showWater) series.push(...makeSeries('Water (BBL/D)', waterValues, COMMODITY_COLORS.water, 0));

    const option: ECOption = {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#001F45',
        borderColor: '#001F45',
        textStyle: { color: '#FFFFFF', fontFamily: 'Arial, sans-serif', fontSize: 12 },
      },
      legend: { show: false },
      grid: { left: 70, right: 70, top: 16, bottom: 60 },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { color: '#7F7F7F', fontSize: 11 },
        axisLine: { lineStyle: { color: '#E6E6E6' } },
      },
      yAxis: [
        {
          type: logScale ? 'log' : 'value',
          name: 'BBL/D',
          min: logScale ? 1 : undefined,
          nameTextStyle: { color: '#7F7F7F', fontSize: 11 },
          axisLabel: { color: '#7F7F7F', fontSize: 11 },
          axisLine: { lineStyle: { color: '#E6E6E6' } },
          splitLine: { lineStyle: { color: '#E6E6E6' } },
        },
        {
          type: logScale ? 'log' : 'value',
          name: 'MCF/D',
          min: logScale ? 1 : undefined,
          nameTextStyle: { color: '#7F7F7F', fontSize: 11 },
          axisLabel: { color: '#7F7F7F', fontSize: 11 },
          axisLine: { lineStyle: { color: '#E6E6E6' } },
          splitLine: { show: false },
        },
      ],
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        { type: 'slider', start: 0, end: 100, bottom: 8, height: 20 },
      ],
      series,
    };

    chartInstance.current.setOption(option, true);

    // Handle resize
    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [production, logScale, showOil, showGas, showWater]);

  // Fullscreen
  const handleFullscreen = useCallback(() => {
    window.app?.requestDisplayMode?.('fullscreen');
  }, []);

  // Format number
  const fmtNum = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

  return (
    <div style={styles.container}>
      {/* KPI strip */}
      <div style={styles.kpiStrip}>
        <div style={styles.kpi}>
          <div style={styles.kpiValue}>{wells.length}</div>
          <div style={styles.kpiLabel}>Wells</div>
        </div>
        <div style={styles.kpi}>
          <div style={{ ...styles.kpiValue, color: COMMODITY_COLORS.oil }}>{fmtNum(totalOil)}</div>
          <div style={styles.kpiLabel}>Oil BBL/D</div>
        </div>
        <div style={styles.kpi}>
          <div style={{ ...styles.kpiValue, color: COMMODITY_COLORS.gas }}>{fmtNum(totalGas)}</div>
          <div style={styles.kpiLabel}>Gas MCF/D</div>
        </div>
        <div style={styles.kpi}>
          <div style={{ ...styles.kpiValue, color: COMMODITY_COLORS.water }}>{fmtNum(totalWater)}</div>
          <div style={styles.kpiLabel}>Water BBL/D</div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={styles.toolbar}>
        <button
          onClick={() => setLogScale(false)}
          style={{ ...styles.btn, ...(logScale ? {} : styles.btnActive) }}
        >
          Linear
        </button>
        <button
          onClick={() => setLogScale(true)}
          style={{ ...styles.btn, ...(logScale ? styles.btnActive : {}) }}
        >
          Log
        </button>
        <span style={{ flex: 1 }} />
        <button
          onClick={() => setShowOil(!showOil)}
          style={{ ...styles.btn, ...(showOil ? styles.btnActive : {}), color: COMMODITY_COLORS.oil }}
        >
          Oil
        </button>
        <button
          onClick={() => setShowGas(!showGas)}
          style={{ ...styles.btn, ...(showGas ? styles.btnActive : {}), color: COMMODITY_COLORS.gas }}
        >
          Gas
        </button>
        <button
          onClick={() => setShowWater(!showWater)}
          style={{ ...styles.btn, ...(showWater ? styles.btnActive : {}), color: COMMODITY_COLORS.water }}
        >
          Water
        </button>
        <button onClick={handleFullscreen} style={styles.fullscreenBtn}>
          ⛶
        </button>
      </div>

      {/* Chart */}
      <div ref={chartRef} style={styles.chart} />
    </div>
  );
}

const FP_COLORS = {
  navy: '#001F45',
  steel: '#336699',
  lightGray: '#E6E6E6',
  offWhite: '#F2F2F2',
  white: '#FFFFFF',
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: FP_COLORS.white,
    borderRadius: '8px',
    overflow: 'hidden',
  },
  kpiStrip: {
    display: 'flex',
    gap: '16px',
    padding: '8px 16px',
    backgroundColor: FP_COLORS.offWhite,
    borderBottom: `1px solid ${FP_COLORS.lightGray}`,
  },
  kpi: {
    textAlign: 'center',
  },
  kpiValue: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: FP_COLORS.navy,
  },
  kpiLabel: {
    fontSize: '11px',
    color: '#7F7F7F',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  toolbar: {
    display: 'flex',
    gap: '8px',
    padding: '4px 16px',
    alignItems: 'center',
  },
  btn: {
    fontFamily: "'Arial', 'Helvetica Neue', Helvetica, sans-serif",
    fontSize: '11px',
    padding: '3px 10px',
    border: `1px solid ${FP_COLORS.lightGray}`,
    borderRadius: '4px',
    backgroundColor: FP_COLORS.white,
    color: FP_COLORS.navy,
    cursor: 'pointer',
  },
  btnActive: {
    backgroundColor: FP_COLORS.navy,
    color: FP_COLORS.white,
  },
  fullscreenBtn: {
    padding: '4px 8px',
    backgroundColor: FP_COLORS.steel,
    color: FP_COLORS.white,
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  chart: {
    flex: 1,
    minHeight: '300px',
  },
};

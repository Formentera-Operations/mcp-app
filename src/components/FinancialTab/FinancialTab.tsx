import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import type { BarSeriesOption } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from 'echarts/components';
import type {
  GridComponentOption,
  TooltipComponentOption,
  LegendComponentOption,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ComposeOption } from 'echarts/core';
import type { LOEData } from '../../dashboard-app';
import { FP_ECHARTS_THEME } from '../ProductionTab/chartTheme';

// Register ECharts components
echarts.use([
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
]);

// Register Formentera theme
echarts.registerTheme('formentera', FP_ECHARTS_THEME);

type ECOption = ComposeOption<
  | BarSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
>;

interface FinancialTabProps {
  loe: LOEData[];
}

export function FinancialTab({ loe }: FinancialTabProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [view, setView] = useState<'breakdown' | 'trend'>('breakdown');

  // Calculate KPIs
  const totalLOE = loe.reduce((s, d) => s + d.amount, 0);
  const categories = Array.from(new Set(loe.map((d) => d.category)));
  const periods = Array.from(new Set(loe.map((d) => d.period)));

  // LOE by category
  const loeByCategory = new Map<string, number>();
  for (const item of loe) {
    loeByCategory.set(item.category, (loeByCategory.get(item.category) ?? 0) + item.amount);
  }

  // Format currency
  const fmtCurrency = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  // Build chart
  useEffect(() => {
    if (!chartRef.current || loe.length === 0) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, 'formentera');
    }

    let option: ECOption;

    if (view === 'breakdown') {
      // Stacked bar by category
      const sortedCategories = [...loeByCategory.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([cat]) => cat);

      const series: BarSeriesOption[] = sortedCategories.map((category, idx) => ({
        name: category,
        type: 'bar',
        stack: 'total',
        data: periods.map((period) => {
          const periodItems = loe.filter((d) => d.period === period && d.category === category);
          return periodItems.reduce((s, d) => s + d.amount, 0);
        }),
        itemStyle: {
          color: FP_CHART_COLORS[idx % FP_CHART_COLORS.length],
        },
      }));

      option = {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          backgroundColor: '#001F45',
          borderColor: '#001F45',
          textStyle: { color: '#FFFFFF', fontFamily: 'Arial, sans-serif', fontSize: 12 },
          formatter: (params: unknown) => {
            const items = params as Array<{ seriesName: string; value: number }>;
            if (!Array.isArray(items)) return '';
            const total = items.reduce((s, i) => s + (i.value ?? 0), 0);
            const lines = items
              .filter((i) => i.value > 0)
              .map((i) => `${i.seriesName}: ${fmtCurrency(i.value)}`);
            return `<strong>Total: ${fmtCurrency(total)}</strong><br/>${lines.join('<br/>')}`;
          },
        },
        legend: {
          type: 'scroll',
          bottom: 0,
          textStyle: { color: '#7F7F7F', fontSize: 11 },
        },
        grid: { left: 80, right: 20, top: 20, bottom: 60 },
        xAxis: {
          type: 'category',
          data: periods,
          axisLabel: { color: '#7F7F7F', fontSize: 11 },
          axisLine: { lineStyle: { color: '#E6E6E6' } },
        },
        yAxis: {
          type: 'value',
          name: 'LOE ($)',
          nameTextStyle: { color: '#7F7F7F', fontSize: 11 },
          axisLabel: {
            color: '#7F7F7F',
            fontSize: 11,
            formatter: (v: number) => fmtCurrency(v),
          },
          axisLine: { lineStyle: { color: '#E6E6E6' } },
          splitLine: { lineStyle: { color: '#E6E6E6' } },
        },
        series,
      };
    } else {
      // Trend view - line chart over time
      option = {
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#001F45',
          borderColor: '#001F45',
          textStyle: { color: '#FFFFFF', fontFamily: 'Arial, sans-serif', fontSize: 12 },
        },
        legend: {
          type: 'scroll',
          bottom: 0,
          textStyle: { color: '#7F7F7F', fontSize: 11 },
        },
        grid: { left: 80, right: 20, top: 20, bottom: 60 },
        xAxis: {
          type: 'category',
          data: periods,
          axisLabel: { color: '#7F7F7F', fontSize: 11 },
          axisLine: { lineStyle: { color: '#E6E6E6' } },
        },
        yAxis: {
          type: 'value',
          name: 'LOE ($)',
          nameTextStyle: { color: '#7F7F7F', fontSize: 11 },
          axisLabel: {
            color: '#7F7F7F',
            fontSize: 11,
            formatter: (v: number) => fmtCurrency(v),
          },
          axisLine: { lineStyle: { color: '#E6E6E6' } },
          splitLine: { lineStyle: { color: '#E6E6E6' } },
        },
        series: categories.map((category, idx) => ({
          name: category,
          type: 'bar',
          data: periods.map((period) => {
            const periodItems = loe.filter((d) => d.period === period && d.category === category);
            return periodItems.reduce((s, d) => s + d.amount, 0);
          }),
          itemStyle: {
            color: FP_CHART_COLORS[idx % FP_CHART_COLORS.length],
          },
        })),
      };
    }

    chartInstance.current.setOption(option, true);

    // Handle resize
    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [loe, view]);

  // Fullscreen
  const handleFullscreen = useCallback(() => {
    window.app?.requestDisplayMode?.('fullscreen');
  }, []);

  return (
    <div style={styles.container}>
      {/* KPI strip */}
      <div style={styles.kpiStrip}>
        <div style={styles.kpi}>
          <div style={styles.kpiValue}>{fmtCurrency(totalLOE)}</div>
          <div style={styles.kpiLabel}>Total LOE</div>
        </div>
        <div style={styles.kpi}>
          <div style={styles.kpiValue}>{categories.length}</div>
          <div style={styles.kpiLabel}>Categories</div>
        </div>
        <div style={styles.kpi}>
          <div style={styles.kpiValue}>{periods.length}</div>
          <div style={styles.kpiLabel}>Periods</div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={styles.toolbar}>
        <button
          onClick={() => setView('breakdown')}
          style={{ ...styles.btn, ...(view === 'breakdown' ? styles.btnActive : {}) }}
        >
          Breakdown
        </button>
        <button
          onClick={() => setView('trend')}
          style={{ ...styles.btn, ...(view === 'trend' ? styles.btnActive : {}) }}
        >
          Trend
        </button>
        <span style={{ flex: 1 }} />
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

const FP_CHART_COLORS = [
  '#001F45', '#336699', '#94C1FA',
  '#3D4F5F', '#6B818C', '#A3B4BC',
  '#3D8B7A', '#8EBBB3', '#B6D3CE',
  '#553D8C', '#978CB5', '#BCB5CF',
  '#A3192B', '#BF5E6B', '#D698A0',
  '#6AAD4E', '#93C87A', '#B9DEA5',
];

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

// Formentera brand colors and ECharts theme for production charts

// Theme accent colors
export const FP_NAVY = '#001F45';
export const FP_DARK_SLATE = '#3D4F5F';
export const FP_TEAL = '#3D8B7A';
export const FP_PURPLE = '#553D8C';
export const FP_CRIMSON = '#A3192B';
export const FP_GREEN = '#6AAD4E';
export const FP_STEEL = '#336699';

// Neutrals
export const FP_WHITE = '#FFFFFF';
export const FP_LIGHT_GRAY = '#E6E6E6';
export const FP_GRAY = '#7F7F7F';
export const FP_OFF_WHITE = '#F2F2F2';

// Commodity colors
export const COMMODITY_COLORS = {
  oil: '#00B050',
  gas: '#FF0000',
  ngl: '#7030A0',
  water: '#336699',
  boe: '#FFC000',
  forecast: '#553D8C',
} as const;

// Chart color order
export const FP_CHART_COLORS = [
  '#001F45', '#336699', '#94C1FA',
  '#3D4F5F', '#6B818C', '#A3B4BC',
  '#3D8B7A', '#8EBBB3', '#B6D3CE',
  '#553D8C', '#978CB5', '#BCB5CF',
  '#A3192B', '#BF5E6B', '#D698A0',
  '#6AAD4E', '#93C87A', '#B9DEA5',
];

// ECharts theme
export const FP_ECHARTS_THEME = {
  color: FP_CHART_COLORS,
  backgroundColor: FP_WHITE,
  textStyle: {
    fontFamily: 'Arial, Helvetica Neue, Helvetica, sans-serif',
    color: FP_NAVY,
  },
  title: {
    textStyle: { color: FP_NAVY, fontWeight: 'bold' as const },
    subtextStyle: { color: FP_STEEL },
  },
  legend: {
    textStyle: { color: FP_GRAY, fontSize: 12 },
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: FP_LIGHT_GRAY } },
    axisLabel: { color: FP_GRAY },
    splitLine: { lineStyle: { color: FP_LIGHT_GRAY } },
  },
  valueAxis: {
    axisLine: { lineStyle: { color: FP_LIGHT_GRAY } },
    axisLabel: { color: FP_GRAY },
    splitLine: { lineStyle: { color: FP_LIGHT_GRAY } },
  },
  dataZoom: {
    backgroundColor: FP_OFF_WHITE,
    fillerColor: 'rgba(0,31,69,0.1)',
    handleColor: FP_STEEL,
  },
};

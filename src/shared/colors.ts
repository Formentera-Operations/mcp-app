// Formentera Partners brand palette (from fp-brand-2026)
// DO NOT change these without consulting the brand guidelines

// === Theme accent colors ===
export const FP_NAVY = '#001F45';
export const FP_DARK_SLATE = '#3D4F5F';
export const FP_TEAL = '#3D8B7A';
export const FP_PURPLE = '#553D8C';
export const FP_CRIMSON = '#A3192B';
export const FP_GREEN = '#6AAD4E';
export const FP_STEEL = '#336699';

// === Neutrals ===
export const FP_BLACK = '#000000';
export const FP_WHITE = '#FFFFFF';
export const FP_LIGHT_GRAY = '#E6E6E6';
export const FP_GRAY = '#7F7F7F';
export const FP_OFF_WHITE = '#F2F2F2';

// === Functional (indicators only — never decorative) ===
export const FP_POSITIVE = '#00B050';
export const FP_NEGATIVE = '#C00000';
export const FP_CAUTION = '#FFC000';

// === Commodity colors (override chart order for oil/gas/NGL/water) ===
export const COMMODITY_COLORS = {
  oil: '#00B050',
  gas: '#FF0000',
  ngl: '#7030A0',
  water: '#336699',
  boe: '#FFC000',
  forecast: '#553D8C',
} as const;

// === Well status colors ===
export const STATUS_COLORS: Record<string, string> = {
  producing: FP_GREEN,
  'shut-in': FP_CAUTION,
  'p&a': FP_GRAY,
  drilling: FP_STEEL,
  completing: FP_PURPLE,
};

// === Chart color order (1-18, for multi-series non-commodity charts) ===
export const FP_CHART_COLORS = [
  '#001F45', '#336699', '#94C1FA',  // Navy family
  '#3D4F5F', '#6B818C', '#A3B4BC',  // Slate family
  '#3D8B7A', '#8EBBB3', '#B6D3CE',  // Teal family
  '#553D8C', '#978CB5', '#BCB5CF',  // Purple family
  '#A3192B', '#BF5E6B', '#D698A0',  // Crimson family
  '#6AAD4E', '#93C87A', '#B9DEA5',  // Green family
];

// For <=6 series, use base colors only (positions 0, 3, 6, 9, 12, 15)
export const FP_CHART_COLORS_BASE = [
  '#001F45', '#3D4F5F', '#3D8B7A', '#553D8C', '#A3192B', '#6AAD4E',
];

// === PVT property colors (maps each fluid property to a brand accent) ===
export const PVT_PROPERTY_COLORS = {
  bo: FP_NAVY,
  rs: FP_TEAL,
  bg: FP_STEEL,
  oil_viscosity: FP_PURPLE,
  gas_viscosity: FP_CRIMSON,
  z_factor: FP_GREEN,
  oil_density: FP_DARK_SLATE,
  gas_density: '#6B818C', // Slate mid-tone
} as const;

// === DCA scenario colors (probabilistic forecasts and type curves) ===
export const SCENARIO_COLORS = {
  p90: FP_GREEN,
  p50: FP_NAVY,
  p10: FP_CRIMSON,
  best_fit: FP_STEEL,
  type_curve: FP_PURPLE,
} as const;

// === ECharts theme object ===
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

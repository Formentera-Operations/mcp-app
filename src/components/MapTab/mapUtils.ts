import type { WellData } from '../../dashboard-app';

// Formentera brand colors
const FP_COLORS = {
  navy: '#001F45',
  steel: '#336699',
  teal: '#3D8B7A',
  green: '#6AAD4E',
  caution: '#FFC000',
  gray: '#7F7F7F',
  purple: '#553D8C',
};

// Status color mapping
const STATUS_COLORS: Record<string, string> = {
  producing: FP_COLORS.green,
  'shut-in': FP_COLORS.caution,
  'shut in': FP_COLORS.caution,
  shutin: FP_COLORS.caution,
  'p&a': FP_COLORS.gray,
  pa: FP_COLORS.gray,
  drilling: FP_COLORS.steel,
  completing: FP_COLORS.purple,
  active: FP_COLORS.green,
  inactive: FP_COLORS.caution,
};

export function getStatusColor(status: string | undefined): string {
  if (!status) return FP_COLORS.gray;
  const key = status.toLowerCase();
  return STATUS_COLORS[key] ?? FP_COLORS.gray;
}

// Format number with commas
function fmtNum(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// Format currency
function fmtCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

// Build popup content for well
export function buildPopupContent(well: WellData): HTMLElement {
  const container = document.createElement('div');
  container.style.cssText = `
    font-family: Arial, Helvetica Neue, Helvetica, sans-serif;
    min-width: 180px;
  `;

  // Title
  const title = document.createElement('div');
  title.style.cssText = `
    font-size: 14px;
    font-weight: bold;
    color: ${FP_COLORS.navy};
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid #E6E6E6;
  `;
  title.textContent = well.well_name;
  container.appendChild(title);

  // Rows
  const rows: Array<[string, string]> = [];
  if (well.status) rows.push(['Status', well.status]);
  if (well.oil_rate != null) rows.push(['Oil', `${fmtNum(well.oil_rate)} BBL/D`]);
  if (well.gas_rate != null) rows.push(['Gas', `${fmtNum(well.gas_rate)} MCF/D`]);
  if (well.water_rate != null) rows.push(['Water', `${fmtNum(well.water_rate)} BBL/D`]);
  if (well.loe_per_boe != null) rows.push(['LOE/BOE', fmtCurrency(well.loe_per_boe)]);
  if (well.field) rows.push(['Field', well.field]);
  if (well.basin) rows.push(['Basin', well.basin]);

  for (const [label, value] of rows) {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
      font-size: 12px;
    `;

    const labelEl = document.createElement('span');
    labelEl.style.cssText = `color: #7F7F7F;`;
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.style.cssText = `color: ${FP_COLORS.navy}; font-weight: 500;`;
    valueEl.textContent = value;

    row.appendChild(labelEl);
    row.appendChild(valueEl);
    container.appendChild(row);
  }

  return container;
}

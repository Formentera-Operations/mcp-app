const numFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const decFmt = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});
const curFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function fmtNum(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '\u2014';
  return numFmt.format(value);
}

export function fmtDec(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '\u2014';
  return decFmt.format(value);
}

export function fmtCurrency(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '\u2014';
  return curFmt.format(value);
}

export function fmtPercent(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '\u2014';
  return `${(value * 100).toFixed(1)}%`;
}

export function fmtDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function fmtDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: '2-digit', year: '2-digit' });
}

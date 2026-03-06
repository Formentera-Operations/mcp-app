import { createViewApp } from './shared/lifecycle.ts';
import { escapeHtml } from './shared/security.ts';
import {
  FP_POSITIVE,
  FP_NEGATIVE,
} from './shared/colors.ts';
import { fmtNum, fmtCurrency, fmtPercent, fmtDate } from './shared/format.ts';

// --- Types ---

interface ColumnDef {
  key: string;
  label: string;
  type: 'string' | 'number' | 'currency' | 'date' | 'percent';
}

interface HighlightRule {
  column: string;
  condition: 'positive' | 'negative' | 'gt' | 'lt';
  color?: string;
  threshold?: number;
}

interface TableData {
  title: string;
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
  sort_by?: string;
  highlight_rules?: HighlightRule[];
}

// --- Type guards ---

function isColumnDef(v: unknown): v is ColumnDef {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.key === 'string' &&
    typeof r.label === 'string' &&
    typeof r.type === 'string' &&
    ['string', 'number', 'currency', 'date', 'percent'].includes(r.type as string)
  );
}

function isTableData(v: unknown): v is TableData {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.title === 'string' &&
    Array.isArray(r.columns) &&
    r.columns.length > 0 &&
    r.columns.every(isColumnDef) &&
    Array.isArray(r.rows)
  );
}

function extractData(args: Record<string, unknown>): TableData | null {
  if (isTableData(args)) return args;
  return null;
}

// --- State ---

let currentData: TableData | null = null;
let sortKey: string | null = null;
let sortAsc = true;
let filterText = '';
let finalized = false;

// --- Formatting ---

function formatCell(value: unknown, type: string): string {
  if (value == null) return '\u2014';
  switch (type) {
    case 'number': return fmtNum(Number(value));
    case 'currency': return fmtCurrency(Number(value));
    case 'percent': return fmtPercent(Number(value));
    case 'date': return fmtDate(String(value));
    default: return escapeHtml(String(value));
  }
}

function isNumericType(type: string): boolean {
  return type === 'number' || type === 'currency' || type === 'percent';
}

// --- Highlight evaluation ---

function evaluateHighlight(
  value: unknown,
  rules: HighlightRule[],
  columnKey: string,
): string | null {
  for (const rule of rules) {
    if (rule.column !== columnKey) continue;
    const num = Number(value);
    if (isNaN(num)) continue;

    switch (rule.condition) {
      case 'positive':
        if (num > 0) return rule.color ?? FP_POSITIVE;
        break;
      case 'negative':
        if (num < 0) return rule.color ?? FP_NEGATIVE;
        break;
      case 'gt':
        if (rule.threshold !== undefined && num > rule.threshold) return rule.color ?? FP_POSITIVE;
        break;
      case 'lt':
        if (rule.threshold !== undefined && num < rule.threshold) return rule.color ?? FP_NEGATIVE;
        break;
    }
  }
  return null;
}

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

function buildTable(data: TableData): void {
  if (data.columns.length === 0) {
    showError('No columns defined.');
    return;
  }

  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';

  const headerEl = document.getElementById('table-header');
  if (headerEl) headerEl.style.display = 'flex';
  const wrapEl = document.getElementById('table-wrap');
  if (wrapEl) wrapEl.style.display = 'block';

  const titleEl = document.getElementById('table-title');
  if (titleEl) titleEl.textContent = data.title;

  // Apply default sort if specified and not yet overridden by user
  if (data.sort_by && sortKey === null) {
    sortKey = data.sort_by;
  }

  // Filter rows
  let rows = data.rows;
  if (filterText) {
    const lower = filterText.toLowerCase();
    rows = rows.filter((row) =>
      data.columns.some((col) => {
        const val = row[col.key];
        return val != null && String(val).toLowerCase().includes(lower);
      }),
    );
  }

  // Sort rows
  if (sortKey) {
    const col = data.columns.find((c) => c.key === sortKey);
    if (col) {
      const numeric = isNumericType(col.type) || col.type === 'date';
      rows = [...rows].sort((a, b) => {
        const av = a[col.key];
        const bv = b[col.key];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        let cmp: number;
        if (numeric) {
          cmp = Number(av) - Number(bv);
        } else {
          cmp = String(av).localeCompare(String(bv));
        }
        return sortAsc ? cmp : -cmp;
      });
    }
  }

  // Update count
  const countEl = document.getElementById('table-count');
  if (countEl) countEl.textContent = `${rows.length} of ${data.rows.length} rows`;

  // Build thead
  const thead = document.getElementById('table-head');
  if (thead) {
    thead.replaceChildren();
    const tr = document.createElement('tr');
    for (const col of data.columns) {
      const th = document.createElement('th');
      const isSorted = sortKey === col.key;
      if (isSorted) th.classList.add('sorted');

      th.textContent = col.label;
      const arrow = document.createElement('span');
      arrow.className = 'sort-arrow';
      arrow.textContent = isSorted ? (sortAsc ? '\u25B2' : '\u25BC') : '\u25B2';
      th.appendChild(arrow);

      if (isNumericType(col.type)) th.style.textAlign = 'right';

      th.addEventListener('click', () => {
        if (!finalized) return;
        if (sortKey === col.key) {
          sortAsc = !sortAsc;
        } else {
          sortKey = col.key;
          sortAsc = true;
        }
        if (currentData) buildTable(currentData);
      });

      tr.appendChild(th);
    }
    thead.appendChild(tr);
  }

  // Build tbody
  const tbody = document.getElementById('table-body');
  if (tbody) {
    tbody.replaceChildren();
    const rules = data.highlight_rules ?? [];

    for (const row of rows) {
      const tr = document.createElement('tr');
      for (const col of data.columns) {
        const td = document.createElement('td');
        td.textContent = formatCell(row[col.key], col.type);
        if (isNumericType(col.type)) td.classList.add('num');

        const highlightColor = evaluateHighlight(row[col.key], rules, col.key);
        if (highlightColor) {
          td.style.color = highlightColor;
          td.style.fontWeight = 'bold';
        }

        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
  }
}

// --- Filter wiring ---

const filterInput = document.getElementById('filter-input') as HTMLInputElement | null;
let filterTimeout = 0;
filterInput?.addEventListener('input', () => {
  clearTimeout(filterTimeout);
  filterTimeout = window.setTimeout(() => {
    filterText = filterInput.value;
    if (currentData && finalized) buildTable(currentData);
  }, 200);
});

// --- Initialize ---

createViewApp('Data Table', '0.1.0', {
  onToolInputPartial: (args) => {
    const data = extractData(args);
    if (data) {
      currentData = data;
      finalized = false;
      buildTable(data);
    }
  },
  onToolInput: (args) => {
    const data = extractData(args);
    if (data) {
      currentData = data;
      finalized = true;
      buildTable(data);
    }
  },
  onToolResult: (sc) => {
    const data = extractData(sc);
    if (data) {
      currentData = data;
      finalized = true;
      buildTable(data);
    } else if (!currentData) {
      showError('No table data received.');
    }
  },
  onToolCancelled: () => {
    if (!currentData) showError('Tool call was cancelled.');
    else finalized = true;
  },
});

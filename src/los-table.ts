import { createViewApp } from './shared/lifecycle.ts';
import { fmtCurrency } from './shared/format.ts';
import { showError } from './shared/errors.ts';

// --- Types ---

interface LosLineItem {
  label: string;
  values: Record<string, number | null>;
}

interface LosCategory {
  category: string;
  subtotal: Record<string, number | null>;
  items: LosLineItem[];
}

interface LosData {
  title: string;
  entity?: string;
  periods: string[];
  sections: LosCategory[];
  grand_total?: Record<string, number | null>;
}

// --- Type guards ---

function isLosLineItem(v: unknown): v is LosLineItem {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.label === 'string' && typeof r.values === 'object' && r.values !== null;
}

function isLosCategory(v: unknown): v is LosCategory {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.category === 'string' &&
    typeof r.subtotal === 'object' && r.subtotal !== null &&
    Array.isArray(r.items) &&
    r.items.every(isLosLineItem)
  );
}

function isLosData(v: unknown): v is LosData {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.title === 'string' &&
    Array.isArray(r.periods) &&
    r.periods.every((p: unknown) => typeof p === 'string') &&
    Array.isArray(r.sections) &&
    r.sections.every(isLosCategory)
  );
}

function extractData(args: Record<string, unknown>): LosData | null {
  if (isLosData(args)) return args;
  return null;
}

// --- State ---

const collapsedCategories = new Set<string>();

// --- UI helpers ---

function fmtCell(value: number | null | undefined): string {
  if (value == null) return '\u2014';
  return fmtCurrency(value);
}

function buildTable(data: LosData): void {
  if (data.sections.length === 0) {
    showError('No LOS sections provided.');
    return;
  }

  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';

  const headerEl = document.getElementById('los-header');
  if (headerEl) headerEl.style.display = 'flex';
  const wrapEl = document.getElementById('table-wrap');
  if (wrapEl) wrapEl.style.display = 'block';

  const titleEl = document.getElementById('los-title');
  if (titleEl) titleEl.textContent = data.title;
  const subtitleEl = document.getElementById('los-subtitle');
  if (subtitleEl) subtitleEl.textContent = data.entity ?? '';

  // Build thead: [Label, ...periods, Total]
  const thead = document.getElementById('table-head');
  if (thead) {
    thead.replaceChildren();
    const tr = document.createElement('tr');

    const thLabel = document.createElement('th');
    thLabel.textContent = 'Category';
    tr.appendChild(thLabel);

    for (const period of data.periods) {
      const th = document.createElement('th');
      th.textContent = period;
      tr.appendChild(th);
    }

    const thTotal = document.createElement('th');
    thTotal.textContent = 'Total';
    tr.appendChild(thTotal);

    thead.appendChild(tr);
  }

  // Build tbody
  const tbody = document.getElementById('table-body');
  if (!tbody) return;
  tbody.replaceChildren();

  for (const section of data.sections) {
    const isCollapsed = collapsedCategories.has(section.category);

    // Category header row
    const catRow = document.createElement('tr');
    catRow.className = 'category-row';

    const catTd = document.createElement('td');
    const toggle = document.createElement('span');
    toggle.className = 'toggle-btn';
    toggle.textContent = isCollapsed ? '\u25B6' : '\u25BC';
    toggle.addEventListener('click', () => {
      if (collapsedCategories.has(section.category)) {
        collapsedCategories.delete(section.category);
      } else {
        collapsedCategories.add(section.category);
      }
      buildTable(data);
    });
    catTd.appendChild(toggle);
    catTd.appendChild(document.createTextNode(` ${section.category}`));
    catRow.appendChild(catTd);

    // Empty cells for periods + total on category row
    for (let i = 0; i <= data.periods.length; i++) {
      catRow.appendChild(document.createElement('td'));
    }
    tbody.appendChild(catRow);

    // Line item rows
    for (const item of section.items) {
      const leafRow = document.createElement('tr');
      leafRow.className = isCollapsed ? 'leaf-row leaf-hidden' : 'leaf-row';

      const labelTd = document.createElement('td');
      labelTd.textContent = item.label;
      leafRow.appendChild(labelTd);

      let rowTotal = 0;
      for (const period of data.periods) {
        const td = document.createElement('td');
        const val = item.values[period] ?? null;
        td.textContent = fmtCell(val);
        if (val != null && val < 0) td.classList.add('neg');
        if (val != null) rowTotal += val;
        leafRow.appendChild(td);
      }

      // Total column
      const totalTd = document.createElement('td');
      totalTd.textContent = fmtCell(rowTotal);
      if (rowTotal < 0) totalTd.classList.add('neg');
      leafRow.appendChild(totalTd);

      tbody.appendChild(leafRow);
    }

    // Subtotal row
    const subRow = document.createElement('tr');
    subRow.className = 'subtotal-row';

    const subLabel = document.createElement('td');
    subLabel.textContent = `Total ${section.category}`;
    subRow.appendChild(subLabel);

    let sectionTotal = 0;
    for (const period of data.periods) {
      const td = document.createElement('td');
      const val = section.subtotal[period] ?? null;
      td.textContent = fmtCell(val);
      if (val != null && val < 0) td.classList.add('neg');
      if (val != null) sectionTotal += val;
      subRow.appendChild(td);
    }

    const subTotalTd = document.createElement('td');
    subTotalTd.textContent = fmtCell(sectionTotal);
    if (sectionTotal < 0) subTotalTd.classList.add('neg');
    subRow.appendChild(subTotalTd);

    tbody.appendChild(subRow);
  }

  // Grand total row
  if (data.grand_total) {
    const grandRow = document.createElement('tr');
    grandRow.className = 'grand-total-row';

    const grandLabel = document.createElement('td');
    grandLabel.textContent = 'Net Operating Income';
    grandRow.appendChild(grandLabel);

    let grandSum = 0;
    for (const period of data.periods) {
      const td = document.createElement('td');
      const val = data.grand_total[period] ?? null;
      td.textContent = fmtCell(val);
      if (val != null) grandSum += val;
      grandRow.appendChild(td);
    }

    const grandTotalTd = document.createElement('td');
    grandTotalTd.textContent = fmtCell(grandSum);
    grandRow.appendChild(grandTotalTd);

    tbody.appendChild(grandRow);
  }
}

// --- Initialize ---

createViewApp('LOS Table', '0.1.0', {
  onToolInputPartial: (args) => {
    const data = extractData(args);
    if (data) buildTable(data);
  },
  onToolInput: (args) => {
    const data = extractData(args);
    if (data) buildTable(data);
  },
  onToolResult: (sc) => {
    const data = extractData(sc);
    if (data) {
      buildTable(data);
    } else {
      showError('No LOS data received.');
    }
  },
  onToolCancelled: () => {
    showError('Tool call was cancelled.');
  },
});

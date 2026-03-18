import { createViewApp } from './shared/lifecycle.ts';
import { fmtCurrency, fmtDate } from './shared/format.ts';
import { showError } from './shared/errors.ts';

// --- Types ---

interface FlatRow {
  period: string;
  category: string;
  line_item: string;
  amount: number;
}

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
  grand_total_label?: string;
}

// --- Constants ---

const DEFAULT_CATEGORY_ORDER = [
  'Revenue',
  'Production & Ad Valorem Taxes',
  'Lease Operating Expenses',
  'G&A',
  'Workover Expenses',
  'P & A Expenses',
  'Other Income',
];

// Categories where raw GL signs are negative (credits) — flip to positive for display
const CREDIT_CATEGORIES = new Set(['Revenue', 'Other Income']);

// --- Helpers ---

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(s);
}

function formatPeriod(period: string): string {
  if (isIsoDate(period)) return fmtDate(period);
  return period;
}

function sortPeriods(periods: string[]): string[] {
  return [...periods].sort((a, b) => {
    // If both are ISO dates, sort chronologically
    if (isIsoDate(a) && isIsoDate(b)) return a.localeCompare(b);
    // Otherwise keep original order
    return 0;
  });
}

// --- Transform flat data → hierarchical LosData ---

function transformFlatData(args: Record<string, unknown>): LosData | null {
  const { title, entity, data, category_order, grand_total_label } = args as {
    title?: string;
    entity?: string;
    data?: unknown[];
    category_order?: string[];
    grand_total_label?: string;
  };

  if (typeof title !== 'string' || !Array.isArray(data) || data.length === 0) return null;

  // Parse flat rows — coerce string amounts to numbers
  const rows: FlatRow[] = [];
  for (const d of data) {
    if (typeof d !== 'object' || d === null) continue;
    const r = d as Record<string, unknown>;
    if (typeof r.period !== 'string' || typeof r.category !== 'string' || typeof r.line_item !== 'string') continue;
    const amt = typeof r.amount === 'number' ? r.amount : Number(r.amount);
    if (isNaN(amt)) continue;
    rows.push({
      period: r.period,
      category: r.category,
      line_item: r.line_item,
      amount: amt,
    });
  }

  if (rows.length === 0) return null;

  // Extract and sort unique periods
  const rawPeriods = sortPeriods([...new Set(rows.map((r) => r.period))]);
  const periodLabels = rawPeriods.map(formatPeriod);

  // Build period key → label mapping
  const periodMap = new Map<string, string>();
  for (let i = 0; i < rawPeriods.length; i++) {
    periodMap.set(rawPeriods[i], periodLabels[i]);
  }

  // Determine category order
  const order = category_order ?? DEFAULT_CATEGORY_ORDER;
  const allCategories = [...new Set(rows.map((r) => r.category))];
  const ordered = order.filter((c) => allCategories.includes(c));
  const remaining = allCategories.filter((c) => !ordered.includes(c)).sort();
  const finalCategoryOrder = [...ordered, ...remaining];

  // Group: category → line_item → period → amount
  const catMap = new Map<string, Map<string, Map<string, number>>>();
  for (const row of rows) {
    if (!catMap.has(row.category)) catMap.set(row.category, new Map());
    const lineMap = catMap.get(row.category)!;
    if (!lineMap.has(row.line_item)) lineMap.set(row.line_item, new Map());
    const periodAmounts = lineMap.get(row.line_item)!;
    const current = periodAmounts.get(row.period) ?? 0;
    periodAmounts.set(row.period, current + row.amount);
  }

  // Build sections
  const sections: LosCategory[] = [];
  const grandTotal: Record<string, number> = {};

  for (const categoryName of finalCategoryOrder) {
    const lineMap = catMap.get(categoryName);
    if (!lineMap) continue;

    const isCredit = CREDIT_CATEGORIES.has(categoryName);
    const items: LosLineItem[] = [];
    const subtotal: Record<string, number> = {};

    // Sort line items alphabetically within each category
    const lineItemNames = [...lineMap.keys()].sort();

    for (const itemName of lineItemNames) {
      const periodAmounts = lineMap.get(itemName)!;
      const values: Record<string, number | null> = {};

      for (let i = 0; i < rawPeriods.length; i++) {
        const rawVal = periodAmounts.get(rawPeriods[i]) ?? 0;
        // Flip sign for credit categories (Revenue, Other Income)
        const displayVal = isCredit ? -rawVal : rawVal;
        values[periodLabels[i]] = displayVal;
        subtotal[periodLabels[i]] = (subtotal[periodLabels[i]] ?? 0) + displayVal;
      }

      items.push({ label: itemName, values });
    }

    sections.push({ category: categoryName, subtotal, items });

    // Accumulate grand total: Revenue adds, expenses subtract
    for (const label of periodLabels) {
      const subVal = subtotal[label] ?? 0;
      if (isCredit) {
        // Revenue / Other Income → adds to NOI
        grandTotal[label] = (grandTotal[label] ?? 0) + subVal;
      } else {
        // Expenses → subtracts from NOI
        grandTotal[label] = (grandTotal[label] ?? 0) - subVal;
      }
    }
  }

  // Convert grand total to nullable record
  const grandTotalRecord: Record<string, number | null> = {};
  for (const label of periodLabels) {
    grandTotalRecord[label] = grandTotal[label] ?? null;
  }

  return {
    title,
    entity: typeof entity === 'string' ? entity : undefined,
    periods: periodLabels,
    sections,
    grand_total: grandTotalRecord,
    grand_total_label: typeof grand_total_label === 'string' ? grand_total_label : undefined,
  };
}

// --- Legacy nested format support ---

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

function isNestedLosData(v: unknown): v is LosData {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.title === 'string' &&
    Array.isArray(r.periods) &&
    r.periods.every((p: unknown) => typeof p === 'string') &&
    Array.isArray(r.sections) &&
    r.sections.length > 0 &&
    r.sections.every(isLosCategory)
  );
}

// --- Extract data (flat or nested) ---

function extractData(args: Record<string, unknown>): LosData | null {
  // Try flat format first (new, preferred)
  if (Array.isArray(args.data)) {
    return transformFlatData(args);
  }
  // Fall back to nested format (legacy)
  if (isNestedLosData(args)) return args;
  return null;
}

function describeArgs(args: Record<string, unknown>): string {
  const keys = Object.keys(args);
  const dataInfo = Array.isArray(args.data)
    ? `data: ${args.data.length} items`
    : Array.isArray(args.sections)
      ? `sections: ${args.sections.length} items`
      : 'no data/sections';
  const titleInfo = typeof args.title === 'string' ? `title: "${args.title}"` : 'no title';
  return `Keys: [${keys.join(', ')}], ${titleInfo}, ${dataInfo}`;
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
    grandLabel.textContent = data.grand_total_label ?? 'Net Operating Income';
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
      showError(`No LOS data received. ${describeArgs(sc)}`);
    }
  },
  onToolCancelled: () => {
    showError('Tool call was cancelled.');
  },
});

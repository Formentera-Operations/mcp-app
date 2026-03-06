import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';

// Works both from source (server.ts with tsx) and compiled (dist/server.js)
const DIST_DIR = import.meta.filename.endsWith('.ts')
  ? path.join(import.meta.dirname, 'dist')
  : import.meta.dirname;

const htmlCache = new Map<string, string>();

async function readViewHtml(filename: string): Promise<string> {
  const cached = htmlCache.get(filename);
  if (cached) return cached;
  const html = await fs.readFile(path.join(DIST_DIR, 'views', filename), 'utf-8');
  htmlCache.set(filename, html);
  return html;
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'formentera-viz',
    version: '0.1.0',
  });

  // ─── visualize-production ───────────────────────────────────

  const prodChartUri = 'ui://production-chart/mcp-app.html';

  registerAppTool(
    server,
    'visualize-production',
    {
      title: 'Visualize Production',
      description:
        'Render an interactive time-series production chart. Pass an array of production records with date, oil, gas, water, and well name. Returns a chart with dual Y-axis, DataZoom, stream toggles, and KPI strip.',
      inputSchema: {
        data: z.array(
          z.object({
            date: z.string().describe('ISO date string (YYYY-MM-DD)'),
            oil_bbl: z.number().describe('Oil production in BBL/D'),
            gas_mcf: z.number().describe('Gas production in MCF/D'),
            water_bbl: z.number().describe('Water production in BBL/D'),
            well_name: z.string().describe('Well identifier'),
            boe: z.number().optional().describe('Barrel of oil equivalent'),
            is_forecast: z.boolean().optional().describe('True if forecast'),
          }),
        ).describe('Array of daily production records'),
      },
      _meta: {
        ui: { resourceUri: prodChartUri },
      },
    },
    async ({ data }): Promise<CallToolResult> => {
      const wells = [...new Set(data.map((d) => d.well_name))];
      const dates = data.map((d) => d.date).sort();
      const peakOil = Math.max(...data.map((d) => d.oil_bbl));
      const summary = `Production chart: ${wells.length} well(s), ${dates[0]} to ${dates[dates.length - 1]}, peak oil ${Math.round(peakOil).toLocaleString()} BBL/D`;

      return {
        content: [{ type: 'text', text: summary }],
        structuredContent: { data },
      };
    },
  );

  registerAppResource(
    server,
    prodChartUri,
    prodChartUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await readViewHtml('production-chart.html');
      return {
        contents: [{ uri: prodChartUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
      };
    },
  );

  // ─── visualize-variance ───────────────────────────────────

  const varianceUri = 'ui://variance-waterfall/mcp-app.html';

  registerAppTool(
    server,
    'visualize-variance',
    {
      title: 'Visualize Variance',
      description:
        'Render an interactive waterfall chart showing production variance breakdown. Pass a base BOE, current BOE, period label, and an array of variance components with category names and delta BOE values.',
      inputSchema: {
        base_boe: z.number().describe('Starting BOE/D value'),
        current_boe: z.number().describe('Ending BOE/D value'),
        period_label: z.string().describe('Period description (e.g., "Jan 2025 vs Dec 2024")'),
        components: z.array(
          z.object({
            category: z.string().describe('Variance category (e.g., "Downtime", "Decline", "New Wells")'),
            delta_boe: z.number().describe('Change in BOE/D (positive = increase, negative = decrease)'),
          }),
        ).describe('Array of variance components'),
      },
      _meta: {
        ui: { resourceUri: varianceUri },
      },
    },
    async ({ base_boe, current_boe, period_label, components }): Promise<CallToolResult> => {
      const increases = components.filter((c) => c.delta_boe > 0);
      const decreases = components.filter((c) => c.delta_boe < 0);
      const delta = current_boe - base_boe;
      const sign = delta >= 0 ? '+' : '';
      const summary = `Variance waterfall: ${period_label}, ${Math.round(base_boe)} → ${Math.round(current_boe)} BOE/D (${sign}${Math.round(delta)}), ${increases.length} increase(s), ${decreases.length} decrease(s)`;

      return {
        content: [{ type: 'text', text: summary }],
        structuredContent: { base_boe, current_boe, period_label, components },
      };
    },
  );

  registerAppResource(
    server,
    varianceUri,
    varianceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await readViewHtml('variance-waterfall.html');
      return {
        contents: [{ uri: varianceUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
      };
    },
  );

  // ─── show-data-table ───────────────────────────────────────

  const dataTableUri = 'ui://data-table/mcp-app.html';

  registerAppTool(
    server,
    'show-data-table',
    {
      title: 'Show Data Table',
      description:
        'Render a sortable, filterable data table with conditional formatting. Pass a title, column definitions (key, label, type), and row data. Supports number/currency/date/percent formatting and highlight rules.',
      inputSchema: {
        title: z.string().describe('Table title'),
        columns: z.array(
          z.object({
            key: z.string().describe('Column key matching row data fields'),
            label: z.string().describe('Display label for column header'),
            type: z.enum(['string', 'number', 'currency', 'date', 'percent']).describe('Data type for formatting'),
          }),
        ).describe('Column definitions'),
        rows: z.array(z.record(z.unknown())).describe('Array of row objects'),
        sort_by: z.string().optional().describe('Default sort column key'),
        highlight_rules: z.array(
          z.object({
            column: z.string().describe('Column key to apply rule to'),
            condition: z.enum(['positive', 'negative', 'gt', 'lt']).describe('Condition type'),
            color: z.string().optional().describe('Override highlight color hex'),
            threshold: z.number().optional().describe('Threshold for gt/lt conditions'),
          }),
        ).optional().describe('Conditional formatting rules'),
      },
      _meta: {
        ui: { resourceUri: dataTableUri },
      },
    },
    async ({ title, columns, rows, sort_by, highlight_rules }): Promise<CallToolResult> => {
      const summary = `Data table: "${title}", ${columns.length} columns, ${rows.length} rows${sort_by ? `, sorted by ${sort_by}` : ''}`;

      return {
        content: [{ type: 'text', text: summary }],
        structuredContent: { title, columns, rows, sort_by, highlight_rules },
      };
    },
  );

  registerAppResource(
    server,
    dataTableUri,
    dataTableUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await readViewHtml('data-table.html');
      return {
        contents: [{ uri: dataTableUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
      };
    },
  );

  // ─── show-los-table ────────────────────────────────────────

  const losTableUri = 'ui://los-table/mcp-app.html';

  registerAppTool(
    server,
    'show-los-table',
    {
      title: 'Show Lease Operating Statement',
      description:
        'Render a hierarchical Lease Operating Statement (Net Field LOS) with collapsible categories, monthly columns, and totals. Standard O&G financial statement showing revenue, taxes, LOE, and net operating income.',
      inputSchema: {
        title: z.string().describe('Statement title (e.g., "Net Field LOS")'),
        entity: z.string().optional().describe('Entity or property name'),
        periods: z.array(z.string()).describe('Column period labels (e.g., ["Jan 2025", "Feb 2025"])'),
        sections: z.array(
          z.object({
            category: z.string().describe('Section category (e.g., "Revenue", "Taxes", "LOE")'),
            subtotal: z.record(z.number().nullable()).describe('Subtotal values keyed by period'),
            items: z.array(
              z.object({
                label: z.string().describe('Line item label'),
                values: z.record(z.number().nullable()).describe('Values keyed by period'),
              }),
            ).describe('Line items in this section'),
          }),
        ).describe('LOS sections (categories with line items)'),
        grand_total: z.record(z.number().nullable()).optional().describe('Grand total (net operating income) keyed by period'),
      },
      _meta: {
        ui: { resourceUri: losTableUri },
      },
    },
    async ({ title, entity, periods, sections, grand_total }): Promise<CallToolResult> => {
      const totalItems = sections.reduce((s, sec) => s + sec.items.length, 0);
      const summary = `LOS: "${title}"${entity ? ` — ${entity}` : ''}, ${sections.length} sections, ${totalItems} line items, ${periods.length} periods`;

      return {
        content: [{ type: 'text', text: summary }],
        structuredContent: { title, entity, periods, sections, grand_total },
      };
    },
  );

  registerAppResource(
    server,
    losTableUri,
    losTableUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await readViewHtml('los-table.html');
      return {
        contents: [{ uri: losTableUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
      };
    },
  );

  // ─── visualize-decline ─────────────────────────────────────

  const declineUri = 'ui://decline-curve/mcp-app.html';

  registerAppTool(
    server,
    'visualize-decline',
    {
      title: 'Visualize Decline Curve',
      description:
        'Render a decline curve analysis chart with actual production scatter points and optional Arps decline forecast (exponential, hyperbolic, or harmonic). Supports auto-fit mode where the client computes decline parameters from actual data. Shows EUR estimate.',
      inputSchema: {
        well_name: z.string().describe('Well identifier'),
        actual: z.array(
          z.object({
            date: z.string().describe('ISO date string (YYYY-MM-DD)'),
            oil_bbl: z.number().describe('Oil production in BBL/D'),
          }),
        ).describe('Array of actual production data points'),
        forecast: z.union([
          z.object({
            method: z.string().describe('Decline method: exponential, hyperbolic, or harmonic'),
            ip: z.number().describe('Initial production rate (BBL/D)'),
            di: z.number().describe('Initial decline rate (fraction/month)'),
            b: z.number().describe('Hyperbolic exponent (0=exp, 0<b<1=hyp, 1=harmonic)'),
            months: z.number().describe('Forecast duration in months'),
          }),
          z.object({
            fit: z.literal(true).describe('Auto-fit exponential decline from actual data'),
            months: z.number().describe('Forecast duration in months'),
          }),
        ]).optional().describe('Forecast parameters or auto-fit mode'),
      },
      _meta: {
        ui: { resourceUri: declineUri },
      },
    },
    async ({ well_name, actual, forecast }): Promise<CallToolResult> => {
      const peakOil = Math.max(...actual.map((d) => d.oil_bbl));
      const dates = actual.map((d) => d.date).sort();
      const forecastDesc = forecast
        ? ('fit' in forecast ? 'auto-fit' : forecast.method)
        : 'none';
      const summary = `Decline curve: ${well_name}, ${actual.length} data points, ${dates[0]} to ${dates[dates.length - 1]}, peak ${Math.round(peakOil)} BBL/D, forecast: ${forecastDesc}`;

      return {
        content: [{ type: 'text', text: summary }],
        structuredContent: { well_name, actual, forecast },
      };
    },
  );

  registerAppResource(
    server,
    declineUri,
    declineUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await readViewHtml('decline-curve.html');
      return {
        contents: [{ uri: declineUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
      };
    },
  );

  // ─── show-well-map ─────────────────────────────────────────

  const wellMapUri = 'ui://well-map/mcp-app.html';

  registerAppTool(
    server,
    'show-well-map',
    {
      title: 'Show Well Map',
      description:
        'Render an interactive geospatial map of wells with status-colored markers, popups with well details, and auto-fit bounds. Wells are colored by status (Producing=green, Shut-in=yellow, P&A=gray, Drilling=blue, Completing=purple).',
      inputSchema: {
        data: z.array(
          z.object({
            well_name: z.string().describe('Well identifier'),
            lat: z.number().describe('Latitude'),
            lng: z.number().describe('Longitude'),
            status: z.string().optional().describe('Well status (e.g., Producing, Shut-in, P&A)'),
            oil_rate: z.number().optional().describe('Current oil rate BBL/D'),
            gas_rate: z.number().optional().describe('Current gas rate MCF/D'),
            water_rate: z.number().optional().describe('Current water rate BBL/D'),
            loe_per_boe: z.number().optional().describe('LOE per BOE'),
            field: z.string().optional().describe('Field name'),
            basin: z.string().optional().describe('Basin name'),
          }),
        ).describe('Array of well locations'),
      },
      _meta: {
        ui: {
          resourceUri: wellMapUri,
          csp: {
            resourceDomains: ['https://unpkg.com'],
            connectDomains: ['https://tiles.openfreemap.org', 'https://demotiles.maplibre.org'],
          },
        },
      },
    },
    async ({ data }): Promise<CallToolResult> => {
      const statuses = new Map<string, number>();
      for (const w of data) {
        const s = w.status ?? 'Unknown';
        statuses.set(s, (statuses.get(s) ?? 0) + 1);
      }
      const statusSummary = [...statuses.entries()].map(([s, c]) => `${c} ${s}`).join(', ');
      const summary = `Well map: ${data.length} wells (${statusSummary})`;

      return {
        content: [{ type: 'text', text: summary }],
        structuredContent: { data },
      };
    },
  );

  registerAppResource(
    server,
    wellMapUri,
    wellMapUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await readViewHtml('well-map.html');
      return {
        contents: [{ uri: wellMapUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
      };
    },
  );

  return server;
}

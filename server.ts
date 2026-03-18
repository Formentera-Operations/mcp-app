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
        'Render a hierarchical Lease Operating Statement (Net Field LOS) with collapsible categories, monthly columns, and totals. Pass flat row data — the view groups by category/line_item and computes subtotals automatically. Revenue is shown positive (view flips sign), expenses shown positive. Standard O&G categories: Revenue, Production & Ad Valorem Taxes, Lease Operating Expenses, G&A, Workover Expenses, P & A Expenses, Other Income.',
      inputSchema: {
        title: z.string().describe('Statement title (e.g., "Net Field LOS — FP Drake LLC (2025)")'),
        entity: z.string().optional().describe('Entity or property name'),
        data: z.array(
          z.object({
            period: z.string().describe('Period label or ISO date (e.g., "Jan 2025" or "2025-01-01")'),
            category: z.string().describe('LOS category (e.g., "Revenue", "Lease Operating Expenses", "G&A")'),
            line_item: z.string().describe('Line item / section name (e.g., "Gas Revenue", "Fuel & Power")'),
            amount: z.coerce.number().describe('Amount in natural GL signs (revenue as negative credits, expenses as positive debits)'),
          }),
        ).describe('Flat array of LOS line items — view handles grouping, subtotals, and sign conventions'),
        category_order: z.array(z.string()).optional().describe('Display order for categories. Default: Revenue, Taxes, LOE, G&A, Workover, P&A, Other Income'),
        grand_total_label: z.string().optional().describe('Label for grand total row. Default: "Net Operating Income"'),
      },
      _meta: {
        ui: { resourceUri: losTableUri },
      },
    },
    async ({ title, entity, data, category_order, grand_total_label }): Promise<CallToolResult> => {
      const categories = [...new Set(data.map((d) => d.category))];
      const periods = [...new Set(data.map((d) => d.period))];
      const lineItems = [...new Set(data.map((d) => d.line_item))];
      const summary = `LOS: "${title}"${entity ? ` — ${entity}` : ''}, ${categories.length} categories, ${lineItems.length} line items, ${periods.length} periods`;

      return {
        content: [{ type: 'text', text: summary }],
        structuredContent: { title, entity, data, category_order, grand_total_label },
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
          z.object({
            rates: z.array(z.object({
              date: z.string().describe('ISO date string'),
              oil_bbl: z.number().describe('Forecasted oil rate BBL/D'),
            })).describe('Pre-computed forecast rates (e.g., from Whitson DCA)'),
            label: z.string().optional().describe('Forecast label'),
          }),
        ]).optional().describe('Forecast parameters, auto-fit mode, or pre-computed rates'),
        scenarios: z.array(z.object({
          label: z.string().describe('Scenario name (e.g., "P10", "P50", "P90")'),
          rates: z.array(z.object({
            date: z.string().describe('ISO date string'),
            oil_bbl: z.number().describe('Forecasted oil rate BBL/D'),
          })),
          eur_bbl: z.number().optional().describe('EUR in barrels'),
          params: z.object({
            method: z.string(),
            ip: z.number(),
            di: z.number(),
            b: z.number(),
          }).optional().describe('Arps decline parameters for this scenario'),
        })).optional().describe('Multiple DCA scenarios (P10/P50/P90 or saved cases)'),
        type_curve: z.object({
          label: z.string().describe('Type curve name'),
          rates: z.array(z.object({
            month: z.number().describe('Month index from first production'),
            oil_bbl: z.number().describe('Type curve rate BBL/D'),
          })),
        }).optional().describe('Type curve overlay (normalized by month from first production)'),
      },
      _meta: {
        ui: { resourceUri: declineUri },
      },
    },
    async ({ well_name, actual, forecast, scenarios, type_curve }): Promise<CallToolResult> => {
      const peakOil = Math.max(...actual.map((d) => d.oil_bbl));
      const dates = actual.map((d) => d.date).sort();
      const forecastDesc = forecast
        ? ('fit' in forecast ? 'auto-fit' : ('rates' in forecast ? 'pre-computed' : forecast.method))
        : 'none';
      const scenarioDesc = scenarios?.length ? `, ${scenarios.length} scenario(s): ${scenarios.map((s) => s.label).join(', ')}` : '';
      const typeCurveDesc = type_curve ? `, type curve: ${type_curve.label}` : '';
      const summary = `Decline curve: ${well_name}, ${actual.length} data points, ${dates[0]} to ${dates[dates.length - 1]}, peak ${Math.round(peakOil)} BBL/D, forecast: ${forecastDesc}${scenarioDesc}${typeCurveDesc}`;

      return {
        content: [{ type: 'text', text: summary }],
        structuredContent: { well_name, actual, forecast, scenarios, type_curve },
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

  // ─── visualize-pvt ───────────────────────────────────────

  const pvtChartUri = 'ui://pvt-chart/mcp-app.html';

  registerAppTool(
    server,
    'visualize-pvt',
    {
      title: 'Visualize PVT Properties',
      description:
        'Render PVT property curves vs pressure. Shows Bo (oil formation volume factor), Bg (gas FVF), Rs (solution GOR), viscosity, density, and Z-factor. Plots a vertical marker at bubble point pressure. Ideal for Whitson PVT calculation results.',
      inputSchema: {
        well_name: z.string().describe('Well identifier'),
        bubble_point_psi: z.number().optional().describe('Bubble point pressure in psi'),
        properties: z.array(
          z.object({
            pressure_psi: z.number().describe('Pressure in psi'),
            bo: z.number().optional().describe('Oil formation volume factor (RB/STB)'),
            bg: z.number().optional().describe('Gas formation volume factor (RB/SCF)'),
            rs: z.number().optional().describe('Solution GOR (SCF/STB)'),
            oil_viscosity_cp: z.number().optional().describe('Oil viscosity (cp)'),
            gas_viscosity_cp: z.number().optional().describe('Gas viscosity (cp)'),
            oil_density: z.number().optional().describe('Oil density (lb/ft³)'),
            gas_density: z.number().optional().describe('Gas density (lb/ft³)'),
            z_factor: z.number().optional().describe('Gas compressibility factor'),
          }),
        ).describe('Array of PVT data points at different pressures'),
      },
      _meta: {
        ui: { resourceUri: pvtChartUri },
      },
    },
    async ({ well_name, bubble_point_psi, properties }): Promise<CallToolResult> => {
      const pMin = Math.min(...properties.map((d) => d.pressure_psi));
      const pMax = Math.max(...properties.map((d) => d.pressure_psi));
      const propsPresent = ['bo', 'bg', 'rs', 'oil_viscosity_cp', 'gas_viscosity_cp', 'z_factor']
        .filter((k) => properties.some((d) => (d as Record<string, unknown>)[k] != null));
      const pbDesc = bubble_point_psi != null ? `, Pb=${Math.round(bubble_point_psi)} psi` : '';
      const summary = `PVT chart: ${well_name}, ${properties.length} points, ${Math.round(pMin)}-${Math.round(pMax)} psi${pbDesc}, properties: ${propsPresent.join(', ')}`;

      return {
        content: [{ type: 'text', text: summary }],
        structuredContent: { well_name, bubble_point_psi, properties },
      };
    },
  );

  registerAppResource(
    server,
    pvtChartUri,
    pvtChartUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await readViewHtml('pvt-chart.html');
      return {
        contents: [{ uri: pvtChartUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
      };
    },
  );

  // ─── visualize-nodal ─────────────────────────────────────

  const nodalChartUri = 'ui://nodal-chart/mcp-app.html';

  registerAppTool(
    server,
    'visualize-nodal',
    {
      title: 'Visualize Nodal Analysis',
      description:
        'Render an IPR/VLP nodal analysis chart. Shows inflow performance relationship (IPR) and one or more vertical lift performance (VLP) curves with operating point intersection. Ideal for production optimization, tubing design, and artificial lift evaluation from Whitson nodal analysis.',
      inputSchema: {
        well_name: z.string().describe('Well identifier'),
        date: z.string().optional().describe('Analysis date'),
        reservoir_pressure_psi: z.number().optional().describe('Reservoir pressure (psi)'),
        ipr: z.array(
          z.object({
            rate_stb_d: z.number().describe('Production rate (STB/D)'),
            bhp_psi: z.number().describe('Bottom-hole pressure (psi)'),
          }),
        ).describe('IPR curve data points (rate vs BHP)'),
        vlp_cases: z.array(
          z.object({
            label: z.string().describe('VLP case label (e.g., "3.5 in tubing")'),
            curve: z.array(
              z.object({
                rate_stb_d: z.number().describe('Production rate (STB/D)'),
                bhp_psi: z.number().describe('Bottom-hole pressure (psi)'),
              }),
            ).describe('VLP curve data points'),
            operating_point: z.object({
              rate_stb_d: z.number().describe('Operating rate (STB/D)'),
              bhp_psi: z.number().describe('Operating BHP (psi)'),
            }).optional().describe('Pre-computed operating point (VLP/IPR intersection). If omitted, computed client-side.'),
          }),
        ).describe('Array of VLP cases (e.g., different tubing sizes)'),
      },
      _meta: {
        ui: { resourceUri: nodalChartUri },
      },
    },
    async ({ well_name, date, reservoir_pressure_psi, ipr, vlp_cases }): Promise<CallToolResult> => {
      const opPoints = vlp_cases
        .filter((v) => v.operating_point)
        .map((v) => `${v.label}: ${Math.round(v.operating_point!.rate_stb_d)} STB/D`);
      const opDesc = opPoints.length > 0 ? `, operating: ${opPoints.join('; ')}` : '';
      const summary = `Nodal analysis: ${well_name}${date ? ` (${date})` : ''}, IPR ${ipr.length} pts, ${vlp_cases.length} VLP case(s): ${vlp_cases.map((v) => v.label).join(', ')}${opDesc}`;

      return {
        content: [{ type: 'text', text: summary }],
        structuredContent: { well_name, date, reservoir_pressure_psi, ipr, vlp_cases },
      };
    },
  );

  registerAppResource(
    server,
    nodalChartUri,
    nodalChartUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await readViewHtml('nodal-chart.html');
      return {
        contents: [{ uri: nodalChartUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
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
            connectDomains: [
              'https://tile.openstreetmap.org',
              'https://tiles.openfreemap.org',
              'https://demotiles.maplibre.org',
            ],
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

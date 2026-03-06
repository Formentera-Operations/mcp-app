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

  return server;
}

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createViewApp } from './shared/lifecycle.ts';
import { STATUS_COLORS, FP_GRAY, FP_NAVY } from './shared/colors.ts';
import { fmtNum, fmtCurrency } from './shared/format.ts';
import { showError } from './shared/errors.ts';

// --- Types ---

interface WellPoint {
  well_name: string;
  lat: number;
  lng: number;
  status?: string;
  oil_rate?: number;
  gas_rate?: number;
  water_rate?: number;
  loe_per_boe?: number;
  field?: string;
  basin?: string;
}

// --- Type guard ---

function isWellPoint(v: unknown): v is WellPoint {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.well_name === 'string' &&
    typeof r.lat === 'number' &&
    typeof r.lng === 'number' &&
    r.lat >= -90 && r.lat <= 90 &&
    r.lng >= -180 && r.lng <= 180
  );
}

function extractData(args: Record<string, unknown>): WellPoint[] | null {
  const raw = args.data;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const valid = raw.filter(isWellPoint);
  return valid.length > 0 ? valid : null;
}

// --- State ---

let map: maplibregl.Map | null = null;
let mapLoaded = false;
let pendingData: WellPoint[] | null = null;

// --- Helpers ---

function getStatusColor(status: string | undefined): string {
  if (!status) return FP_GRAY;
  const key = status.toLowerCase();
  return STATUS_COLORS[key] ?? FP_GRAY;
}

function buildGeoJson(wells: WellPoint[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: wells.map((w) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [w.lng, w.lat] },
      properties: {
        well_name: w.well_name,
        status: w.status ?? 'Unknown',
        oil_rate: w.oil_rate ?? null,
        gas_rate: w.gas_rate ?? null,
        water_rate: w.water_rate ?? null,
        loe_per_boe: w.loe_per_boe ?? null,
        field: w.field ?? '',
        basin: w.basin ?? '',
        color: getStatusColor(w.status),
      },
    })),
  };
}

// --- UI helpers ---

function buildKpiStrip(wells: WellPoint[]): void {
  const strip = document.getElementById('kpi-strip');
  if (!strip) return;

  const statuses = new Map<string, number>();
  for (const w of wells) {
    const s = w.status ?? 'Unknown';
    statuses.set(s, (statuses.get(s) ?? 0) + 1);
  }

  strip.replaceChildren();

  const kpis: Array<{ value: string; label: string; color?: string }> = [
    { value: String(wells.length), label: 'Wells' },
  ];

  for (const [status, count] of statuses) {
    kpis.push({
      value: String(count),
      label: status,
      color: getStatusColor(status),
    });
  }

  for (const kpi of kpis) {
    const div = document.createElement('div');
    div.className = 'kpi';

    const valEl = document.createElement('div');
    valEl.className = 'kpi-value';
    valEl.textContent = kpi.value;
    if (kpi.color) valEl.style.color = kpi.color;

    const labelEl = document.createElement('div');
    labelEl.className = 'kpi-label';
    labelEl.textContent = kpi.label;

    div.appendChild(valEl);
    div.appendChild(labelEl);
    strip.appendChild(div);
  }

  strip.style.display = 'flex';
}

function buildPopupContent(props: Record<string, unknown>): HTMLElement {
  const container = document.createElement('div');

  const title = document.createElement('div');
  title.className = 'popup-title';
  title.textContent = String(props.well_name ?? '');
  container.appendChild(title);

  const rows: Array<[string, string]> = [];
  if (props.status) rows.push(['Status', String(props.status)]);
  if (props.oil_rate != null) rows.push(['Oil', `${fmtNum(Number(props.oil_rate))} BBL/D`]);
  if (props.gas_rate != null) rows.push(['Gas', `${fmtNum(Number(props.gas_rate))} MCF/D`]);
  if (props.water_rate != null) rows.push(['Water', `${fmtNum(Number(props.water_rate))} BBL/D`]);
  if (props.loe_per_boe != null) rows.push(['LOE/BOE', fmtCurrency(Number(props.loe_per_boe))]);
  if (props.field) rows.push(['Field', String(props.field)]);
  if (props.basin) rows.push(['Basin', String(props.basin)]);

  for (const [label, value] of rows) {
    const row = document.createElement('div');
    row.className = 'popup-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'popup-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = 'popup-value';
    valueEl.textContent = value;

    row.appendChild(labelEl);
    row.appendChild(valueEl);
    container.appendChild(row);
  }

  return container;
}

function renderWells(wells: WellPoint[], fitBounds = true): void {
  if (!map || !mapLoaded) {
    pendingData = wells;
    return;
  }

  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';

  buildKpiStrip(wells);

  const geojson = buildGeoJson(wells);

  // Update or add source
  const existing = map.getSource('wells') as maplibregl.GeoJSONSource | undefined;
  if (existing) {
    existing.setData(geojson);
  } else {
    map.addSource('wells', { type: 'geojson', data: geojson });

    map.addLayer({
      id: 'wells-circle',
      type: 'circle',
      source: 'wells',
      paint: {
        'circle-radius': 6,
        'circle-color': ['get', 'color'],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': FP_NAVY,
      },
    });

    // Click handler for popups
    map.on('click', 'wells-circle', (e: unknown) => {
      const event = e as { features?: Array<{ geometry: { coordinates: number[] }; properties: Record<string, unknown> }> };
      const feature = event.features?.[0];
      if (!feature || !map) return;

      const coords = feature.geometry.coordinates as [number, number];
      const content = buildPopupContent(feature.properties);

      new maplibregl.Popup({ offset: 12 })
        .setLngLat(coords)
        .setDOMContent(content)
        .addTo(map);
    });

    // Cursor change on hover
    map.on('mouseenter', 'wells-circle', () => {
      if (map) map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'wells-circle', () => {
      if (map) map.getCanvas().style.cursor = '';
    });
  }

  // Fit bounds to wells (skip during streaming to prevent jank)
  if (fitBounds) {
    const bounds = new maplibregl.LngLatBounds();
    for (const w of wells) {
      bounds.extend([w.lng, w.lat]);
    }
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 50, maxZoom: 12 });
    }
  }
}

function initMap(): void {
  const container = document.getElementById('map');
  if (!container || map) return;

  // Inline style with OpenFreeMap raster tiles (no style JSON fetch needed).
  // Falls back to a plain background if tiles are blocked by CSP.
  const INLINE_STYLE: maplibregl.StyleSpecification = {
    version: 8,
    sources: {
      'osm-tiles': {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap contributors',
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#e8e8e8' } },
      { id: 'osm', type: 'raster', source: 'osm-tiles' },
    ],
  };

  try {
    map = new maplibregl.Map({
      container: 'map',
      style: INLINE_STYLE,
      center: [-99.5, 32.0], // Texas center
      zoom: 5,
    });
  } catch (err) {
    showError(`Map init failed: ${String(err)}`);
    return;
  }

  map.addControl(new maplibregl.NavigationControl());

  map.on('load', () => {
    mapLoaded = true;
    if (pendingData) {
      renderWells(pendingData);
      pendingData = null;
    }
  });

  // Surface tile fetch errors (non-fatal — wells still render on background)
  map.on('error', (e) => {
    const msg = (e as { error?: { message?: string } }).error?.message ?? String(e);
    console.error('[Well Map] MapLibre error:', msg);
  });
}

// --- Initialize ---

createViewApp('Well Map', '0.1.0', {
  onToolInputPartial: (args) => {
    const wells = extractData(args);
    if (wells) {
      if (!map) initMap();
      renderWells(wells, false);
    }
  },
  onToolInput: (args) => {
    const wells = extractData(args);
    if (wells) {
      if (!map) initMap();
      renderWells(wells);
    }
  },
  onToolResult: (sc) => {
    const wells = extractData(sc);
    if (wells) {
      if (!map) initMap();
      renderWells(wells);
    } else {
      showError('No well data received.');
    }
  },
  onToolCancelled: () => {
    showError('Tool call was cancelled.');
  },
  onPause: () => {},
  onResume: () => { map?.resize(); },
  onTeardown: () => { map?.remove(); map = null; mapLoaded = false; },
});


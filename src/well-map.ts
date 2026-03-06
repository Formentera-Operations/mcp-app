import { createViewApp } from './shared/lifecycle.ts';
import { STATUS_COLORS, FP_GRAY, FP_NAVY } from './shared/colors.ts';
import { escapeHtml } from './shared/security.ts';
import { fmtNum, fmtCurrency } from './shared/format.ts';

// MapLibre is loaded via CDN (too large to bundle as single-file)
declare const maplibregl: {
  Map: new (opts: Record<string, unknown>) => MapInstance;
  LngLatBounds: new () => LngLatBoundsInstance;
  NavigationControl: new () => unknown;
  Popup: new (opts?: Record<string, unknown>) => PopupInstance;
};

interface MapInstance {
  on(event: string, cb: (...args: unknown[]) => void): void;
  on(event: string, layer: string, cb: (...args: unknown[]) => void): void;
  addSource(id: string, source: Record<string, unknown>): void;
  addLayer(layer: Record<string, unknown>): void;
  addControl(ctrl: unknown): void;
  fitBounds(bounds: LngLatBoundsInstance, opts?: Record<string, unknown>): void;
  resize(): void;
  remove(): void;
  getCanvas(): HTMLCanvasElement;
  getSource(id: string): { setData(data: unknown): void } | undefined;
  loaded(): boolean;
}

interface LngLatBoundsInstance {
  extend(coord: [number, number]): LngLatBoundsInstance;
  isEmpty(): boolean;
}

interface PopupInstance {
  setLngLat(coord: [number, number]): PopupInstance;
  setDOMContent(el: HTMLElement): PopupInstance;
  addTo(map: MapInstance): PopupInstance;
}

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
    typeof r.lng === 'number'
  );
}

function extractData(args: Record<string, unknown>): WellPoint[] | null {
  const raw = args.data;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const valid = raw.filter(isWellPoint);
  return valid.length > 0 ? valid : null;
}

// --- State ---

let map: MapInstance | null = null;
let mapLoaded = false;
let pendingData: WellPoint[] | null = null;

// --- Helpers ---

function getStatusColor(status: string | undefined): string {
  if (!status) return FP_GRAY;
  const key = status.toLowerCase();
  return STATUS_COLORS[key] ?? FP_GRAY;
}

function buildGeoJson(wells: WellPoint[]): Record<string, unknown> {
  return {
    type: 'FeatureCollection',
    features: wells.map((w) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [w.lng, w.lat] },
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

function showError(msg: string): void {
  const el = document.getElementById('error-msg');
  if (el) {
    el.textContent = msg;
    el.style.display = 'flex';
  }
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';
}

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
  if (props.status) rows.push(['Status', escapeHtml(String(props.status))]);
  if (props.oil_rate != null) rows.push(['Oil', `${fmtNum(Number(props.oil_rate))} BBL/D`]);
  if (props.gas_rate != null) rows.push(['Gas', `${fmtNum(Number(props.gas_rate))} MCF/D`]);
  if (props.water_rate != null) rows.push(['Water', `${fmtNum(Number(props.water_rate))} BBL/D`]);
  if (props.loe_per_boe != null) rows.push(['LOE/BOE', fmtCurrency(Number(props.loe_per_boe))]);
  if (props.field) rows.push(['Field', escapeHtml(String(props.field))]);
  if (props.basin) rows.push(['Basin', escapeHtml(String(props.basin))]);

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

function renderWells(wells: WellPoint[]): void {
  if (!map || !mapLoaded) {
    pendingData = wells;
    return;
  }

  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';

  buildKpiStrip(wells);

  const geojson = buildGeoJson(wells);

  // Update or add source
  const existing = map.getSource('wells');
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

  // Fit bounds to wells
  const bounds = new maplibregl.LngLatBounds();
  for (const w of wells) {
    bounds.extend([w.lng, w.lat]);
  }
  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, { padding: 50, maxZoom: 12 });
  }
}

function initMap(): void {
  const container = document.getElementById('map');
  if (!container || map) return;

  map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [-99.5, 32.0], // Texas center
    zoom: 5,
  });

  map.addControl(new maplibregl.NavigationControl());

  map.on('load', () => {
    mapLoaded = true;
    if (pendingData) {
      renderWells(pendingData);
      pendingData = null;
    }
  });
}

// --- Initialize ---

createViewApp('Well Map', '0.1.0', {
  onToolInputPartial: (args) => {
    const wells = extractData(args);
    if (wells) {
      if (!map) initMap();
      renderWells(wells);
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
});


import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { WellData } from '../../dashboard-app';
import { MapFilters, type FilterState } from './MapFilters';
import { getStatusColor, buildPopupContent } from './mapUtils';

interface MapTabProps {
  wells: WellData[];
}

export function MapTab({ wells }: MapTabProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    status: [],
    basin: [],
    field: [],
  });

  // Get unique values for filters
  const basins = Array.from(new Set(wells.map((w) => w.basin).filter(Boolean)));
  const fields = Array.from(new Set(wells.map((w) => w.field).filter(Boolean)));
  const statuses = Array.from(new Set(wells.map((w) => w.status).filter(Boolean)));

  // Filter wells
  const filteredWells = wells.filter((w) => {
    if (filters.status.length > 0 && !filters.status.includes(w.status ?? '')) return false;
    if (filters.basin.length > 0 && !filters.basin.includes(w.basin ?? '')) return false;
    if (filters.field.length > 0 && !filters.field.includes(w.field ?? '')) return false;
    return true;
  });

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const INLINE_STYLE: maplibregl.StyleSpecification = {
      version: 8,
      sources: {
        'osm-tiles': {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors',
        },
      },
      layers: [
        { id: 'background', type: 'background', paint: { 'background-color': '#e8e8e8' } },
        { id: 'osm', type: 'raster', source: 'osm-tiles' },
      ],
    };

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: INLINE_STYLE,
      center: [-99.5, 32.0], // Texas center
      zoom: 5,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      setMapLoaded(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Render wells when map is loaded or wells change
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const map = mapRef.current;

    // Clear existing markers
    for (const marker of markersRef.current) {
      marker.remove();
    }
    markersRef.current = [];

    // Add markers for filtered wells
    for (const well of filteredWells) {
      const el = document.createElement('div');
      el.className = 'well-marker';
      el.style.cssText = `
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background-color: ${getStatusColor(well.status)};
        border: 2px solid #001F45;
        cursor: pointer;
      `;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([well.lng, well.lat])
        .addTo(map);

      // Click handler
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        new maplibregl.Popup({ offset: 12 })
          .setLngLat([well.lng, well.lat])
          .setDOMContent(buildPopupContent(well))
          .addTo(map);
      });

      markersRef.current.push(marker);
    }

    // Fit bounds if we have wells
    if (filteredWells.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      for (const w of filteredWells) {
        bounds.extend([w.lng, w.lat]);
      }
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 50, maxZoom: 12 });
      }
    }
  }, [filteredWells, mapLoaded]);

  // Handle fullscreen
  const handleFullscreen = useCallback(() => {
    window.app?.requestDisplayMode?.('fullscreen');
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.kpiStrip}>
          <div style={styles.kpi}>
            <div style={styles.kpiValue}>{filteredWells.length}</div>
            <div style={styles.kpiLabel}>Wells</div>
          </div>
          {statuses.map((status) => (
            <div key={status} style={styles.kpi}>
              <div style={{ ...styles.kpiValue, color: getStatusColor(status) }}>
                {filteredWells.filter((w) => w.status === status).length}
              </div>
              <div style={styles.kpiLabel}>{status}</div>
            </div>
          ))}
        </div>
        <button onClick={handleFullscreen} style={styles.fullscreenBtn}>
          ⛶
        </button>
      </div>

      <div style={styles.main}>
        <MapFilters
          basins={basins as string[]}
          fields={fields as string[]}
          statuses={statuses as string[]}
          filters={filters}
          onFiltersChange={setFilters}
        />
        <div ref={mapContainerRef} style={styles.map} />
      </div>
    </div>
  );
}

const FP_COLORS = {
  navy: '#001F45',
  steel: '#336699',
  lightGray: '#E6E6E6',
  offWhite: '#F2F2F2',
  white: '#FFFFFF',
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: FP_COLORS.white,
    borderRadius: '8px',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    backgroundColor: FP_COLORS.offWhite,
    borderBottom: `1px solid ${FP_COLORS.lightGray}`,
  },
  kpiStrip: {
    display: 'flex',
    gap: '16px',
  },
  kpi: {
    textAlign: 'center',
  },
  kpiValue: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: FP_COLORS.navy,
  },
  kpiLabel: {
    fontSize: '11px',
    color: '#7F7F7F',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  fullscreenBtn: {
    padding: '6px 10px',
    backgroundColor: FP_COLORS.steel,
    color: FP_COLORS.white,
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  main: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
  },
  map: {
    flex: 1,
    minHeight: '300px',
  },
};

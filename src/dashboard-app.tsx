import React from 'react';
import ReactDOM from 'react-dom/client';
import { Dashboard } from './components/Dashboard';

// Types for dashboard data
export interface WellData {
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

export interface ProductionData {
  date: string;
  oil_bbl: number;
  gas_mcf: number;
  water_bbl?: number;
  well_name?: string;
  boe?: number;
  is_forecast?: boolean;
}

export interface LOEData {
  period: string;
  category: string;
  line_item: string;
  amount: number;
}

export interface LeaseData {
  lease_name: string;
  operator?: string;
  expiration_date?: string;
  basin?: string;
  field?: string;
}

export interface DashboardInput {
  wells?: WellData[];
  production?: ProductionData[];
  loe?: LOEData[];
  leases?: LeaseData[];
  activeTab?: 'map' | 'production' | 'financial' | 'leases';
}

// MCP App lifecycle
declare global {
  interface Window {
    app?: {
      ontoolresult: (callback: (result: { structuredContent: DashboardInput }) => void) => void;
      ontoolinputpartial: (callback: (partial: { structuredContent: Partial<DashboardInput> }) => void) => void;
      onhostcontextchanged: (callback: (ctx: HostContext) => void) => void;
      updateModelContext: (context: Record<string, unknown>) => void;
      sendLog: (log: { level: string; data: unknown }) => void;
      requestDisplayMode: (mode: string) => void;
      callServerTool: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
    };
  }
}

interface HostContext {
  theme?: 'light' | 'dark';
  styles?: {
    variables?: Record<string, string>;
    css?: { fonts?: string[] };
  };
  safeAreaInsets?: { top: number; right: number; bottom: number; left: number };
  availableDisplayModes?: string[];
}

// Initialize React app
function init() {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('Root element not found');
    return;
  }

  const root = ReactDOM.createRoot(rootElement);

  // Initial render with empty state
  root.render(
    <React.StrictMode>
      <Dashboard
        wells={[]}
        production={[]}
        loe={[]}
        leases={[]}
        activeTab="map"
      />
    </React.StrictMode>
  );

  // Handle tool result from MCP host
  window.app?.ontoolresult?.((result) => {
    const data = result.structuredContent || {};
    root.render(
      <React.StrictMode>
        <Dashboard
          wells={data.wells || []}
          production={data.production || []}
          loe={data.loe || []}
          leases={data.leases || []}
          activeTab={data.activeTab || 'map'}
        />
      </React.StrictMode>
    );
  });

  // Handle streaming partial input
  window.app?.ontoolinputpartial?.((partial) => {
    const data = partial.structuredContent || {};
    // progressively update
    root.render(
      <React.StrictMode>
        <Dashboard
          wells={data.wells || []}
          production={data.production || []}
          loe={data.loe || []}
          leases={data.leases || []}
          activeTab={data.activeTab || 'map'}
        />
      </React.StrictMode>
    );
  });

  // Handle host context changes (theme, safe area, etc.)
  window.app?.onhostcontextchanged?.((ctx) => {
    if (ctx.theme) {
      document.documentElement.setAttribute('data-theme', ctx.theme);
    }
    if (ctx.safeAreaInsets) {
      document.body.style.paddingTop = `${ctx.safeAreaInsets.top}px`;
      document.body.style.paddingRight = `${ctx.safeAreaInsets.right}px`;
      document.body.style.paddingBottom = `${ctx.safeAreaInsets.bottom}px`;
      document.body.style.paddingLeft = `${ctx.safeAreaInsets.left}px`;
    }
  });
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

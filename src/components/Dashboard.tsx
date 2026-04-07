import React, { useState, useCallback } from 'react';
import { TabBar } from './TabBar';
import type { TabId } from './TabBar';
import type { WellData, ProductionData, LOEData, LeaseData } from '../dashboard-app';
import { MapTab } from './MapTab';

interface DashboardProps {
  wells: WellData[];
  production: ProductionData[];
  loe: LOEData[];
  leases: LeaseData[];
  activeTab: TabId;
}

export function Dashboard({ wells, production, loe, leases, activeTab: initialTab }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
    // Inform MCP host of tab change
    window.app?.updateModelContext?.({ activeTab: tab });
  }, []);

  const handleFullscreen = useCallback(() => {
    window.app?.requestDisplayMode?.('fullscreen');
  }, []);

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.title}>Formentera Operations Intelligence</h1>
        <button onClick={handleFullscreen} style={styles.fullscreenButton}>
          Fullscreen
        </button>
      </header>

      {/* Tab navigation */}
      <TabBar activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Tab content */}
      <main style={styles.content}>
        {activeTab === 'map' && (
          <MapTab wells={wells} />
        )}

        {activeTab === 'production' && (
          <div style={styles.tabContent}>
            <h2 style={styles.tabTitle}>Production Surveillance</h2>
            <p style={styles.placeholder}>
              Production data: {production.length} records
              <br />
              <small style={styles.small}>(Charts coming in Phase 3)</small>
            </p>
          </div>
        )}

        {activeTab === 'financial' && (
          <div style={styles.tabContent}>
            <h2 style={styles.tabTitle}>Financial Analysis</h2>
            <p style={styles.placeholder}>
              LOE data: {loe.length} records
              <br />
              <small style={styles.small}>(Charts coming in Phase 4)</small>
            </p>
          </div>
        )}

        {activeTab === 'leases' && (
          <div style={styles.tabContent}>
            <h2 style={styles.tabTitle}>Lease Analysis</h2>
            <p style={styles.placeholder}>
              Lease data: {leases.length} leases
              <br />
              <small style={styles.small}>(Tables coming in Phase 5)</small>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

// Formentera brand styles
const FP_COLORS = {
  navy: '#001F45',
  teal: '#3D8B7A',
  steel: '#336699',
  lightGray: '#E6E6E6',
  offWhite: '#F2F2F2',
  white: '#FFFFFF',
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: "'Arial', 'Helvetica Neue', Helvetica, sans-serif",
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: FP_COLORS.offWhite,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    backgroundColor: FP_COLORS.navy,
    color: FP_COLORS.white,
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 'bold',
  },
  fullscreenButton: {
    padding: '6px 12px',
    backgroundColor: FP_COLORS.steel,
    color: FP_COLORS.white,
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  tabContent: {
    backgroundColor: FP_COLORS.white,
    borderRadius: '8px',
    padding: '20px',
    minHeight: '400px',
  },
  tabTitle: {
    margin: '0 0 16px 0',
    color: FP_COLORS.navy,
    fontSize: '18px',
    fontWeight: 'bold',
  },
  placeholder: {
    color: '#666',
    lineHeight: 1.6,
  },
  small: {
    color: '#999',
    fontSize: '12px',
  },
};

import React from 'react';

export type TabId = 'map' | 'production' | 'financial' | 'leases';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { id: 'map', label: 'Map', icon: '🗺️' },
  { id: 'production', label: 'Production', icon: '📊' },
  { id: 'financial', label: 'Financial', icon: '💰' },
  { id: 'leases', label: 'Leases', icon: '📄' },
];

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <nav style={styles.tabBar}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          style={{
            ...styles.tab,
            ...(activeTab === tab.id ? styles.tabActive : {}),
          }}
        >
          <span style={styles.icon}>{tab.icon}</span>
          <span style={styles.label}>{tab.label}</span>
        </button>
      ))}
    </nav>
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
  tabBar: {
    display: 'flex',
    backgroundColor: FP_COLORS.white,
    borderBottom: `1px solid ${FP_COLORS.lightGray}`,
    padding: '0 20px',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '3px solid transparent',
    cursor: 'pointer',
    color: '#666',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'all 0.2s ease',
  },
  tabActive: {
    color: FP_COLORS.navy,
    borderBottomColor: FP_COLORS.teal,
    fontWeight: 'bold',
  },
  icon: {
    fontSize: '16px',
  },
  label: {
    fontFamily: "'Arial', 'Helvetica Neue', Helvetica, sans-serif",
  },
};

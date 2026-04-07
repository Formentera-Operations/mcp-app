import React, { useState } from 'react';

export interface FilterState {
  status: string[];
  basin: string[];
  field: string[];
}

interface MapFiltersProps {
  basins: string[];
  fields: string[];
  statuses: string[];
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

export function MapFilters({
  basins,
  fields,
  statuses,
  filters,
  onFiltersChange,
}: MapFiltersProps) {
  const [expanded, setExpanded] = useState(false);

  const toggleFilter = (category: keyof FilterState, value: string) => {
    const current = filters[category];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [category]: updated });
  };

  const clearFilters = () => {
    onFiltersChange({ status: [], basin: [], field: [] });
  };

  const hasFilters = filters.status.length > 0 || filters.basin.length > 0 || filters.field.length > 0;

  return (
    <div style={{ ...styles.container, width: expanded ? '220px' : '40px' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={styles.toggleBtn}
        title="Toggle filters"
      >
        {expanded ? '×' : '☰'}
      </button>

      {expanded && (
        <div style={styles.content}>
          <div style={styles.header}>
            <span style={styles.title}>Filters</span>
            {hasFilters && (
              <button onClick={clearFilters} style={styles.clearBtn}>
                Clear
              </button>
            )}
          </div>

          {statuses.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Status</div>
              {statuses.map((status) => (
                <label key={status} style={styles.label}>
                  <input
                    type="checkbox"
                    checked={filters.status.includes(status)}
                    onChange={() => toggleFilter('status', status)}
                    style={styles.checkbox}
                  />
                  <span style={styles.labelText}>{status}</span>
                </label>
              ))}
            </div>
          )}

          {basins.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Basin</div>
              {basins.map((basin) => (
                <label key={basin} style={styles.label}>
                  <input
                    type="checkbox"
                    checked={filters.basin.includes(basin)}
                    onChange={() => toggleFilter('basin', basin)}
                    style={styles.checkbox}
                  />
                  <span style={styles.labelText}>{basin}</span>
                </label>
              ))}
            </div>
          )}

          {fields.length > 0 && fields.length <= 10 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Field</div>
              {fields.map((field) => (
                <label key={field} style={styles.label}>
                  <input
                    type="checkbox"
                    checked={filters.field.includes(field)}
                    onChange={() => toggleFilter('field', field)}
                    style={styles.checkbox}
                  />
                  <span style={styles.labelText}>{field}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
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
    backgroundColor: FP_COLORS.white,
    borderRight: `1px solid ${FP_COLORS.lightGray}`,
    transition: 'width 0.2s ease',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  toggleBtn: {
    padding: '10px',
    backgroundColor: FP_COLORS.offWhite,
    border: 'none',
    borderBottom: `1px solid ${FP_COLORS.lightGray}`,
    cursor: 'pointer',
    fontSize: '16px',
    color: FP_COLORS.navy,
  },
  content: {
    padding: '8px',
    overflowY: 'auto',
    flex: 1,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  title: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: FP_COLORS.navy,
    textTransform: 'uppercase',
  },
  clearBtn: {
    fontSize: '10px',
    padding: '2px 6px',
    backgroundColor: FP_COLORS.steel,
    color: FP_COLORS.white,
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
  },
  section: {
    marginBottom: '12px',
  },
  sectionTitle: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#7F7F7F',
    marginBottom: '6px',
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 0',
    cursor: 'pointer',
    fontSize: '12px',
    color: FP_COLORS.navy,
  },
  checkbox: {
    width: '14px',
    height: '14px',
    cursor: 'pointer',
  },
  labelText: {
    fontFamily: "'Arial', 'Helvetica Neue', Helvetica, sans-serif",
  },
};

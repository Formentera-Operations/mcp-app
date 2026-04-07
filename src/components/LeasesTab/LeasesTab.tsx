import React, { useState, useCallback, useMemo } from 'react';
import type { LeaseData } from '../../dashboard-app';

interface LeasesTabProps {
  leases: LeaseData[];
}

type SortKey = 'lease_name' | 'operator' | 'expiration_date' | 'basin' | 'field';
type SortDir = 'asc' | 'desc';

export function LeasesTab({ leases }: LeasesTabProps) {
  const [sortKey, setSortKey] = useState<SortKey>('expiration_date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filter, setFilter] = useState('');

  // Sort and filter
  const sortedLeases = useMemo(() => {
    let result = [...leases];

    // Filter
    if (filter) {
      const lower = filter.toLowerCase();
      result = result.filter(
        (l) =>
          l.lease_name.toLowerCase().includes(lower) ||
          l.operator?.toLowerCase().includes(lower) ||
          l.basin?.toLowerCase().includes(lower) ||
          l.field?.toLowerCase().includes(lower),
      );
    }

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [leases, sortKey, sortDir, filter]);

  // Handle sort
  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }, [sortKey]);

  // Fullscreen
  const handleFullscreen = useCallback(() => {
    window.app?.requestDisplayMode?.('fullscreen');
  }, []);

  // Format date
  const fmtDate = (d: string | undefined) => {
    if (!d) return '-';
    try {
      return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return d;
    }
  };

  // Days until expiration
  const getDaysUntil = (d: string | undefined) => {
    if (!d) return null;
    try {
      const exp = new Date(d);
      const now = new Date();
      const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return days;
    } catch {
      return null;
    }
  };

  // Expiration color
  const getExpColor = (days: number | null) => {
    if (days === null) return '#7F7F7F';
    if (days < 0) return '#C00000'; // Expired
    if (days < 30) return '#FFC000'; // < 30 days
    if (days < 90) return '#336699'; // < 90 days
    return '#00B050'; // Good
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.kpiStrip}>
          <div style={styles.kpi}>
            <div style={styles.kpiValue}>{leases.length}</div>
            <div style={styles.kpiLabel}>Leases</div>
          </div>
          <div style={styles.kpi}>
            <div style={styles.kpiValue}>
              {leases.filter((l) => {
                const days = getDaysUntil(l.expiration_date);
                return days !== null && days < 30;
              }).length}
            </div>
            <div style={styles.kpiLabel}>Expiring Soon</div>
          </div>
        </div>

        <input
          type="text"
          placeholder="Search leases..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={styles.search}
        />

        <button onClick={handleFullscreen} style={styles.fullscreenBtn}>
          ⛶
        </button>
      </div>

      {/* Table */}
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th onClick={() => handleSort('lease_name')} style={styles.th}>
                Lease Name {sortKey === 'lease_name' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('operator')} style={styles.th}>
                Operator {sortKey === 'operator' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('expiration_date')} style={styles.th}>
                Expiration {sortKey === 'expiration_date' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('basin')} style={styles.th}>
                Basin {sortKey === 'basin' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('field')} style={styles.th}>
                Field {sortKey === 'field' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedLeases.length === 0 ? (
              <tr>
                <td colSpan={5} style={styles.empty}>
                  No leases found
                </td>
              </tr>
            ) : (
              sortedLeases.map((lease, idx) => {
                const daysUntil = getDaysUntil(lease.expiration_date);
                const expColor = getExpColor(daysUntil);

                return (
                  <tr key={idx} style={styles.tr}>
                    <td style={styles.td}>{lease.lease_name}</td>
                    <td style={styles.td}>{lease.operator ?? '-'}</td>
                    <td style={{ ...styles.td, color: expColor }}>
                      {fmtDate(lease.expiration_date)}
                      {daysUntil !== null && (
                        <span style={styles.daysBadge}>
                          {daysUntil < 0 ? `${Math.abs(daysUntil)}d expired` : `${daysUntil}d`}
                        </span>
                      )}
                    </td>
                    <td style={styles.td}>{lease.basin ?? '-'}</td>
                    <td style={styles.td}>{lease.field ?? '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
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
    gap: '16px',
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
  search: {
    flex: 1,
    padding: '6px 12px',
    border: `1px solid ${FP_COLORS.lightGray}`,
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: "'Arial', 'Helvetica Neue', Helvetica, sans-serif",
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
  tableContainer: {
    flex: 1,
    overflow: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: "'Arial', 'Helvetica Neue', Helvetica, sans-serif",
    fontSize: '13px',
  },
  th: {
    padding: '10px 12px',
    textAlign: 'left',
    backgroundColor: FP_COLORS.offWhite,
    color: FP_COLORS.navy,
    fontWeight: 'bold',
    cursor: 'pointer',
    borderBottom: `2px solid ${FP_COLORS.lightGray}`,
    userSelect: 'none',
  },
  tr: {
    borderBottom: `1px solid ${FP_COLORS.lightGray}`,
  },
  td: {
    padding: '8px 12px',
    color: FP_COLORS.navy,
  },
  empty: {
    padding: '40px',
    textAlign: 'center',
    color: '#7F7F7F',
    fontStyle: 'italic',
  },
  daysBadge: {
    marginLeft: '8px',
    fontSize: '10px',
    padding: '2px 6px',
    borderRadius: '3px',
    backgroundColor: FP_COLORS.offWhite,
    color: FP_COLORS.navy,
  },
};

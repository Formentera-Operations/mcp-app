import { useState, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════
// FORMENTERA DESIGN SYSTEM v0.3
// Aligned to FP Brand Guidelines (fp-brand-2026)
// Stack: shadcn/ui + Tremor + TanStack Table + Radix UI
// ═══════════════════════════════════════════════════════════════

const BRAND = {
  // ── Theme Accents (6 families × 4 levels) ──
  navy:      { base: "#001F45", t1: "#336699", t2: "#94C1FA", t3: "#C4DDFC" },
  slate:     { base: "#3D4F5F", t1: "#6B818C", t2: "#A3B4BC", t3: "#CCD6DA" },
  teal:      { base: "#3D8B7A", t1: "#8EBBB3", t2: "#B6D3CE", t3: "#D6E7E4" },
  purple:    { base: "#553D8C", t1: "#978CB5", t2: "#BCB5CF", t3: "#DAD6E4" },
  crimson:   { base: "#A3192B", t1: "#BF5E6B", t2: "#D698A0", t3: "#E8C6CA" },
  green:     { base: "#6AAD4E", t1: "#93C87A", t2: "#B9DEA5", t3: "#D5EDBE" },
  // ── Neutrals ──
  black: "#000000", white: "#FFFFFF", gray: "#7F7F7F",
  lightGray: "#E6E6E6", offWhite: "#F2F2F2", darkGray: "#404040",
  // ── Functional (indicators only — never decorative) ──
  positive: "#00B050", negative: "#C00000", caution: "#FFC000",
  // ── Links ──
  steel: "#336699", slateLink: "#6B818C",
  // ── Commodity ──
  oil: "#00B050", gas: "#FF0000", ngl: "#7030A0",
  // ── Typography ──
  font: "'Arial', 'Helvetica Neue', Helvetica, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
};

// Chart color order (1-18) per brand spec
const CHART_COLORS = [
  "#001F45","#336699","#94C1FA",  // Navy family
  "#3D4F5F","#6B818C","#A3B4BC",  // Slate family
  "#3D8B7A","#8EBBB3","#B6D3CE",  // Teal family
  "#553D8C","#978CB5","#BCB5CF",  // Purple family
  "#A3192B","#BF5E6B","#D698A0",  // Crimson family
  "#6AAD4E","#93C87A","#B9DEA5",  // Green family
];

// For ≤6 series: use base of each family
const CHART_BASES = ["#001F45","#3D4F5F","#3D8B7A","#553D8C","#A3192B","#6AAD4E"];


// ─── GLOBAL STYLES ───────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');
    :root {
      --navy: #001F45; --steel: #336699; --sky: #94C1FA; --ice: #C4DDFC;
      --dark-slate: #3D4F5F; --slate: #6B818C; --light-slate: #A3B4BC; --pale-slate: #CCD6DA;
      --teal: #3D8B7A; --teal-light: #8EBBB3; --teal-pale: #B6D3CE; --teal-wash: #D6E7E4;
      --purple: #553D8C; --purple-light: #978CB5; --purple-pale: #BCB5CF;
      --crimson: #A3192B; --crimson-light: #BF5E6B; --crimson-pale: #D698A0;
      --fp-green: #6AAD4E; --green-light: #93C87A; --green-pale: #B9DEA5;
      --white: #FFFFFF; --off-white: #F2F2F2; --light-gray: #E6E6E6;
      --gray: #7F7F7F; --dark-gray: #404040; --black: #000000;
      --positive: #00B050; --negative: #C00000; --caution: #FFC000;
      --font: 'Arial','Helvetica Neue',Helvetica,sans-serif;
      --font-mono: 'JetBrains Mono','Fira Code','Courier New',monospace;
      --radius-sm: 4px; --radius-md: 6px; --radius-lg: 8px;
      --shadow-sm: 0 1px 2px rgba(0,31,69,0.06);
      --shadow-md: 0 2px 4px rgba(0,31,69,0.06), 0 1px 2px rgba(0,31,69,0.04);
      --shadow-lg: 0 4px 12px rgba(0,31,69,0.08), 0 2px 4px rgba(0,31,69,0.04);
      /* shadcn/ui overrides */
      --background: 0 0% 100%; --foreground: 213 100% 14%;
      --primary: 213 100% 14%; --primary-foreground: 0 0% 100%;
      --secondary: 210 7% 95%; --secondary-foreground: 213 100% 14%;
      --muted: 210 7% 95%; --muted-foreground: 0 0% 50%;
      --accent: 166 39% 39%; --accent-foreground: 0 0% 100%;
      --destructive: 353 73% 37%; --destructive-foreground: 0 0% 100%;
      --border: 0 0% 90%; --input: 0 0% 85%; --ring: 213 100% 14%;
      --tremor-brand: 213 100% 14%;
    }
    *{margin:0;padding:0;box-sizing:border-box;}
    body,html{font-family:var(--font);color:var(--navy);background:var(--white);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;}
    ::-webkit-scrollbar{width:6px;height:6px;}
    ::-webkit-scrollbar-track{background:transparent;}
    ::-webkit-scrollbar-thumb{background:var(--light-gray);border-radius:3px;}
  `}</style>
);


// ─── COMPONENTS ──────────────────────────────────────────────

const Badge = ({ children, variant = "neutral", size = "sm" }) => {
  const v = {
    neutral:  { bg: "var(--light-gray)", color: "var(--dark-slate)" },
    navy:     { bg: "var(--ice)",        color: "var(--navy)" },
    teal:     { bg: "var(--teal-wash)",  color: "var(--teal)" },
    positive: { bg: "#e0f5e9",           color: "var(--positive)" },
    negative: { bg: "#f5e0e0",           color: "var(--negative)" },
    caution:  { bg: "#fff5d6",           color: "#996600" },
    slate:    { bg: "var(--pale-slate)", color: "var(--dark-slate)" },
    outline:  { bg: "transparent",       color: "var(--dark-slate)", border: "1px solid var(--light-gray)" },
  }[variant] || { bg: "var(--light-gray)", color: "var(--dark-slate)" };
  const s = { xs: { px: 4, py: 1, fs: 9 }, sm: { px: 6, py: 2, fs: 10 }, md: { px: 8, py: 3, fs: 11 } }[size];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: `${s.py}px ${s.px}px`, fontSize: s.fs, fontWeight: 700,
      fontFamily: "var(--font)", lineHeight: 1, borderRadius: "var(--radius-sm)",
      background: v.bg, color: v.color, border: v.border || "none",
      letterSpacing: "0.03em", textTransform: "uppercase", whiteSpace: "nowrap",
    }}>{children}</span>
  );
};

const Button = ({ children, variant = "primary", size = "md", disabled, onClick, style: ext }) => {
  const [h, setH] = useState(false);
  const vars = {
    primary:   { bg: "var(--navy)",  bgH: "var(--dark-slate)", c: "#fff", border: "none" },
    teal:      { bg: "var(--teal)",  bgH: "#2d7567",           c: "#fff", border: "none" },
    secondary: { bg: "var(--white)", bgH: "var(--off-white)",   c: "var(--navy)", border: "1px solid var(--light-gray)" },
    ghost:     { bg: "transparent",  bgH: "var(--off-white)",   c: "var(--dark-slate)", border: "none" },
    outline:   { bg: "transparent",  bgH: "var(--off-white)",   c: "var(--navy)", border: "1px solid var(--light-gray)" },
    danger:    { bg: "#f5e0e0",      bgH: "#f0cccc",            c: "var(--negative)", border: "none" },
  };
  const szs = { sm: { px: 10, py: 5, fs: 12, g: 4 }, md: { px: 14, py: 7, fs: 13, g: 6 }, lg: { px: 18, py: 10, fs: 14, g: 8 }, icon: { px: 7, py: 7, fs: 14, g: 0 } };
  const v = vars[variant]; const s = szs[size];
  return (
    <button disabled={disabled} onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: s.g,
        padding: `${s.py}px ${s.px}px`, fontSize: s.fs, fontWeight: 700,
        fontFamily: "var(--font)", lineHeight: 1.2, cursor: disabled ? "not-allowed" : "pointer",
        borderRadius: "var(--radius-md)", border: v.border,
        background: disabled ? "var(--light-gray)" : h ? v.bgH : v.bg,
        color: disabled ? "var(--gray)" : v.c,
        transition: "all 120ms ease", opacity: disabled ? 0.6 : 1, ...ext,
      }}
    >{children}</button>
  );
};

const Input = ({ label, placeholder, helper, error, value, onChange, style: ext }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4, ...ext }}>
    {label && <label style={{ fontSize: 12, fontWeight: 700, color: "var(--navy)" }}>{label}</label>}
    <input placeholder={placeholder} value={value} onChange={onChange}
      style={{
        padding: "7px 10px", fontSize: 13, fontFamily: "var(--font)",
        border: `1px solid ${error ? "var(--negative)" : "var(--light-gray)"}`,
        borderRadius: "var(--radius-md)", background: "var(--white)",
        color: "var(--navy)", outline: "none", transition: "border-color 120ms ease",
      }}
      onFocus={e => e.target.style.borderColor = error ? "var(--negative)" : "var(--teal)"}
      onBlur={e => e.target.style.borderColor = error ? "var(--negative)" : "var(--light-gray)"}
    />
    {(helper || error) && <span style={{ fontSize: 11, color: error ? "var(--negative)" : "var(--gray)" }}>{error || helper}</span>}
  </div>
);

const Card = ({ children, padding = 20, hover = false, style: ext }) => {
  const [h, setH] = useState(false);
  return (
    <div onMouseEnter={() => hover && setH(true)} onMouseLeave={() => hover && setH(false)}
      style={{
        padding, background: "var(--white)",
        border: "1px solid var(--light-gray)", borderRadius: "var(--radius-lg)",
        boxShadow: h ? "var(--shadow-md)" : "var(--shadow-sm)",
        transition: "box-shadow 200ms ease, transform 200ms ease",
        transform: h ? "translateY(-1px)" : "none", ...ext,
      }}
    >{children}</div>
  );
};

const MetricCard = ({ label, value, unit, change, changeDir, sparkline }) => (
  <Card padding={16} hover>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--gray)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: "var(--navy)", letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</span>
          {unit && <span style={{ fontSize: 12, fontWeight: 400, color: "var(--gray)" }}>{unit}</span>}
        </div>
        {change !== undefined && (
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: changeDir === "up" ? "var(--positive)" : changeDir === "down" ? "var(--negative)" : "var(--gray)" }}>
              {changeDir === "up" ? "↑" : changeDir === "down" ? "↓" : "→"} {change}
            </span>
            <span style={{ fontSize: 10, color: "var(--gray)" }}>vs prev</span>
          </div>
        )}
      </div>
      {sparkline && (
        <svg width="64" height="28" viewBox="0 0 64 28" style={{ opacity: 0.6 }}>
          <polyline points={sparkline} fill="none" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  </Card>
);

const BarList = ({ data, valueFormatter = v => v }) => {
  const max = Math.max(...data.map(d => d.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {data.map((d, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
            <span style={{ fontSize: 13, color: "var(--navy)", fontWeight: 400 }}>{d.name}</span>
            <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--dark-slate)" }}>{valueFormatter(d.value)}</span>
          </div>
          <div style={{ height: 6, background: "var(--off-white)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(d.value / max) * 100}%`, background: d.color || "var(--navy)", borderRadius: 3, transition: "width 500ms ease" }} />
          </div>
        </div>
      ))}
    </div>
  );
};

const MiniAreaChart = ({ data, width = 280, height = 80, color = "var(--teal)" }) => {
  const max = Math.max(...data); const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - 8 - ((v - min) / range) * (height - 16)}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="aG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts} ${width},${height}`} fill="url(#aG)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const TabBar = ({ tabs, active, onChange }) => (
  <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--light-gray)" }}>
    {tabs.map(t => (
      <button key={t.key} onClick={() => onChange(t.key)} style={{
        padding: "8px 16px", fontSize: 13, fontWeight: active === t.key ? 700 : 400,
        color: active === t.key ? "var(--navy)" : "var(--gray)",
        background: "none", border: "none", cursor: "pointer",
        borderBottom: active === t.key ? "2px solid var(--navy)" : "2px solid transparent",
        transition: "all 120ms ease", fontFamily: "var(--font)",
      }}>{t.label}</button>
    ))}
  </div>
);

const DataTable = ({ columns, data, compact = false }) => {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [filterText, setFilterText] = useState("");
  const handleSort = (key) => { if (!key) return; if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortKey(key); setSortDir("asc"); } };
  const sorted = useMemo(() => {
    let rows = [...data];
    if (filterText) { const ft = filterText.toLowerCase(); rows = rows.filter(r => columns.some(c => String(r[c.key] || "").toLowerCase().includes(ft))); }
    if (sortKey) { rows.sort((a, b) => { const av = a[sortKey], bv = b[sortKey]; const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv)); return sortDir === "asc" ? cmp : -cmp; }); }
    return rows;
  }, [data, sortKey, sortDir, filterText, columns]);
  const py = compact ? 6 : 10;
  return (
    <div>
      <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <input placeholder="Filter rows..." value={filterText} onChange={e => setFilterText(e.target.value)}
          style={{ padding: "5px 10px", fontSize: 12, fontFamily: "var(--font)", border: "1px solid var(--light-gray)", borderRadius: "var(--radius-md)", background: "var(--white)", color: "var(--dark-slate)", outline: "none", width: 200 }}
          onFocus={e => e.target.style.borderColor = "var(--teal)"} onBlur={e => e.target.style.borderColor = "var(--light-gray)"} />
        <span style={{ fontSize: 11, color: "var(--gray)", fontFamily: "var(--font-mono)" }}>{sorted.length} rows</span>
      </div>
      <div style={{ overflowX: "auto", border: "1px solid var(--light-gray)", borderRadius: "var(--radius-lg)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th key={i} onClick={() => col.sortable !== false && handleSort(col.key)}
                  style={{
                    padding: `8px ${compact ? 10 : 14}px`, textAlign: col.align || "left",
                    fontSize: 10, fontWeight: 700, color: "var(--white)",
                    textTransform: "uppercase", letterSpacing: "0.04em",
                    background: "var(--navy)", whiteSpace: "nowrap",
                    cursor: col.sortable !== false ? "pointer" : "default", userSelect: "none",
                    borderBottom: "none",
                  }}>
                  {col.header}
                  {sortKey === col.key && <span style={{ marginLeft: 4, fontSize: 9 }}>{sortDir === "asc" ? "↑" : "↓"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 1 ? "var(--off-white)" : "var(--white)", transition: "background 80ms ease" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--ice)"} onMouseLeave={e => e.currentTarget.style.background = ri % 2 === 1 ? "var(--off-white)" : "var(--white)"}>
                {columns.map((col, ci) => (
                  <td key={ci} style={{
                    padding: `${py}px ${compact ? 10 : 14}px`, textAlign: col.align || "left",
                    fontFamily: col.mono ? "var(--font-mono)" : "var(--font)",
                    fontSize: col.mono ? 12 : 13, color: "var(--navy)",
                    fontWeight: col.bold ? 700 : 400, whiteSpace: "nowrap",
                    borderBottom: "1px solid var(--light-gray)",
                  }}>{col.render ? col.render(row) : row[col.key]}</td>
                ))}
              </tr>
            ))}
            {sorted.length === 0 && <tr><td colSpan={columns.length} style={{ padding: 32, textAlign: "center", color: "var(--gray)", fontSize: 13 }}>No matching results</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// DOCUMENTATION
// ═══════════════════════════════════════════════════════════════

const sections = [
  { key: "overview", label: "Overview" },
  { key: "tokens", label: "Tokens" },
  { key: "components", label: "Components" },
  { key: "dashboard", label: "Dashboard" },
  { key: "config", label: "Config" },
];

const Code = ({ children, title }) => (
  <div style={{ marginTop: 12, marginBottom: 16 }}>
    {title && <div style={{ fontSize: 9, fontWeight: 700, color: "var(--gray)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{title}</div>}
    <pre style={{ padding: 14, background: "var(--navy)", color: "var(--sky)", borderRadius: "var(--radius-md)", fontSize: 11.5, lineHeight: 1.6, fontFamily: "var(--font-mono)", overflowX: "auto", whiteSpace: "pre" }}>{children}</pre>
  </div>
);

const SH = ({ children, sub }) => (
  <div style={{ marginBottom: sub ? 12 : 20, marginTop: sub ? 24 : 0 }}>
    <div style={{ fontSize: sub ? 16 : 22, fontWeight: 700, color: "var(--navy)", letterSpacing: "-0.01em" }}>{children}</div>
  </div>
);

const Swatch = ({ name, hex, light }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "3px 0" }}>
    <div style={{ width: 28, height: 28, borderRadius: "var(--radius-sm)", background: hex, border: light ? "1px solid var(--light-gray)" : "none", flexShrink: 0 }} />
    <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--dark-slate)", minWidth: 90 }}>{name}</span>
    <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--gray)" }}>{hex}</span>
  </div>
);

const FamilyRow = ({ name, base, t1, t2, t3 }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--dark-slate)", marginBottom: 4 }}>{name}</div>
    <div style={{ display: "flex", gap: 2, borderRadius: "var(--radius-md)", overflow: "hidden" }}>
      {[base, t1, t2, t3].map((c, i) => (
        <div key={i} style={{ flex: 1, height: 32, background: c, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: i < 2 ? "#fff" : "var(--navy)", opacity: 0.9 }}>{c}</span>
        </div>
      ))}
    </div>
  </div>
);

// ── OVERVIEW ──
const OverviewSection = () => (
  <div>
    <SH>Formentera Design System</SH>
    <p style={{ fontSize: 14, color: "var(--dark-slate)", lineHeight: 1.7, maxWidth: 640, marginBottom: 20 }}>
      Token-driven design system for Formentera's internal tools, aligned to the official FP Brand Guidelines.
      Built on shadcn/ui + Tremor + TanStack Table. Six accent families, 18-color chart order, Arial typography.
    </p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
      {[
        ["🎨", "Brand-Aligned Tokens", "Navy palette, 6 accent families, functional colors — straight from fp-brand-2026"],
        ["🧩", "shadcn/ui + Tremor", "Copy-paste components restyled with FP tokens. Tremor for charts and metrics."],
        ["📊", "Data-First", "TanStack Table with navy headers, alternating rows, 18-color chart system."],
      ].map(([icon, title, desc], i) => (
        <Card key={i} padding={16}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)", marginBottom: 2 }}>{title}</div>
          <div style={{ fontSize: 12, color: "var(--gray)" }}>{desc}</div>
        </Card>
      ))}
    </div>
    <SH sub>Principles</SH>
    {[
      ["Brand-exact", "Use exact hex values from the brand spec. Never approximate FP colors."],
      ["One styling system", "Tailwind CSS only. No Emotion, no CSS-in-JS."],
      ["Chart color order", "Always follow the 1–18 sequence. For ≤6 series, use base of each family."],
      ["Functional = indicators only", "Green/Red/Yellow for performance only — never decorative."],
      ["Arial everywhere", "The sole typeface. Monospace only for numeric data in tables and code."],
    ].map(([t, d], i) => (
      <div key={i} style={{ display: "flex", gap: 12, padding: "6px 0" }}>
        <div style={{ width: 4, borderRadius: 2, background: i === 0 ? "var(--navy)" : "var(--light-gray)", flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)" }}>{t}</div>
          <div style={{ fontSize: 12, color: "var(--dark-slate)", marginTop: 1 }}>{d}</div>
        </div>
      </div>
    ))}
  </div>
);

// ── TOKENS ──
const TokensSection = () => (
  <div>
    <SH>Design Tokens</SH>
    <SH sub>Accent Families (Base → Tint 1 → Tint 2 → Wash)</SH>
    <FamilyRow name="Accent 1 — Navy" base="#001F45" t1="#336699" t2="#94C1FA" t3="#C4DDFC" />
    <FamilyRow name="Accent 2 — Dark Slate" base="#3D4F5F" t1="#6B818C" t2="#A3B4BC" t3="#CCD6DA" />
    <FamilyRow name="Accent 3 — Teal" base="#3D8B7A" t1="#8EBBB3" t2="#B6D3CE" t3="#D6E7E4" />
    <FamilyRow name="Accent 4 — Purple" base="#553D8C" t1="#978CB5" t2="#BCB5CF" t3="#DAD6E4" />
    <FamilyRow name="Accent 5 — Crimson" base="#A3192B" t1="#BF5E6B" t2="#D698A0" t3="#E8C6CA" />
    <FamilyRow name="Accent 6 — Green" base="#6AAD4E" t1="#93C87A" t2="#B9DEA5" t3="#D5EDBE" />

    <SH sub>Neutrals</SH>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 4 }}>
      <Swatch name="Black" hex="#000000" />
      <Swatch name="Dark Gray" hex="#404040" />
      <Swatch name="Gray" hex="#7F7F7F" />
      <Swatch name="Light Gray" hex="#E6E6E6" light />
      <Swatch name="Off-White" hex="#F2F2F2" light />
      <Swatch name="White" hex="#FFFFFF" light />
    </div>

    <SH sub>Functional (Indicators Only)</SH>
    <div style={{ display: "flex", gap: 16 }}>
      <Swatch name="Positive" hex="#00B050" />
      <Swatch name="Negative" hex="#C00000" />
      <Swatch name="Caution" hex="#FFC000" />
    </div>

    <SH sub>Chart Color Order (1–18)</SH>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 2, marginBottom: 8 }}>
      {CHART_COLORS.map((c, i) => (
        <div key={i} style={{ width: 48, height: 36, background: c, borderRadius: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: i < 2 || (i >= 3 && i < 5) || (i >= 6 && i < 8) || i === 9 || i === 12 ? "#fff" : "var(--navy)" }}>{i + 1}</span>
          <span style={{ fontSize: 7, fontFamily: "var(--font-mono)", color: i < 2 || (i >= 3 && i < 5) || (i >= 6 && i < 8) || i === 9 || i === 12 ? "rgba(255,255,255,0.7)" : "rgba(0,31,69,0.5)" }}>{c}</span>
        </div>
      ))}
    </div>
    <p style={{ fontSize: 12, color: "var(--gray)" }}>For ≤6 series use positions 1, 4, 7, 10, 13, 16 (base of each family). Wash row (tint 3) is reserved for background fills.</p>

    <SH sub>Typography</SH>
    <div style={{ padding: 16, background: "var(--off-white)", borderRadius: "var(--radius-lg)", marginBottom: 8 }}>
      {[
        { name: "Heading 1", size: "16pt", weight: 700, sample: "Basin Production Overview" },
        { name: "Heading 2", size: "13pt", weight: 700, sample: "Permian Basin — Eagle Ford" },
        { name: "Body", size: "12pt", weight: 400, sample: "Net production increased 8.3% quarter-over-quarter to ~4,200 Boe/d" },
        { name: "Table Header", size: "9pt", weight: 700, sample: "WELL NAME  |  BASIN  |  BOE/D" },
        { name: "Footnote", size: "8pt", weight: 400, sample: "Source: ProdView as of 12/31/2025. Includes operated wells only." },
      ].map((t, i) => (
        <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "6px 0", borderBottom: i < 4 ? "1px solid var(--light-gray)" : "none" }}>
          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--gray)", width: 85, flexShrink: 0 }}>{t.name}</span>
          <span style={{ fontSize: t.size, fontWeight: t.weight, color: t.name === "Footnote" ? "var(--gray)" : "var(--navy)", fontFamily: "var(--font)" }}>{t.sample}</span>
          <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--light-slate)", whiteSpace: "nowrap", marginLeft: "auto" }}>{t.size} / {t.weight === 700 ? "Bold" : "Regular"}</span>
        </div>
      ))}
    </div>
    <p style={{ fontSize: 12, color: "var(--gray)" }}>Font: Arial (sole typeface). Fallbacks: Helvetica Neue, Helvetica, sans-serif. Monospace (JetBrains Mono) for data cells and code only.</p>
  </div>
);

// ── COMPONENTS ──
const ComponentsSection = () => (
  <div>
    <SH>Components</SH>
    <SH sub>Buttons</SH>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
      <Button variant="primary">Primary (Navy)</Button>
      <Button variant="teal">Teal Accent</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="primary" disabled>Disabled</Button>
    </div>

    <SH sub>Badges</SH>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
      <Badge variant="neutral">Neutral</Badge>
      <Badge variant="navy">Permian</Badge>
      <Badge variant="teal">Active</Badge>
      <Badge variant="slate">Eagle Ford</Badge>
      <Badge variant="positive">Producing</Badge>
      <Badge variant="negative">Shut-in</Badge>
      <Badge variant="caution">Review</Badge>
      <Badge variant="outline">Draft</Badge>
    </div>

    <SH sub>Inputs</SH>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
      <Input label="API Number" placeholder="42-000-00000" />
      <Input label="Well Name" placeholder="Enter well name" helper="As shown on operator records" />
      <Input label="NRI (%)" placeholder="0.00" error="Must be between 0 and 1" />
    </div>

    <SH sub>Tremor — Metric Cards</SH>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
      <MetricCard label="Net Production" value="4,218" unit="Boe/d" change="+8.3%" changeDir="up" sparkline="2,24 10,20 18,22 26,16 34,14 42,12 50,10 58,6" />
      <MetricCard label="LOE per Boe" value="$8.42" change="-$0.31" changeDir="down" sparkline="2,8 10,10 18,12 26,14 34,16 42,14 50,12 58,14" />
      <MetricCard label="Net Revenue" value="$2.1MM" change="+12.4%" changeDir="up" />
      <MetricCard label="Active Wells" value="847" change="—" changeDir="flat" />
    </div>

    <SH sub>Tremor — Bar List</SH>
    <Card padding={16} style={{ maxWidth: 420 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--gray)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>LOE by Category</div>
      <BarList data={[
        { name: "Workover", value: 245, color: CHART_COLORS[0] },
        { name: "Chemicals", value: 182, color: CHART_COLORS[3] },
        { name: "Electricity", value: 156, color: CHART_COLORS[6] },
        { name: "Hauling", value: 98, color: CHART_COLORS[9] },
        { name: "Compression", value: 67, color: CHART_COLORS[12] },
      ]} valueFormatter={v => `$${v}K`} />
    </Card>

    <SH sub>TanStack — Data Table</SH>
    <DataTable compact columns={[
      { key: "well", header: "Well", bold: true },
      { key: "basin", header: "Basin" },
      { key: "status", header: "Status", render: r => <Badge variant={r.status === "Producing" ? "positive" : r.status === "Shut-in" ? "negative" : "caution"} size="xs">{r.status}</Badge>, sortable: false },
      { key: "boe", header: "Boe/d", align: "right", mono: true },
      { key: "loe", header: "LOE/Boe", align: "right", mono: true },
      { key: "noi", header: "NOI", align: "right", mono: true },
    ]} data={[
      { well: "ROPER-STX N731HP", basin: "Eagle Ford", status: "Producing", boe: 142, loe: "$7.31", noi: "$48.2K" },
      { well: "DARLENE 1-STX", basin: "Permian", status: "Producing", boe: 89, loe: "$9.14", noi: "$22.1K" },
      { well: "LAR1 26-2", basin: "SCOOP/STACK", status: "Review", boe: 56, loe: "$11.02", noi: "$9.8K" },
      { well: "MESA VERDE 4H", basin: "Permian", status: "Shut-in", boe: 0, loe: "—", noi: "-$3.2K" },
      { well: "CEDAR RIDGE 7H", basin: "Williston", status: "Producing", boe: 203, loe: "$6.88", noi: "$71.4K" },
      { well: "HAWK RUN 12-1", basin: "Eagle Ford", status: "Producing", boe: 118, loe: "$8.05", noi: "$35.9K" },
    ]} />
  </div>
);

// ── DASHBOARD ──
const DashboardSection = () => (
  <div>
    <SH>Dashboard Pattern</SH>
    <div style={{ border: "1px solid var(--light-gray)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", background: "var(--navy)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--white)" }}>Basin Overview</div>
          <Badge variant="teal" size="xs">Q4 2025</Badge>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Button variant="ghost" size="sm" style={{ color: "var(--sky)" }}>Export</Button>
          <Button variant="outline" size="sm" style={{ color: "var(--white)", borderColor: "var(--steel)" }}>Filter</Button>
        </div>
      </div>
      {/* Metrics */}
      <div style={{ padding: 16, background: "var(--off-white)", borderBottom: "1px solid var(--light-gray)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <MetricCard label="Total Production" value="12,450" unit="Boe/d" change="+4.2%" changeDir="up" />
          <MetricCard label="Avg LOE" value="$9.87" unit="/Boe" change="+$0.22" changeDir="up" />
          <MetricCard label="Net Cash Flow" value="$4.8MM" change="+18%" changeDir="up" />
          <MetricCard label="Well Count" value="847" change="—" changeDir="flat" />
        </div>
      </div>
      {/* Charts */}
      <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, borderBottom: "1px solid var(--light-gray)" }}>
        <Card padding={14}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--gray)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Production Trend (30d)</div>
          <MiniAreaChart data={[11200,11400,11800,12100,11900,12200,12050,12400,12300,12450]} width={380} height={90} />
        </Card>
        <Card padding={14}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--gray)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>LOE by Category</div>
          <BarList data={[
            { name: "Workover", value: 245, color: CHART_COLORS[0] },
            { name: "Chemicals", value: 182, color: CHART_COLORS[3] },
            { name: "Electricity", value: 156, color: CHART_COLORS[6] },
            { name: "Hauling", value: 98, color: CHART_COLORS[9] },
          ]} valueFormatter={v => `$${v}K`} />
        </Card>
      </div>
      {/* Table */}
      <div style={{ padding: 16 }}>
        <DataTable compact columns={[
          { key: "well", header: "Well", bold: true },
          { key: "basin", header: "Basin" },
          { key: "status", header: "Status", render: r => <Badge variant={r.status === "Producing" ? "positive" : r.status === "Shut-in" ? "negative" : "caution"} size="xs">{r.status}</Badge>, sortable: false },
          { key: "boe", header: "Boe/d", align: "right", mono: true },
          { key: "loe", header: "LOE/Boe", align: "right", mono: true },
          { key: "noi", header: "NOI", align: "right", mono: true },
        ]} data={[
          { well: "ROPER-STX N731HP", basin: "Eagle Ford", status: "Producing", boe: 142, loe: "$7.31", noi: "$48.2K" },
          { well: "DARLENE 1-STX", basin: "Permian", status: "Producing", boe: 89, loe: "$9.14", noi: "$22.1K" },
          { well: "LAR1 26-2", basin: "SCOOP/STACK", status: "Review", boe: 56, loe: "$11.02", noi: "$9.8K" },
          { well: "MESA VERDE 4H", basin: "Permian", status: "Shut-in", boe: 0, loe: "—", noi: "-$3.2K" },
          { well: "CEDAR RIDGE 7H", basin: "Williston", status: "Producing", boe: 203, loe: "$6.88", noi: "$71.4K" },
        ]} />
      </div>
      {/* Footer */}
      <div style={{ padding: "8px 16px", borderTop: "1px solid var(--light-gray)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 9, color: "var(--gray)", fontWeight: 700, letterSpacing: "0.05em" }}>FORMENTERA PARTNERS</span>
        <span style={{ fontSize: 8, color: "var(--gray)" }}>CONFIDENTIAL</span>
      </div>
    </div>
  </div>
);

// ── CONFIG ──
const ConfigSection = () => (
  <div>
    <SH>Configuration</SH>
    <SH sub>tailwind.config.ts</SH>
    <Code title="tailwind.config.ts">{`import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
    "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // FP Brand — Accent Families
        navy:      { DEFAULT:'#001F45', steel:'#336699', sky:'#94C1FA', ice:'#C4DDFC' },
        slate:     { DEFAULT:'#3D4F5F', light:'#6B818C', pale:'#A3B4BC', wash:'#CCD6DA' },
        teal:      { DEFAULT:'#3D8B7A', light:'#8EBBB3', pale:'#B6D3CE', wash:'#D6E7E4' },
        purple:    { DEFAULT:'#553D8C', light:'#978CB5', pale:'#BCB5CF', wash:'#DAD6E4' },
        crimson:   { DEFAULT:'#A3192B', light:'#BF5E6B', pale:'#D698A0', wash:'#E8C6CA' },
        green:     { DEFAULT:'#6AAD4E', light:'#93C87A', pale:'#B9DEA5', wash:'#D5EDBE' },
        // FP Brand — Neutrals
        'off-white': '#F2F2F2',
        'light-gray': '#E6E6E6',
        gray:        '#7F7F7F',
        'dark-gray':  '#404040',
        // FP Brand — Functional (indicators only)
        positive:  '#00B050',
        negative:  '#C00000',
        caution:   '#FFC000',
        // shadcn/ui mappings → FP Brand
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        primary:     { DEFAULT:'hsl(var(--primary))', foreground:'hsl(var(--primary-foreground))' },
        secondary:   { DEFAULT:'hsl(var(--secondary))', foreground:'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT:'hsl(var(--destructive))', foreground:'hsl(var(--destructive-foreground))' },
        muted:       { DEFAULT:'hsl(var(--muted))', foreground:'hsl(var(--muted-foreground))' },
        card:        { DEFAULT:'hsl(var(--card))', foreground:'hsl(var(--card-foreground))' },
      },
      fontFamily: {
        sans: ["'Arial'", "'Helvetica Neue'", 'Helvetica', 'sans-serif'],
        mono: ["'JetBrains Mono'", "'Fira Code'", "'Courier New'", 'monospace'],
      },
      borderRadius: { sm:'4px', md:'6px', lg:'8px', xl:'12px' },
      boxShadow: {
        sm: '0 1px 2px rgba(0,31,69,0.06)',
        md: '0 2px 4px rgba(0,31,69,0.06), 0 1px 2px rgba(0,31,69,0.04)',
        lg: '0 4px 12px rgba(0,31,69,0.08), 0 2px 4px rgba(0,31,69,0.04)',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
export default config`}</Code>

    <SH sub>Chart Colors Array</SH>
    <Code title="lib/chart-colors.ts">{`// FP Brand — 18-color chart order
// For ≤6 series, use CHART_BASES (positions 1,4,7,10,13,16)
export const CHART_COLORS = [
  '#001F45','#336699','#94C1FA',  // Navy family
  '#3D4F5F','#6B818C','#A3B4BC',  // Slate family
  '#3D8B7A','#8EBBB3','#B6D3CE',  // Teal family
  '#553D8C','#978CB5','#BCB5CF',  // Purple family
  '#A3192B','#BF5E6B','#D698A0',  // Crimson family
  '#6AAD4E','#93C87A','#B9DEA5',  // Green family
] as const

export const CHART_BASES = [
  '#001F45','#3D4F5F','#3D8B7A',
  '#553D8C','#A3192B','#6AAD4E',
] as const

// Commodity-specific (use only for oil/gas/NGL breakouts)
export const COMMODITY = {
  oil: '#00B050', gas: '#FF0000', ngl: '#7030A0',
} as const`}</Code>

    <SH sub>Text Conventions</SH>
    <div style={{ padding: 14, background: "var(--off-white)", borderRadius: "var(--radius-lg)", fontSize: 12, color: "var(--dark-slate)", lineHeight: 1.8 }}>
      <strong style={{ color: "var(--navy)" }}>Currency:</strong> $1.5 million (body) or $1.5MM (tables). Always include $.
      <br/><strong style={{ color: "var(--navy)" }}>Units:</strong> Boe/d, MBoe/d, MMcf/d — always include /d for rates. Use ~ for approximations.
      <br/><strong style={{ color: "var(--navy)" }}>Numbers:</strong> Commas for thousands. One decimal for round figures. % with no space.
      <br/><strong style={{ color: "var(--navy)" }}>Dates:</strong> Month DD, YYYY in body. MM/DD/YY in tables.
    </div>

    <SH sub>Project Structure</SH>
    <Code title="Recommended layout">{`src/
├── components/
│   ├── ui/                   ← shadcn/ui (via CLI)
│   │   ├── button.tsx        ← variant="primary" = Navy
│   │   ├── badge.tsx         ← teal/positive/negative/caution
│   │   ├── card.tsx          ← white bg, light-gray border
│   │   ├── data-table.tsx    ← navy headers, alternating rows
│   │   └── ...
│   ├── tremor/               ← Tremor (copy-paste)
│   │   ├── area-chart.tsx    ← uses CHART_COLORS
│   │   ├── bar-list.tsx
│   │   └── metric-card.tsx
│   └── composed/             ← FP-specific compositions
│       ├── basin-overview.tsx
│       ├── well-table.tsx
│       └── production-trend.tsx
├── lib/
│   ├── chart-colors.ts       ← 18-color array + bases + commodity
│   └── utils.ts              ← shadcn cn() helper
├── styles/globals.css        ← CSS vars (shadcn + Tremor + FP)
└── tailwind.config.ts`}</Code>
  </div>
);


// ─── MAIN ────────────────────────────────────────────────────
export default function DesignSystem() {
  const [active, setActive] = useState("overview");
  const render = () => {
    switch (active) {
      case "overview": return <OverviewSection />;
      case "tokens": return <TokensSection />;
      case "components": return <ComponentsSection />;
      case "dashboard": return <DashboardSection />;
      case "config": return <ConfigSection />;
      default: return null;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--white)" }}>
      <GlobalStyles />
      {/* Header */}
      <div style={{ padding: "12px 24px", background: "var(--navy)", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: 3, background: "var(--white)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <svg width="18" height="18" viewBox="0 0 100 100">
            <polygon points="10,10 90,10 50,90" fill="#001F45" />
            <polygon points="30,10 70,10 70,30 30,30" fill="white" />
            <polygon points="38,40 62,40 50,70" fill="#336699" />
          </svg>
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--white)", fontFamily: "var(--font)", letterSpacing: "0.02em" }}>FORMENTERA PARTNERS</span>
        <Badge variant="teal" size="xs">Design System v0.3</Badge>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 4 }}>
          <Badge variant="navy" size="xs">shadcn/ui</Badge>
          <Badge variant="navy" size="xs">Tremor</Badge>
          <Badge variant="navy" size="xs">TanStack</Badge>
        </div>
      </div>
      <div style={{ padding: "0 24px", background: "var(--white)" }}>
        <TabBar tabs={sections.map(s => ({ key: s.key, label: s.label }))} active={active} onChange={setActive} />
      </div>
      <div style={{ padding: "24px 24px 48px", maxWidth: 1000 }}>
        {render()}
      </div>
    </div>
  );
}

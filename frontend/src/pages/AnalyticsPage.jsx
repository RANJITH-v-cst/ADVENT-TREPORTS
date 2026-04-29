import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useOutletContext } from "react-router-dom";
import {
  Download,
  FileText,
  FileSpreadsheet,
  Filter,
  Play,
  Trash2,
  GripVertical,
  ChevronDown,
  Search,
  X,
  BarChart2,
  AlertCircle,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square,
  LayoutGrid,
  Layers,
  Database,
  Calendar,
  Zap,
  PieChart as PieChartIcon,
  TrendingUp,
  Box,
  TrendingDown,
  Activity,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area,
} from "recharts";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { getAnalyticsConfig, runAnalytics } from "../api";

// ─── Constants ────────────────────────────────────────────────────────────────

const DATASET_OPTIONS = [
  { value: "transactions", label: "Transactions", icon: Zap },
  { value: "item_master", label: "Item Master", icon: Layers },
  { value: "ledger_master", label: "Ledger Master", icon: Database },
  { value: "sundry_debtors", label: "Sundry Debtors", icon: Database },
  { value: "sundry_creditors", label: "Sundry Creditors", icon: Database },
];

const TRANSACTION_TYPES = [
  { value: "sales", label: "Sales" },
  { value: "purchase", label: "Purchase" },
];

const CALCULATIONS = [
  { key: "balance_difference", label: "Balance Difference" },
  { key: "percentage", label: "Percentage" },
  { key: "total_amount", label: "Total Amount" },
];

const DEFAULT_FIELDS = {
  transactions: ["date", "party_name", "item_name", "quantity", "amount"],
  item_master: ["item_name", "opening_stock", "purchase_qty", "sales_qty", "closing_stock", "value"],
  ledger_master: ["ledger_name", "phone", "gst", "opening_balance", "closing_balance"],
  sundry_debtors: ["ledger_name", "phone", "gst", "opening_balance", "closing_balance", "balance_difference"],
  sundry_creditors: ["ledger_name", "phone", "gst", "opening_balance", "closing_balance", "balance_difference"],
};

const CHART_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

// ─── Sub-components ──────────────────────────────────────────────────────────

function SortableHeader({ label, field, sortState, onSort }) {
  const active = sortState.field === field;
  return (
    <th
      onClick={() => onSort(field)}
      className={`th-sortable ${active ? "active" : ""}`}
    >
      <div className="th-content">
        <span>{label}</span>
        {active ? (
          sortState.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        ) : (
          <ArrowUpDown size={12} className="th-icon-muted" />
        )}
      </div>
    </th>
  );
}

function InsightCard({ title, value, icon: Icon, color, subtext }) {
  return (
    <div className="insight-card">
      <div className="insight-header">
        <div className="insight-icon" style={{ background: `rgba(${color}, 0.1)`, color: `rgb(${color})` }}>
          <Icon size={18} />
        </div>
        <span className="insight-title">{title}</span>
      </div>
      <div className="insight-value">{value}</div>
      {subtext && <div className="insight-subtext">{subtext}</div>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { fromDate, toDate } = useOutletContext();
  const [dataset, setDataset] = useState("transactions");
  const [transactionType, setTransactionType] = useState("sales");
  const [availableFields, setAvailableFields] = useState(DEFAULT_FIELDS.transactions);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [calculations, setCalculations] = useState([]);
  const [filters, setFilters] = useState({ search: "", party_name: "", item_name: "" });
  const [groupBy, setGroupBy] = useState("");
  const [data, setData] = useState([]);
  const [columnsMeta, setColumnsMeta] = useState([]);
  const [totals, setTotals] = useState({});
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [tableName, setTableName] = useState("Business_Analytics");
  const [fieldSearch, setFieldSearch] = useState("");
  const [lastRun, setLastRun] = useState(null);
  const [fetchTime, setFetchTime] = useState(null);
  const [showCharts, setShowCharts] = useState(true);

  const [sortState, setSortState] = useState({ field: null, dir: "asc" });
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  // ── Smart Data Parsing for Visuals ────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!data.length) return [];
    
    // Group by Date for Trends
    const trendsMap = {};
    data.forEach(row => {
      const d = row.date || "Unknown";
      const amtStr = String(row.amount || row.value || row.closing_balance || "0").replace(/,/g, "").replace("₹", "");
      const amt = parseFloat(amtStr) || 0;
      trendsMap[d] = (trendsMap[d] || 0) + amt;
    });

    return Object.entries(trendsMap)
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  const distributionData = useMemo(() => {
    if (!data.length) return [];
    const nameKey = data[0].party_name ? "party_name" : data[0].item_name ? "item_name" : data[0].ledger_name ? "ledger_name" : null;
    if (!nameKey) return [];

    const map = {};
    data.forEach(row => {
      const name = row[nameKey] || "Other";
      const amtStr = String(row.amount || row.value || row.closing_balance || "0").replace(/,/g, "").replace("₹", "");
      const amt = parseFloat(amtStr) || 0;
      map[name] = (map[name] || 0) + amt;
    });

    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [data]);

  // ── Load config when dataset changes ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setConfigLoading(true);
      setErrorMessage("");
      setData([]);
      setColumnsMeta([]);
      setTotals({});
      setSelectedColumns([]);
      setGroupBy("");
      setPage(1);

      try {
        const response = await getAnalyticsConfig();
        if (cancelled) return;
        const result = response.data || {};

        let apiFields = [];
        if (dataset === "transactions") {
          apiFields = Object.values(result?.types?.transactions?.fields || {}).flat();
        } else {
          apiFields = Object.values(result?.types?.masters?.fields_by_sub_type?.[dataset] || {}).flat();
        }
        setAvailableFields(apiFields.length ? apiFields : DEFAULT_FIELDS[dataset] || []);
      } catch {
        if (!cancelled) setAvailableFields(DEFAULT_FIELDS[dataset] || []);
      } finally {
        if (!cancelled) setConfigLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [dataset]);

  const onDragEnd = useCallback(({ source, destination }) => {
    if (!destination) return;
    if (source.droppableId === "availableFields" && destination.droppableId === "selectedColumns") {
      const field = filteredAvailableFields[source.index];
      if (field && !selectedColumns.includes(field)) {
        setSelectedColumns((prev) => {
          const next = [...prev];
          next.splice(destination.index, 0, field);
          return next;
        });
      }
      return;
    }
    if (source.droppableId === "selectedColumns" && destination.droppableId === "selectedColumns") {
      setSelectedColumns((prev) => {
        const next = [...prev];
        const [moved] = next.splice(source.index, 1);
        next.splice(destination.index, 0, moved);
        return next;
      });
    }
  }, [selectedColumns, availableFields, fieldSearch]);

  const removeColumn = (col) => setSelectedColumns((p) => p.filter((c) => c !== col));
  const addColumn = (col) => { if (!selectedColumns.includes(col)) setSelectedColumns((p) => [...p, col]); };
  const toggleCalc = (k) => setCalculations((p) => p.includes(k) ? p.filter((x) => x !== k) : [...p, k]);

  const fetchData = async () => {
    if (selectedColumns.length === 0) {
      setErrorMessage("Please select at least one column to analyze.");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    const t0 = performance.now();

    try {
      const payload = {
        type: dataset === "transactions" ? "transactions" : "masters",
        sub_type: dataset === "transactions" ? transactionType : dataset,
        columns: selectedColumns,
        calculations,
        filters: {
          ...filters,
          date_from: fromDate ? fromDate.replace(/-/g, "") : "",
          date_to: toDate ? toDate.replace(/-/g, "") : "",
        },
        group_by: groupBy ? [groupBy] : [],
      };

      const res = await runAnalytics(payload);
      const result = res.data || {};

      setData(result.data || []);
      setColumnsMeta(result.columns_meta || []);
      setTotals(result.totals || {});
      
      if (result.available_fields?.length) setAvailableFields(result.available_fields);
      const msg = result.error || result.message;
      if (msg) setErrorMessage(msg);

      setSortState({ field: null, dir: "asc" });
      setPage(1);
      setLastRun(new Date());
      setFetchTime(Math.round(performance.now() - t0));
    } catch (err) {
      setErrorMessage(err?.response?.data?.error || err?.message || "Critical failure in fetching Tally data.");
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    setSortState((prev) => prev.field === field ? { field, dir: prev.dir === "asc" ? "desc" : "asc" } : { field, dir: "asc" });
    setPage(1);
  };

  const sortedData = useMemo(() => {
    if (!sortState.field) return data;
    return [...data].sort((a, b) => {
      let av = a[sortState.field];
      let bv = b[sortState.field];
      const parse = (v) => {
        if (v === null || v === undefined || v === "—") return -Infinity;
        const s = String(v).replace(/,/g, "").replace("₹", "").replace(/\(/g, "-").replace(/\)/g, "");
        const n = parseFloat(s);
        return isNaN(n) ? String(v).toLowerCase() : n;
      };
      const an = parse(av), bn = parse(bv);
      let cmp = (typeof an === "number" && typeof bn === "number") ? an - bn : String(an).localeCompare(String(bn));
      return sortState.dir === "asc" ? cmp : -cmp;
    });
  }, [data, sortState]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));
  const pagedData = sortedData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const tableHeaders = useMemo(() => {
    if (columnsMeta.length > 0) return columnsMeta.map((m) => m.key);
    return selectedColumns.length > 0 ? selectedColumns : availableFields;
  }, [columnsMeta, selectedColumns, availableFields]);

  const filteredAvailableFields = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase();
    return q ? availableFields.filter((f) => f.toLowerCase().includes(q)) : availableFields;
  }, [availableFields, fieldSearch]);

  const exportCSV = () => {
    const ws = XLSX.utils.json_to_sheet(sortedData);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `${tableName}.csv`; a.click();
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(sortedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${tableName}.xlsx`);
  };

  const css = `
    .ap-container { display: flex; flex-direction: column; height: calc(100vh - 80px); gap: 16px; animation: fadeIn 0.4s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    .premium-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; box-shadow: var(--shadow); overflow: hidden; }
    
    /* Top Bar */
    .ap-top-bar { padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
    .ap-module-title { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 16px; letter-spacing: -0.02em; }
    .ap-tag-live { background: rgba(16,185,129,0.1); color: var(--emerald); font-size: 10px; padding: 2px 8px; border-radius: 20px; border: 1px solid rgba(16,185,129,0.2); text-transform: uppercase; }

    .btn-group { display: flex; gap: 8px; }
    .btn-action {
      display: flex; align-items: center; gap: 8px; padding: 8px 16px;
      border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); border: 1px solid var(--border);
      background: var(--bg-elevated); color: var(--text-secondary);
    }
    .btn-action:hover:not(:disabled) { border-color: var(--accent); color: var(--text-primary); transform: translateY(-1px); }
    .btn-action:disabled { opacity: 0.4; cursor: not-allowed; }
    
    .btn-run { background: var(--accent); color: white; border: none; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); }
    .btn-run:hover:not(:disabled) { background: var(--accent-light); box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4); }

    /* Layout */
    .ap-main-layout { display: flex; gap: 16px; flex: 1; min-height: 0; }
    
    /* Side Panel */
    .ap-side-panel { width: 260px; flex-shrink: 0; display: flex; flex-direction: column; overflow-y: auto; scrollbar-width: none; }
    .ap-side-panel::-webkit-scrollbar { display: none; }
    
    .ap-panel-section { padding: 16px; border-bottom: 1px solid var(--border); }
    .ap-label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
    
    .premium-select {
      width: 100%; background: rgba(15, 23, 42, 0.4); border: 1px solid var(--border);
      border-radius: 10px; padding: 10px 12px; color: var(--text-primary);
      font-size: 13px; appearance: none; outline: none; cursor: pointer;
      transition: all 0.2s; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 10px center;
    }

    .premium-input {
      width: 100%; background: rgba(15, 23, 42, 0.4); border: 1px solid var(--border);
      border-radius: 10px; padding: 10px 12px; color: var(--text-primary);
      font-size: 13px; outline: none; transition: all 0.2s;
    }

    .field-pill-container { display: flex; flex-direction: column; gap: 6px; }
    .field-pill {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px; border-radius: 10px; background: rgba(30, 41, 59, 0.3);
      border: 1px solid var(--border); font-size: 12px; color: var(--text-secondary);
      transition: all 0.2s; cursor: pointer;
    }
    .field-pill:hover { background: rgba(30, 41, 59, 0.5); border-color: var(--border-hi); color: var(--text-primary); }
    .field-pill.active { border-color: rgba(99, 102, 241, 0.3); background: rgba(99, 102, 241, 0.08); color: var(--accent-light); }

    /* Insights Header */
    .ap-insights-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 4px; }
    .insight-card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px;
      padding: 16px; display: flex; flex-direction: column; gap: 8px;
    }
    .insight-header { display: flex; align-items: center; gap: 10px; }
    .insight-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
    .insight-title { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
    .insight-value { font-size: 20px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.01em; }
    .insight-subtext { font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); }

    /* Visuals Section */
    .ap-visuals-row { display: grid; grid-template-columns: 1.5fr 1fr; gap: 16px; margin-bottom: 16px; min-height: 240px; }
    .chart-box { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .chart-title { font-size: 12px; font-weight: 700; color: var(--text-secondary); display: flex; align-items: center; gap: 8px; }

    /* Data Preview */
    .ap-data-view { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .ap-table-scroll { flex: 1; overflow: auto; scrollbar-width: thin; }
    
    .premium-table { width: 100%; border-collapse: separate; border-spacing: 0; }
    .premium-table th {
      position: sticky; top: 0; z-index: 10;
      background: var(--bg-card); padding: 12px 16px;
      text-align: left; font-size: 11px; font-weight: 700;
      color: var(--text-muted); text-transform: uppercase;
      letter-spacing: 0.05em; border-bottom: 1px solid var(--border);
    }
    .premium-table td {
      padding: 12px 16px; font-size: 13px; color: var(--text-secondary);
      border-bottom: 1px solid rgba(148, 163, 184, 0.05);
      white-space: nowrap; transition: all 0.15s;
    }
    .premium-table tr:hover td { background: rgba(99, 102, 241, 0.03); color: var(--text-primary); }
    
    .cell-num { font-family: var(--font-mono); font-size: 12px; }
    .cell-primary { color: var(--text-primary); font-weight: 600; }
    .cell-amount { font-family: var(--font-mono); font-weight: 700; color: var(--emerald); }
    .cell-negative { color: var(--rose) !important; }
    .cell-zero { color: var(--text-muted) !important; opacity: 0.5; }
    
    .row-totals td {
      background: var(--bg-elevated); border-top: 2px solid var(--border);
      font-weight: 800; color: var(--text-primary); position: sticky; bottom: 0;
    }

    .shimmer { background: linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent); background-size: 200% 100%; animation: shimmerLoad 1.5s infinite; }
    @keyframes shimmerLoad { from { background-position: -200% 0; } to { background-position: 200% 0; } }
  `;

  return (
    <>
      <style>{css}</style>
      <div className="ap-container">
        {/* Top Navigation */}
        <div className="premium-card ap-top-bar">
          <div className="ap-module-title">
            <LayoutGrid size={20} color="var(--accent)" />
            TALLY INTELLIGENCE HUB
            <span className="ap-tag-live">v2.0 PRO</span>
          </div>
          
          <div className="btn-group">
             <button className="btn-action" onClick={() => setShowCharts(!showCharts)} title="Toggle Visuals">
               {showCharts ? <BarChart2 size={16} /> : <Activity size={16} />}
               {showCharts ? "HIDE CHARTS" : "SHOW CHARTS"}
             </button>
             <button className="btn-action" onClick={exportExcel} disabled={!data.length}><FileSpreadsheet size={16} /> EXCEL</button>
             <button className="btn-action btn-run" onClick={fetchData} disabled={loading}>
               {loading ? <RefreshCw size={16} className="spin" /> : <Play size={16} />}
               {loading ? "PROCESSING..." : "RUN ANALYSIS"}
             </button>
          </div>
        </div>

        <div className="ap-main-layout">
          {/* Side Control Panel */}
          <div className="premium-card ap-side-panel">
            <div className="ap-panel-section">
              <div className="ap-label"><Database size={14} /> Data Engine</div>
              <select className="premium-select" value={dataset} onChange={e => setDataset(e.target.value)}>
                {DATASET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {dataset === "transactions" && (
                <div style={{ marginTop: 12 }}>
                  <div className="ap-label">Sub-category</div>
                  <select className="premium-select" value={transactionType} onChange={e => setTransactionType(e.target.value)}>
                    {TRANSACTION_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="ap-panel-section">
              <div className="ap-label"><Filter size={14} /> Intelligence Filters</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="field-search-box">
                   <Search size={14} style={{ position: 'absolute', left: 10, top: 12, color: 'var(--text-muted)' }} />
                   <input className="premium-input" style={{ paddingLeft: 34 }} placeholder="Search records..." value={filters.search} onChange={e => setFilters(p => ({...p, search: e.target.value}))} />
                </div>
                <input className="premium-input" placeholder="Filter by Name..." value={filters.party_name} onChange={e => setFilters(p => ({...p, party_name: e.target.value}))} />
              </div>
            </div>

            <div className="ap-panel-section" style={{ flex: 1, borderBottom: 'none' }}>
              <div className="ap-label"><Zap size={14} /> Field Inventory</div>
              <div className="field-pill-container">
                {filteredAvailableFields.map(f => {
                   const isSelected = selectedColumns.includes(f);
                   return (
                     <div key={f} className={`field-pill ${isSelected ? 'active' : ''}`} onClick={() => !isSelected && addColumn(f)}>
                       <span>{f}</span>
                       {!isSelected && <span style={{ color: 'var(--accent)' }}>+</span>}
                     </div>
                   );
                })}
              </div>
            </div>
          </div>

          {/* Right Main Content */}
          <div className="ap-data-view">
            {/* Summary Insights */}
            {data.length > 0 && (
              <div className="ap-insights-grid">
                <InsightCard title="Total Volume" value={totals.amount || totals.value || "0.00"} icon={TrendingUp} color="16, 185, 129" subtext={`${data.length} Transactions`} />
                <InsightCard title="Top Contributor" value={distributionData[0]?.name || "N/A"} icon={Box} color="99, 102, 241" subtext={`Value: ₹${distributionData[0]?.value?.toLocaleString()}`} />
                <InsightCard title="Avg Transaction" value={(parseFloat(String(totals.amount || totals.value || "0").replace(/,/g, "")) / data.length).toLocaleString(undefined, { maximumFractionDigits: 2 })} icon={Activity} color="245, 158, 11" subtext="Calculated from View" />
                <InsightCard title="System Latency" value={`${fetchTime || 0}ms`} icon={Zap} color="236, 72, 153" subtext="Live Tally Sync" />
              </div>
            )}

            {/* Visualizations */}
            {data.length > 0 && showCharts && (
              <div className="ap-visuals-row">
                <div className="premium-card chart-box">
                  <div className="chart-title"><TrendingUp size={16} color="var(--emerald)" /> Performance Trend</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" hide />
                      <Tooltip 
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="premium-card chart-box">
                  <div className="chart-title"><PieChartIcon size={16} color="var(--accent)" /> Contribution Mix</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={distributionData} layout="vertical">
                       <XAxis type="number" hide />
                       <YAxis dataKey="name" type="category" width={80} style={{ fontSize: '10px' }} />
                       <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px' }} />
                       <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {distributionData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                       </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Main Table */}
            <div className="premium-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
               <div className="ap-data-header">
                 <div className="ap-label" style={{ margin: 0 }}>Analysis Table</div>
                 <DragDropContext onDragEnd={onDragEnd}>
                   <Droppable droppableId="selectedColumns" direction="horizontal">
                     {(provided) => (
                       <div ref={provided.innerRef} {...provided.droppableProps} style={{ display: 'flex', gap: 6, overflowX: 'auto', maxWidth: '60%' }}>
                          {selectedColumns.map((col, idx) => (
                            <Draggable key={col} draggableId={col} index={idx}>
                              {(p) => (
                                <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} className="stat-badge" style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'grab', background: 'rgba(99,102,241,0.1)', color: 'var(--accent-light)' }}>
                                  {col} <X size={10} style={{ cursor: 'pointer' }} onClick={() => removeColumn(col)} />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                       </div>
                     )}
                   </Droppable>
                 </DragDropContext>
               </div>

               <div className="ap-table-scroll">
                  {!data.length && !loading ? (
                    <div className="empty-state">
                      <BarChart2 size={64} style={{ opacity: 0.1 }} />
                      <div className="empty-state-title">Awaiting Extraction</div>
                      <div className="empty-state-sub">Connect to Tally ERP and select your parameters to begin analysis.</div>
                    </div>
                  ) : (
                    <table className="premium-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          {tableHeaders.map(h => (
                            <SortableHeader key={h} field={h} label={columnsMeta.find(m=>m.key===h)?.label || h} sortState={sortState} onSort={handleSort} />
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          Array.from({ length: 15 }).map((_, i) => (
                            <tr key={i}>
                              <td className="shimmer" style={{ height: 40 }} />
                              {tableHeaders.map(h => <td key={h} className="shimmer" />)}
                            </tr>
                          ))
                        ) : (
                          pagedData.map((row, idx) => (
                            <tr key={idx}>
                              <td className="cell-num">{(page-1)*PAGE_SIZE + idx + 1}</td>
                              {tableHeaders.map(h => {
                                const v = row[h];
                                const meta = columnsMeta.find(m => m.key === h);
                                const align = meta?.align || "left";
                                const isNeg = String(v).includes("-") || String(v).includes("(");
                                const isZero = String(v).replace(/[^\d]/g, "") === "00" || v === "0";
                                return (
                                  <td key={h} style={{ textAlign: align }} className={`${h.includes("name") ? 'cell-primary' : 'cell-num'} ${meta?.type === 'currency' ? 'cell-amount' : ''} ${isNeg ? 'cell-negative' : ''} ${isZero ? 'cell-zero' : ''}`}>
                                    {meta?.type === 'currency' ? `₹${v}` : v}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        )}
                        {!loading && Object.keys(totals).length > 0 && (
                          <tr className="row-totals">
                            <td>Σ</td>
                            {tableHeaders.map(h => {
                              const val = totals[h];
                              const meta = columnsMeta.find(m => m.key === h);
                              return <td key={h} style={{ textAlign: 'right' }}>{val !== undefined ? (meta?.type === "currency" ? `₹${val}` : val) : "—"}</td>;
                            })}
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
               </div>

               {data.length > PAGE_SIZE && (
                 <div className="ap-pagination">
                   <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Showing {pagedData.length} of {data.length} records</span>
                   <div className="btn-group">
                     <button className="btn-page" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}>PREVIOUS</button>
                     <button className="btn-page" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}>NEXT</button>
                   </div>
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

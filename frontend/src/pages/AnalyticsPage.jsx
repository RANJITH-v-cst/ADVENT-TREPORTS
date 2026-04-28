import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
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
  TrendingUp,
  BarChart2,
  AlertCircle,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { getAnalyticsConfig, runAnalytics } from "../api";

// ─── Constants ────────────────────────────────────────────────────────────────

const DATASET_OPTIONS = [
  { value: "transactions", label: "Transactions" },
  { value: "item_master", label: "Item Master" },
  { value: "ledger_master", label: "Ledger Master" },
  { value: "sundry_debtors", label: "Sundry Debtors" },
  { value: "sundry_creditors", label: "Sundry Creditors" },
];

const TRANSACTION_TYPES = [
  { value: "sales", label: "Sales" },
  { value: "purchase", label: "Purchase" },
];

const GROUP_BY_LABELS = {
  "": "None",
  party_name: "Party Name",
  item_name: "Item Name",
  ledger_name: "Ledger Name",
  date: "Date",
  gst: "GST Number",
};

const CALCULATIONS = [
  { key: "balance_difference", label: "Balance Difference" },
  { key: "percentage", label: "Percentage" },
  { key: "total_amount", label: "Total Amount" },
];

const DEFAULT_FIELDS = {
  transactions: ["date", "party_name", "item_name", "quantity", "amount"],
  item_master: ["item_name", "opening_stock", "closing_stock", "rate", "value"],
  ledger_master: [
    "ledger_name",
    "address",
    "phone",
    "gst",
    "opening_balance",
    "closing_balance",
  ],
  sundry_debtors: [
    "ledger_name",
    "address",
    "phone",
    "gst",
    "opening_balance",
    "closing_balance",
    "balance_difference",
  ],
  sundry_creditors: [
    "ledger_name",
    "address",
    "phone",
    "gst",
    "opening_balance",
    "closing_balance",
    "balance_difference",
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") {
    return v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }
  return String(v);
};

const fmtINR = (n) => {
  const num = parseFloat(n) || 0;
  return "₹" + num.toLocaleString("en-IN", { maximumFractionDigits: 2 });
};

const isAmountField = (key) =>
  [
    "amount",
    "total_amount",
    "value",
    "opening_balance",
    "closing_balance",
    "balance_difference",
    "rate",
    "opening_stock",
    "closing_stock",
    "quantity",
  ].includes(key);

const getTopAmount = (row) =>
  parseFloat(
    row.amount ??
      row.total_amount ??
      row.value ??
      row.closing_balance ??
      row.balance_difference ??
      0,
  );

const getTopName = (row) =>
  row.party_name ??
  row.item_name ??
  row.ledger_name ??
  row.name ??
  Object.values(row)[0] ??
  "—";

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon: Icon, loading }) {
  const palette = {
    blue: {
      bg: "rgba(59,130,246,0.08)",
      border: "rgba(59,130,246,0.2)",
      text: "#60a5fa",
    },
    green: {
      bg: "rgba(16,185,129,0.08)",
      border: "rgba(16,185,129,0.2)",
      text: "#34d399",
    },
    amber: {
      bg: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.2)",
      text: "#fbbf24",
    },
    purple: {
      bg: "rgba(139,92,246,0.08)",
      border: "rgba(139,92,246,0.2)",
      text: "#a78bfa",
    },
  };
  const p = palette[color] || palette.blue;
  return (
    <div
      style={{
        flex: 1,
        padding: "14px 16px",
        background: p.bg,
        border: `1px solid ${p.border}`,
        borderRadius: "10px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 6,
        }}
      >
        {Icon && <Icon size={13} color={p.text} />}
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          {label}
        </span>
      </div>
      {loading ? (
        <div
          style={{
            height: 28,
            width: 120,
            borderRadius: 4,
            background: "var(--shimmer)",
            animation: "shimmer 1.2s infinite",
          }}
        />
      ) : (
        <div
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: p.text,
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          {value}
        </div>
      )}
      {sub && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function SortableHeader({ label, field, sortState, onSort }) {
  const active = sortState.field === field;
  return (
    <th
      onClick={() => onSort(field)}
      style={{
        padding: "10px 14px",
        textAlign: "left",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: active ? "var(--accent)" : "var(--text-muted)",
        background: "var(--bg-elevated)",
        borderBottom: "1px solid var(--border)",
        whiteSpace: "nowrap",
        position: "sticky",
        top: 0,
        zIndex: 1,
        cursor: "pointer",
        userSelect: "none",
        transition: "color 0.15s",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {label}
        {active ? (
          sortState.dir === "asc" ? (
            <ArrowUp size={10} />
          ) : (
            <ArrowDown size={10} />
          )
        ) : (
          <ArrowUpDown size={10} style={{ opacity: 0.3 }} />
        )}
      </span>
    </th>
  );
}

function ErrorBanner({ message, onRetry, onDismiss }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 14px",
        marginBottom: 10,
        background: "rgba(239,68,68,0.08)",
        border: "1px solid rgba(239,68,68,0.25)",
        borderRadius: 8,
      }}
    >
      <AlertCircle
        size={14}
        color="#f87171"
        style={{ flexShrink: 0, marginTop: 2 }}
      />
      <span
        style={{ flex: 1, fontSize: 12, color: "#fca5a5", lineHeight: 1.5 }}
      >
        {message}
      </span>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 9px",
              borderRadius: 4,
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#f87171",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        )}
        <button
          onClick={onDismiss}
          style={{
            fontSize: 11,
            padding: "2px 9px",
            borderRadius: 4,
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <X size={11} />
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  // Config & Data
  const [dataset, setDataset] = useState("transactions");
  const [transactionType, setTransactionType] = useState("sales");
  const [availableFields, setAvailableFields] = useState(
    DEFAULT_FIELDS.transactions,
  );
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [calculations, setCalculations] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    party_name: "",
    item_name: "",
  });
  const [groupBy, setGroupBy] = useState("");
  const [data, setData] = useState([]);
  const [columnsFromApi, setColumnsFromApi] = useState([]);
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [tableName, setTableName] = useState("Business_Analytics");
  const [fieldSearch, setFieldSearch] = useState("");
  const [lastRun, setLastRun] = useState(null);
  const [fetchTime, setFetchTime] = useState(null);

  // Table
  const [sortState, setSortState] = useState({ field: null, dir: "asc" });
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  // ── Load config when dataset changes ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setConfigLoading(true);
      setErrorMessage("");
      setData([]);
      setColumnsFromApi([]);
      setSelectedColumns([]);
      setGroupBy("");
      setPage(1);

      try {
        const response = await getAnalyticsConfig();
        if (cancelled) return;
        const result = response.data || {};

        let apiFields = [];
        if (dataset === "transactions") {
          apiFields = Object.values(
            result?.types?.transactions?.fields || {},
          ).flat();
        } else {
          apiFields = Object.values(
            result?.types?.masters?.fields_by_sub_type?.[dataset] || {},
          ).flat();
        }
        setAvailableFields(
          apiFields.length ? apiFields : DEFAULT_FIELDS[dataset] || [],
        );
      } catch {
        if (!cancelled) setAvailableFields(DEFAULT_FIELDS[dataset] || []);
      } finally {
        if (!cancelled) setConfigLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [dataset]);

  // ── Drag & Drop ───────────────────────────────────────────────────────────
  const onDragEnd = useCallback(
    ({ source, destination }) => {
      if (!destination) return;

      if (
        source.droppableId === "availableFields" &&
        destination.droppableId === "selectedColumns"
      ) {
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

      if (
        source.droppableId === "selectedColumns" &&
        destination.droppableId === "selectedColumns"
      ) {
        setSelectedColumns((prev) => {
          const next = [...prev];
          const [moved] = next.splice(source.index, 1);
          next.splice(destination.index, 0, moved);
          return next;
        });
      }
    },
    [selectedColumns],
  ); // eslint-disable-line

  // ── Column helpers ────────────────────────────────────────────────────────
  const removeColumn = (col) =>
    setSelectedColumns((p) => p.filter((c) => c !== col));
  const addColumn = (col) => {
    if (!selectedColumns.includes(col)) setSelectedColumns((p) => [...p, col]);
  };
  const selectAll = () => setSelectedColumns([...availableFields]);
  const clearAll = () => {
    setSelectedColumns([]);
    setData([]);
    setColumnsFromApi([]);
  };
  const toggleCalc = (k) =>
    setCalculations((p) =>
      p.includes(k) ? p.filter((x) => x !== k) : [...p, k],
    );

  // ── Run Analysis ──────────────────────────────────────────────────────────
  const fetchData = async () => {
    if (selectedColumns.length === 0) {
      setErrorMessage("Select at least one column before running analysis.");
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
        filters,
        group_by: groupBy ? [groupBy] : [],
      };

      const res = await runAnalytics(payload);
      const result = res.data || {};

      setData(result.data || []);
      setColumnsFromApi(result.columns || []);
      if (result.available_fields?.length)
        setAvailableFields(result.available_fields);

      const msg = result.error || result.message;
      if (msg) setErrorMessage(msg);

      setSortState({ field: null, dir: "asc" });
      setPage(1);
      setLastRun(new Date());
      setFetchTime(Math.round(performance.now() - t0));
    } catch (err) {
      const apiError =
        err?.response?.data?.error || err?.message || "Failed to run analysis.";
      setErrorMessage(apiError);
    } finally {
      setLoading(false);
    }
  };

  // ── Sorting ───────────────────────────────────────────────────────────────
  const handleSort = (field) => {
    setSortState((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" },
    );
    setPage(1);
  };

  const sortedData = useMemo(() => {
    if (!sortState.field) return data;
    return [...data].sort((a, b) => {
      const av = a[sortState.field],
        bv = b[sortState.field];
      const an = parseFloat(av),
        bn = parseFloat(bv);
      let cmp =
        !isNaN(an) && !isNaN(bn)
          ? an - bn
          : String(av ?? "").localeCompare(String(bv ?? ""));
      return sortState.dir === "asc" ? cmp : -cmp;
    });
  }, [data, sortState]);

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE));
  const pagedData = sortedData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Headers ───────────────────────────────────────────────────────────────
  const tableHeaders = useMemo(() => {
    if (columnsFromApi.length > 0) return columnsFromApi;
    if (data.length > 0) return Object.keys(data[0]);
    if (selectedColumns.length > 0) return selectedColumns;
    return availableFields;
  }, [columnsFromApi, data, selectedColumns, availableFields]);

  // ── Filtered available fields ─────────────────────────────────────────────
  const filteredAvailableFields = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase();
    return q
      ? availableFields.filter((f) => f.toLowerCase().includes(q))
      : availableFields;
  }, [availableFields, fieldSearch]);

  // ── Insights ──────────────────────────────────────────────────────────────
  const insights = useMemo(() => {
    if (!data.length) return null;
    let totalAmt = 0,
      topRow = null;
    data.forEach((row) => {
      const amt = getTopAmount(row);
      totalAmt += amt;
      if (!topRow || amt > getTopAmount(topRow)) topRow = row;
    });
    return {
      totalAmt,
      topName: getTopName(topRow),
      topAmt: getTopAmount(topRow),
      count: data.length,
    };
  }, [data]);

  // ── Exports ───────────────────────────────────────────────────────────────
  const buildExportRows = () =>
    sortedData.map((row, i) => {
      const shaped = { sr_no: i + 1 };
      tableHeaders.forEach((h) => {
        shaped[h] = row[h] ?? "";
      });
      return shaped;
    });

  const exportCSV = () => {
    if (!sortedData.length) return;
    const ws = XLSX.utils.json_to_sheet(buildExportRows());
    const csv = XLSX.utils.sheet_to_csv(ws);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    a.download = `${tableName || "Analytics"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const exportExcel = () => {
    if (!sortedData.length) return;
    const ws = XLSX.utils.json_to_sheet(buildExportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tableName || "Analytics");
    XLSX.writeFile(wb, `${tableName || "Analytics"}.xlsx`);
  };

  const exportPDF = () => {
    if (!sortedData.length) return;
    const doc = new jsPDF();
    const rows = buildExportRows();
    const cols = ["sr_no", ...tableHeaders];
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(
      `${tableName || "Analytics Report"} — ${dataset.replace("_", " ").toUpperCase()}`,
      14,
      14,
    );
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Generated: ${new Date().toLocaleString("en-IN")}  |  Records: ${rows.length}`,
      14,
      21,
    );
    doc.autoTable({
      head: [cols.map((k) => k.toUpperCase().replaceAll("_", " "))],
      body: rows.map((row) => cols.map((k) => row[k] ?? "")),
      startY: 26,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [30, 41, 59], textColor: [148, 163, 184] },
      alternateRowStyles: { fillColor: [15, 23, 42] },
    });
    doc.save(`${tableName || "Analytics"}.pdf`);
  };

  // ─── Styles ────────────────────────────────────────────────────────────────

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');

    .ap-root * { box-sizing: border-box; }

    .ap-root {
      --accent:    #3b82f6;
      --green:     #10b981;
      --amber:     #f59e0b;
      --red:       #ef4444;
      --purple:    #8b5cf6;
      --bg-main:   #0d1117;
      --bg-card:   #161b26;
      --bg-elevated: #1c2336;
      --bg-input:  #1a2035;
      --border:    #252e42;
      --border-hi: #2e3a52;
      --text-primary:   #e2e8f0;
      --text-secondary: #8a92a6;
      --text-muted:     #4a5568;
      --font-ui:      'DM Sans', sans-serif;
      --font-display: 'Syne', sans-serif;
      --font-mono:    'JetBrains Mono', monospace;
      --shimmer: linear-gradient(90deg, #1c2336 25%, #252e42 50%, #1c2336 75%);
      font-family: var(--font-ui);
      color: var(--text-primary);
      font-size: 13px;
      display: flex;
      flex-direction: column;
      height: 100%;
      gap: 12px;
      padding: 16px;
    }

    @keyframes shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: none; }
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .ap-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
    }

    /* Header */
    .ap-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      flex-shrink: 0;
    }
    .ap-title {
      display: flex; align-items: center; gap: 8px;
      font-family: var(--font-display);
      font-size: 17px; font-weight: 800;
      letter-spacing: -0.02em;
    }
    .ap-badge {
      font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 2px 8px; border-radius: 4px;
      background: rgba(59,130,246,0.12);
      color: var(--accent);
      border: 1px solid rgba(59,130,246,0.2);
    }
    .ap-actions { display: flex; gap: 8px; align-items: center; }

    /* Table name row */
    .ap-tablename {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 18px;
      border-top: 1px solid var(--border);
      flex-shrink: 0;
    }
    .ap-tablename-label {
      font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase; color: var(--text-muted); white-space: nowrap;
    }

    /* Buttons */
    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 7px 14px; border-radius: 8px;
      font-size: 12px; font-weight: 500;
      cursor: pointer; border: 1px solid;
      font-family: var(--font-ui);
      transition: all 0.15s;
      white-space: nowrap;
    }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-ghost {
      background: var(--bg-elevated); border-color: var(--border-hi);
      color: var(--text-secondary);
    }
    .btn-ghost:not(:disabled):hover {
      border-color: var(--accent); color: var(--accent);
      background: rgba(59,130,246,0.08);
    }
    .btn-primary {
      background: var(--accent); border-color: var(--accent);
      color: #fff; font-weight: 600;
    }
    .btn-primary:not(:disabled):hover { background: #2563eb; border-color: #2563eb; }

    /* Workspace */
    .ap-workspace {
      display: flex; gap: 12px; flex: 1; min-height: 0;
    }

    /* Left panel */
    .ap-left {
      width: 220px; flex-shrink: 0;
      display: flex; flex-direction: column; gap: 8px;
      overflow-y: auto; padding-right: 2px;
    }
    .ap-left::-webkit-scrollbar { width: 3px; }
    .ap-left::-webkit-scrollbar-thumb { background: var(--border-hi); border-radius: 2px; }

    .ap-section { padding: 12px; border-bottom: 1px solid var(--border); }
    .ap-section:last-child { border-bottom: none; }
    .ap-section-label {
      font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase; color: var(--text-muted);
      margin-bottom: 7px; display: flex; align-items: center; gap: 5px;
    }

    .ap-select-wrap { position: relative; }
    .ap-select {
      width: 100%; background: var(--bg-input);
      border: 1px solid var(--border-hi); border-radius: 7px;
      padding: 7px 26px 7px 10px;
      color: var(--text-primary); font-size: 12px; font-family: var(--font-ui);
      appearance: none; outline: none; cursor: pointer;
      transition: border-color 0.15s;
    }
    .ap-select:focus { border-color: var(--accent); }
    .ap-select-arrow {
      position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
      pointer-events: none; color: var(--text-muted);
    }

    .ap-input {
      width: 100%; background: var(--bg-input);
      border: 1px solid var(--border); border-radius: 7px;
      padding: 7px 10px; color: var(--text-primary);
      font-size: 12px; font-family: var(--font-ui); outline: none;
      transition: border-color 0.15s;
    }
    .ap-input::placeholder { color: var(--text-muted); }
    .ap-input:focus { border-color: var(--accent); }
    .ap-input-mono { font-family: var(--font-mono); font-size: 12px; color: var(--accent); }

    .ap-filter-stack { display: flex; flex-direction: column; gap: 5px; }

    .ap-calc-list { display: flex; flex-direction: column; gap: 6px; }
    .ap-calc-item {
      display: flex; align-items: center; gap: 8px;
      cursor: pointer; font-size: 12px; color: var(--text-secondary);
      padding: 3px 0; transition: color 0.15s;
    }
    .ap-calc-item:hover { color: var(--text-primary); }

    /* Fields search */
    .ap-fields-search-wrap { position: relative; margin-bottom: 7px; }
    .ap-fields-search-icon {
      position: absolute; left: 8px; top: 50%; transform: translateY(-50%);
      color: var(--text-muted);
    }
    .ap-search-input {
      width: 100%; background: var(--bg-input);
      border: 1px solid var(--border); border-radius: 7px;
      padding: 6px 10px 6px 26px;
      color: var(--text-primary); font-size: 11px; font-family: var(--font-ui);
      outline: none; transition: border-color 0.15s;
    }
    .ap-search-input::placeholder { color: var(--text-muted); }
    .ap-search-input:focus { border-color: var(--accent); }

    .ap-field-actions { display: flex; gap: 6px; margin-bottom: 7px; }
    .ap-field-btn {
      flex: 1; padding: 5px; font-size: 10px; font-weight: 600;
      border-radius: 5px; cursor: pointer; border: 1px solid;
      transition: all 0.15s; font-family: var(--font-ui);
    }
    .ap-field-btn-all {
      background: rgba(59,130,246,0.1); border-color: rgba(59,130,246,0.2);
      color: var(--accent);
    }
    .ap-field-btn-all:hover { background: rgba(59,130,246,0.18); }
    .ap-field-btn-clr {
      background: var(--bg-elevated); border-color: var(--border-hi);
      color: var(--text-secondary);
    }
    .ap-field-btn-clr:hover { color: var(--red); border-color: rgba(239,68,68,0.3); }

    .ap-field-list { display: flex; flex-direction: column; gap: 4px; max-height: 220px; overflow-y: auto; }
    .ap-field-list::-webkit-scrollbar { width: 3px; }
    .ap-field-list::-webkit-scrollbar-thumb { background: var(--border-hi); border-radius: 2px; }

    .ap-field-item {
      display: flex; align-items: center; justify-content: space-between;
      background: var(--bg-elevated); border: 1px solid var(--border);
      border-radius: 6px; padding: 5px 8px; gap: 6px;
      transition: border-color 0.15s;
    }
    .ap-field-item:hover { border-color: var(--border-hi); }
    .ap-field-item.selected { border-color: rgba(59,130,246,0.3); background: rgba(59,130,246,0.07); }
    .ap-field-item.dragging { border-color: var(--accent); background: rgba(59,130,246,0.15); }
    .ap-field-name { font-size: 11px; color: var(--text-secondary); font-family: var(--font-mono); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    .ap-add-btn {
      font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 4px;
      cursor: pointer; border: 1px solid; transition: all 0.15s; flex-shrink: 0;
      background: rgba(59,130,246,0.1); color: var(--accent); border-color: rgba(59,130,246,0.2);
    }
    .ap-add-btn:hover { background: var(--accent); color: #fff; }
    .ap-add-btn.added { background: rgba(16,185,129,0.1); color: #34d399; border-color: rgba(16,185,129,0.2); cursor: default; }

    /* Middle panel */
    .ap-mid {
      width: 220px; flex-shrink: 0;
    }
    .ap-mid-inner {
      height: 100%;
      display: flex; flex-direction: column;
      padding: 12px;
    }
    .ap-mid-label {
      font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase; color: var(--text-muted);
      margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;
    }
    .ap-col-count {
      background: rgba(59,130,246,0.1); color: var(--accent);
      padding: 2px 7px; border-radius: 10px; font-size: 10px;
    }
    .ap-drop-zone {
      flex: 1; overflow-y: auto; border-radius: 8px;
      border: 1.5px dashed var(--border-hi);
      padding: 8px; display: flex; flex-direction: column; gap: 5px;
      min-height: 0; transition: border-color 0.2s, background 0.2s;
    }
    .ap-drop-zone.over {
      border-color: var(--accent); background: rgba(59,130,246,0.04);
    }
    .ap-drop-zone::-webkit-scrollbar { width: 3px; }
    .ap-drop-zone::-webkit-scrollbar-thumb { background: var(--border-hi); border-radius: 2px; }
    .ap-col-empty {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      color: var(--text-muted); font-size: 12px; text-align: center;
      gap: 6px; padding: 20px 10px;
    }
    .ap-col-item {
      display: flex; align-items: center; gap: 6px;
      background: var(--bg-elevated); border: 1px solid var(--border-hi);
      border-radius: 6px; padding: 7px 8px; font-size: 12px;
      color: var(--text-secondary); font-family: var(--font-mono);
      cursor: grab; transition: background 0.15s; user-select: none;
    }
    .ap-col-item:hover { background: var(--bg-card); color: var(--text-primary); }
    .ap-col-item.dragging-col { opacity: 0.7; border-color: var(--accent); }
    .ap-col-grip { color: var(--text-muted); flex-shrink: 0; }
    .ap-col-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ap-col-remove {
      color: var(--text-muted); cursor: pointer; flex-shrink: 0;
      transition: color 0.15s; padding: 2px;
    }
    .ap-col-remove:hover { color: var(--red); }

    /* Right panel */
    .ap-right {
      flex: 1; min-width: 0;
      display: flex; flex-direction: column; gap: 10px;
    }

    /* KPI row */
    .ap-kpi-row { display: flex; gap: 10px; flex-shrink: 0; }

    /* Preview area */
    .ap-preview {
      flex: 1; min-height: 0;
      display: flex; flex-direction: column;
    }
    .ap-preview-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 9px 14px; background: var(--bg-elevated);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0; border-radius: 12px 12px 0 0;
    }
    .ap-preview-title {
      font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase; color: var(--text-muted);
    }
    .ap-preview-tag {
      font-size: 10px; font-weight: 600; font-family: var(--font-mono);
      padding: 2px 7px; border-radius: 4px;
    }
    .ap-preview-tag.ready   { background: rgba(16,185,129,0.1); color: #34d399; }
    .ap-preview-tag.loading { background: rgba(245,158,11,0.1);  color: var(--amber); animation: shimmer 1.2s infinite; background-size: 200%; }
    .ap-preview-tag.empty   { background: var(--bg-elevated); color: var(--text-muted); }
    .ap-preview-meta { display: flex; align-items: center; gap: 10px; font-size: 11px; color: var(--text-muted); }
    .ap-preview-meta span { font-family: var(--font-mono); font-size: 10px; }
    .ap-preview-name { color: var(--accent); }
    .ap-preview-timing { color: var(--amber); }

    .ap-table-wrap { flex: 1; overflow: auto; min-height: 0; border-radius: 0 0 12px 12px; }
    .ap-table-wrap::-webkit-scrollbar { width: 4px; height: 4px; }
    .ap-table-wrap::-webkit-scrollbar-thumb { background: var(--border-hi); border-radius: 2px; }

    .ap-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .ap-table td {
      padding: 9px 14px; border-bottom: 1px solid var(--border);
      color: var(--text-secondary); vertical-align: middle; white-space: nowrap;
    }
    .ap-table tr:last-child td { border-bottom: none; }
    .ap-table tr:hover td { background: rgba(59,130,246,0.04); }
    .td-num    { font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); }
    .td-primary { color: var(--text-primary); font-weight: 500; }
    .td-amount  { font-family: var(--font-mono); font-weight: 600; color: #34d399; }
    .td-zero    { font-family: var(--font-mono); color: var(--text-muted); }
    .td-badge   { display: inline-block; background: rgba(59,130,246,0.1); color: var(--accent); padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; font-family: var(--font-mono); }
    .td-mono    { font-family: var(--font-mono); font-size: 11px; }
    .td-dash    { color: var(--text-muted); }

    .ap-empty {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 60px 20px; color: var(--text-muted); gap: 8px; text-align: center;
    }
    .ap-empty-icon { opacity: 0.2; }
    .ap-empty-text { font-size: 13px; color: var(--text-secondary); }
    .ap-empty-sub  { font-size: 11px; font-family: var(--font-mono); }

    .ap-spinner {
      width: 14px; height: 14px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }

    /* Pagination */
    .ap-pagination {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 14px; border-top: 1px solid var(--border);
      flex-shrink: 0; font-size: 11px; color: var(--text-muted);
    }
    .ap-page-btn {
      padding: 3px 10px; border-radius: 5px; cursor: pointer; font-size: 11px;
      background: var(--bg-elevated); border: 1px solid var(--border-hi);
      color: var(--text-secondary); transition: all 0.15s;
    }
    .ap-page-btn:not(:disabled):hover { border-color: var(--accent); color: var(--accent); }
    .ap-page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
    .ap-page-info { font-family: var(--font-mono); }
  `;

  // ─── Render ────────────────────────────────────────────────────────────────

  const hasData = data.length > 0;
  const isLoading = loading;

  return (
    <>
      <style>{css}</style>
      <div className="ap-root">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="ap-card" style={{ flexShrink: 0 }}>
          <div className="ap-header">
            <div className="ap-title">
              <Filter size={18} color="var(--accent)" />
              Dynamic Analytics Module
              <span className="ap-badge">Live</span>
            </div>
            <div className="ap-actions">
              <button
                className="btn btn-ghost"
                onClick={exportCSV}
                disabled={!hasData}
              >
                <FileText size={13} /> CSV
              </button>
              <button
                className="btn btn-ghost"
                onClick={exportExcel}
                disabled={!hasData}
              >
                <FileSpreadsheet size={13} /> Excel
              </button>
              <button
                className="btn btn-ghost"
                onClick={exportPDF}
                disabled={!hasData}
              >
                <Download size={13} /> PDF
              </button>
              <button
                className="btn btn-primary"
                onClick={fetchData}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="ap-spinner" />
                ) : (
                  <Play size={13} />
                )}
                {isLoading ? "Analyzing…" : "Run Analysis"}
              </button>
            </div>
          </div>

          <div className="ap-tablename">
            <span className="ap-tablename-label">Table Name</span>
            <input
              className="ap-input ap-input-mono"
              style={{ width: 200 }}
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="e.g. Business_Analytics"
            />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Used in CSV / Excel / PDF export file names
            </span>
          </div>
        </div>

        {/* ── Workspace ──────────────────────────────────────────────────── */}
        <div className="ap-workspace">
          <DragDropContext onDragEnd={onDragEnd}>
            {/* ── Left Panel ─────────────────────────────────────────────── */}
            <div className="ap-card ap-left">
              {/* Data Source */}
              <div className="ap-section">
                <div className="ap-section-label">Data Source</div>
                <div className="ap-select-wrap">
                  <select
                    className="ap-select"
                    value={dataset}
                    onChange={(e) => setDataset(e.target.value)}
                    disabled={configLoading}
                  >
                    {DATASET_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="ap-select-arrow" />
                </div>

                {dataset === "transactions" && (
                  <div style={{ marginTop: 7 }}>
                    <div
                      className="ap-section-label"
                      style={{ marginBottom: 5 }}
                    >
                      Transaction Type
                    </div>
                    <div className="ap-select-wrap">
                      <select
                        className="ap-select"
                        value={transactionType}
                        onChange={(e) => setTransactionType(e.target.value)}
                      >
                        {TRANSACTION_TYPES.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={12} className="ap-select-arrow" />
                    </div>
                  </div>
                )}
              </div>

              {/* Filters */}
              <div className="ap-section">
                <div className="ap-section-label">Filters</div>
                <div className="ap-filter-stack">
                  <input
                    className="ap-input"
                    placeholder="Search…"
                    value={filters.search}
                    onChange={(e) =>
                      setFilters((p) => ({ ...p, search: e.target.value }))
                    }
                  />
                  <input
                    className="ap-input"
                    placeholder="Party Name…"
                    value={filters.party_name}
                    onChange={(e) =>
                      setFilters((p) => ({ ...p, party_name: e.target.value }))
                    }
                  />
                  <input
                    className="ap-input"
                    placeholder="Item Name…"
                    value={filters.item_name}
                    onChange={(e) =>
                      setFilters((p) => ({ ...p, item_name: e.target.value }))
                    }
                  />
                </div>
              </div>

              {/* Group By */}
              <div className="ap-section">
                <div className="ap-section-label">Group By</div>
                <div className="ap-select-wrap">
                  <select
                    className="ap-select"
                    value={groupBy}
                    onChange={(e) => setGroupBy(e.target.value)}
                  >
                    <option value="">None</option>
                    {availableFields.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="ap-select-arrow" />
                </div>
              </div>

              {/* Calculations */}
              <div className="ap-section">
                <div className="ap-section-label">Calculations</div>
                <div className="ap-calc-list">
                  {CALCULATIONS.map(({ key, label }) => {
                    const checked = calculations.includes(key);
                    return (
                      <label
                        key={key}
                        className="ap-calc-item"
                        onClick={() => toggleCalc(key)}
                      >
                        {checked ? (
                          <CheckSquare size={14} color="var(--accent)" />
                        ) : (
                          <Square size={14} color="var(--text-muted)" />
                        )}
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Available Fields */}
              <div
                className="ap-section"
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                <div className="ap-section-label">
                  Available Fields
                  {configLoading && (
                    <RefreshCw
                      size={10}
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                  )}
                </div>

                <div className="ap-fields-search-wrap">
                  <Search size={11} className="ap-fields-search-icon" />
                  <input
                    className="ap-search-input"
                    placeholder="Search fields…"
                    value={fieldSearch}
                    onChange={(e) => setFieldSearch(e.target.value)}
                  />
                </div>

                <div className="ap-field-actions">
                  <button
                    className="ap-field-btn ap-field-btn-all"
                    onClick={selectAll}
                  >
                    Select All
                  </button>
                  <button
                    className="ap-field-btn ap-field-btn-clr"
                    onClick={clearAll}
                  >
                    Clear
                  </button>
                </div>

                <Droppable droppableId="availableFields" isDropDisabled={true}>
                  {(provided) => (
                    <div
                      className="ap-field-list"
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                    >
                      {filteredAvailableFields.map((field, index) => {
                        const isSelected = selectedColumns.includes(field);
                        return (
                          <Draggable
                            key={`af-${field}`}
                            draggableId={`af-${field}`}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`ap-field-item${isSelected ? " selected" : ""}${snapshot.isDragging ? " dragging" : ""}`}
                                style={provided.draggableProps.style}
                              >
                                <GripVertical
                                  size={11}
                                  style={{
                                    color: "var(--text-muted)",
                                    flexShrink: 0,
                                  }}
                                />
                                <span className="ap-field-name">{field}</span>
                                <button
                                  className={`ap-add-btn${isSelected ? " added" : ""}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addColumn(field);
                                  }}
                                  disabled={isSelected}
                                >
                                  {isSelected ? "✓" : "+ Add"}
                                </button>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                      {filteredAvailableFields.length === 0 && (
                        <div
                          style={{
                            padding: "16px 0",
                            textAlign: "center",
                            fontSize: 11,
                            color: "var(--text-muted)",
                          }}
                        >
                          No fields match "{fieldSearch}"
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            </div>

            {/* ── Middle Panel — Selected Columns ────────────────────────── */}
            <div className="ap-card ap-mid">
              <div className="ap-mid-inner">
                <div className="ap-mid-label">
                  Selected Columns
                  <span className="ap-col-count">{selectedColumns.length}</span>
                </div>

                <Droppable droppableId="selectedColumns">
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`ap-drop-zone${snapshot.isDraggingOver ? " over" : ""}`}
                    >
                      {selectedColumns.length === 0 ? (
                        <div className="ap-col-empty">
                          <BarChart2 size={24} style={{ opacity: 0.3 }} />
                          <span>Drag fields here or click Add</span>
                          <span
                            style={{
                              fontSize: 10,
                              fontFamily: "var(--font-mono)",
                            }}
                          >
                            columns define the table output
                          </span>
                        </div>
                      ) : (
                        selectedColumns.map((col, index) => (
                          <Draggable
                            key={`col-${col}`}
                            draggableId={`col-${col}`}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`ap-col-item${snapshot.isDragging ? " dragging-col" : ""}`}
                                style={provided.draggableProps.style}
                              >
                                <GripVertical
                                  size={12}
                                  className="ap-col-grip"
                                />
                                <span className="ap-col-name">{col}</span>
                                <span
                                  className="ap-col-remove"
                                  onClick={() => removeColumn(col)}
                                >
                                  <Trash2 size={11} />
                                </span>
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            </div>
          </DragDropContext>

          {/* ── Right Panel ─────────────────────────────────────────────── */}
          <div className="ap-right">
            {/* KPI Cards */}
            {(insights || isLoading) && (
              <div className="ap-kpi-row">
                <KpiCard
                  label="Total Analyzed Value"
                  value={insights ? fmtINR(insights.totalAmt) : "—"}
                  sub={`${insights?.count ?? 0} record${insights?.count !== 1 ? "s" : ""} · ${dataset.replace("_", " ")}`}
                  color="blue"
                  icon={TrendingUp}
                  loading={isLoading}
                />
                <KpiCard
                  label="Top Entity"
                  value={insights?.topName ?? "—"}
                  sub={insights ? fmtINR(insights.topAmt) : ""}
                  color="green"
                  icon={BarChart2}
                  loading={isLoading}
                />
                <KpiCard
                  label="Dataset"
                  value={
                    DATASET_OPTIONS.find((o) => o.value === dataset)?.label ??
                    dataset
                  }
                  sub={
                    dataset === "transactions"
                      ? `Type: ${transactionType}`
                      : groupBy
                        ? `Grouped by: ${groupBy}`
                        : "No grouping"
                  }
                  color="purple"
                  loading={isLoading}
                />
              </div>
            )}

            {/* Error Banner */}
            {errorMessage && (
              <ErrorBanner
                message={errorMessage}
                onRetry={hasData ? undefined : fetchData}
                onDismiss={() => setErrorMessage("")}
              />
            )}

            {/* Preview Table */}
            <div className="ap-card ap-preview">
              <div className="ap-preview-header">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="ap-preview-title">Preview</span>
                  <span
                    className={`ap-preview-tag ${isLoading ? "loading" : hasData ? "ready" : "empty"}`}
                  >
                    {isLoading
                      ? "analyzing…"
                      : hasData
                        ? `${data.length} record${data.length !== 1 ? "s" : ""}`
                        : "no data"}
                  </span>
                </div>
                <div className="ap-preview-meta">
                  <span className="ap-preview-name">
                    {tableName || "Analytics Report"}
                  </span>
                  <span>·</span>
                  <span>
                    {DATASET_OPTIONS.find((o) => o.value === dataset)?.label}
                  </span>
                  {dataset === "transactions" && (
                    <>
                      <span>·</span>
                      <span>{transactionType}</span>
                    </>
                  )}
                  {groupBy && (
                    <>
                      <span>·</span>
                      <span>grouped by {groupBy}</span>
                    </>
                  )}
                  {fetchTime !== null && hasData && (
                    <>
                      <span>·</span>
                      <span className="ap-preview-timing">{fetchTime}ms</span>
                    </>
                  )}
                  {lastRun && (
                    <>
                      <span>·</span>
                      <span>{lastRun.toLocaleTimeString("en-IN")}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="ap-table-wrap">
                {isLoading ? (
                  <div className="ap-empty">
                    <RefreshCw
                      size={28}
                      className="ap-empty-icon"
                      style={{
                        animation: "spin 1s linear infinite",
                        opacity: 0.5,
                      }}
                    />
                    <span className="ap-empty-text">Running analysis…</span>
                    <span className="ap-empty-sub">
                      Fetching from Tally ERP via FastAPI
                    </span>
                  </div>
                ) : !hasData ? (
                  <div className="ap-empty">
                    <BarChart2 size={32} className="ap-empty-icon" />
                    <span className="ap-empty-text">
                      {selectedColumns.length === 0
                        ? "Add columns and click Run Analysis"
                        : "Click Run Analysis to load data"}
                    </span>
                    <span className="ap-empty-sub">
                      {selectedColumns.length} column
                      {selectedColumns.length !== 1 ? "s" : ""} selected
                    </span>
                  </div>
                ) : (
                  <table className="ap-table">
                    <thead>
                      <tr>
                        <th
                          style={{
                            padding: "10px 14px",
                            textAlign: "left",
                            width: 52,
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: "var(--text-muted)",
                            background: "var(--bg-elevated)",
                            borderBottom: "1px solid var(--border)",
                            whiteSpace: "nowrap",
                            position: "sticky",
                            top: 0,
                            zIndex: 1,
                          }}
                        >
                          SR NO
                        </th>
                        {tableHeaders.map((h) => (
                          <SortableHeader
                            key={h}
                            field={h}
                            label={h.toUpperCase().replaceAll("_", " ")}
                            sortState={sortState}
                            onSort={handleSort}
                          />
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pagedData.map((row, idx) => (
                        <tr key={idx}>
                          <td className="td-num">
                            {(page - 1) * PAGE_SIZE + idx + 1}
                          </td>
                          {tableHeaders.map((h) => {
                            const v = row[h];
                            const isEmpty =
                              v === null || v === undefined || v === "";
                            if (isEmpty)
                              return (
                                <td key={h} className="td-dash">
                                  —
                                </td>
                              );

                            if (
                              h === "ledger_name" ||
                              h === "party_name" ||
                              h === "item_name"
                            )
                              return (
                                <td key={h} className="td-primary">
                                  {v}
                                </td>
                              );

                            if (h === "parent")
                              return (
                                <td key={h}>
                                  <span className="td-badge">{v}</span>
                                </td>
                              );

                            if (isAmountField(h)) {
                              const n = parseFloat(v);
                              if (!isNaN(n) && n === 0)
                                return (
                                  <td key={h} className="td-zero">
                                    ₹0
                                  </td>
                                );
                              if (!isNaN(n))
                                return (
                                  <td key={h} className="td-amount">
                                    {fmtINR(n)}
                                  </td>
                                );
                            }

                            if (h === "gst" || h === "phone")
                              return (
                                <td key={h} className="td-mono">
                                  {v}
                                </td>
                              );

                            if (h === "date")
                              return (
                                <td
                                  key={h}
                                  className="td-mono"
                                  style={{ color: "var(--text-secondary)" }}
                                >
                                  {v}
                                </td>
                              );

                            return <td key={h}>{fmt(v)}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination */}
              {hasData && totalPages > 1 && (
                <div className="ap-pagination">
                  <button
                    className="ap-page-btn"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    ← Prev
                  </button>
                  <span className="ap-page-info">
                    Page {page} / {totalPages}
                  </span>
                  <button
                    className="ap-page-btn"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next →
                  </button>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    Showing {(page - 1) * PAGE_SIZE + 1}–
                    {Math.min(page * PAGE_SIZE, data.length)} of {data.length}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

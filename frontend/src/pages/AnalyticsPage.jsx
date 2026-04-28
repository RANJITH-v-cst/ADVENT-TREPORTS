import React, { useEffect, useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Download, FileText, FileSpreadsheet, Filter, Play, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getAnalyticsConfig, runAnalytics } from '../api';

const DATASET_OPTIONS = [
  { value: 'transactions', label: 'Transactions' },
  { value: 'item_master', label: 'Item Master' },
  { value: 'ledger_master', label: 'Ledger Master' },
  { value: 'sundry_debtors', label: 'Sundry Debtors' },
  { value: 'sundry_creditors', label: 'Sundry Creditors' },
];

const TRANSACTION_TYPES = [
  { value: 'sales', label: 'Sales' },
  { value: 'purchase', label: 'Purchase' },
];

const DEFAULT_FIELDS = {
  transactions: ['date', 'party_name', 'item_name', 'quantity', 'amount'],
  item_master: ['item_name', 'opening_stock', 'closing_stock', 'rate', 'value'],
  ledger_master: ['ledger_name', 'address', 'phone', 'gst', 'opening_balance', 'closing_balance'],
  sundry_debtors: ['ledger_name', 'address', 'phone', 'gst', 'opening_balance', 'closing_balance', 'balance_difference'],
  sundry_creditors: ['ledger_name', 'address', 'phone', 'gst', 'opening_balance', 'closing_balance', 'balance_difference'],
};

export default function AnalyticsPage() {
  const [dataset, setDataset] = useState('transactions');
  const [transactionType, setTransactionType] = useState('sales');
  const [availableFields, setAvailableFields] = useState(DEFAULT_FIELDS.transactions);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [calculations, setCalculations] = useState([]);
  const [filters, setFilters] = useState({ search: '', party_name: '', item_name: '' });
  const [data, setData] = useState([]);
  const [columnsFromApi, setColumnsFromApi] = useState([]);
  const [groupBy, setGroupBy] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldSearch, setFieldSearch] = useState('');
  const [tableName, setTableName] = useState('Business_Analytics');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await getAnalyticsConfig();
        const result = response.data || {};
        const apiFields = dataset === 'transactions'
          ? Object.values(result?.types?.transactions?.fields || {}).flat()
          : Object.values(result?.types?.masters?.fields_by_sub_type?.[dataset] || {}).flat();
        setAvailableFields(apiFields || DEFAULT_FIELDS[dataset] || []);
      } catch {
        setAvailableFields(DEFAULT_FIELDS[dataset] || []);
      }
      setSelectedColumns([]);
      setData([]);
      setColumnsFromApi([]);
      setGroupBy('');
      setErrorMessage('');
    };

    loadConfig();
  }, [dataset]);

  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;

    if (source.droppableId === 'availableFields' && destination.droppableId === 'selectedColumns') {
      const field = availableFields[source.index];
      if (!selectedColumns.includes(field)) {
        setSelectedColumns((prev) => [...prev, field]);
      }
      return;
    }

    if (source.droppableId === 'selectedColumns' && destination.droppableId === 'selectedColumns') {
      const reordered = Array.from(selectedColumns);
      const [moved] = reordered.splice(source.index, 1);
      reordered.splice(destination.index, 0, moved);
      setSelectedColumns(reordered);
    }
  };

  const removeColumn = (column) => setSelectedColumns((prev) => prev.filter((item) => item !== column));
  const addColumn = (column) => {
    if (!selectedColumns.includes(column)) {
      setSelectedColumns((prev) => [...prev, column]);
    }
  };
  const selectAllColumns = () => setSelectedColumns(availableFields);
  const clearColumns = () => setSelectedColumns([]);

  const toggleCalculation = (calc) => {
    setCalculations((prev) =>
      prev.includes(calc) ? prev.filter((item) => item !== calc) : [...prev, calc]
    );
  };

  const fetchData = async () => {
    if (selectedColumns.length === 0) {
      setErrorMessage('Select at least one column before running analysis.');
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      const payload = {
        type: dataset === 'transactions' ? 'transactions' : 'masters',
        sub_type: dataset === 'transactions' ? transactionType : dataset,
        columns: selectedColumns,
        calculations,
        filters,
        group_by: groupBy ? [groupBy] : [],
      };
      const res = await runAnalytics(payload);
      const result = res.data || {};
      setData(result.data || []);
      setColumnsFromApi(result.columns || []);
      if (result.available_fields?.length) {
        setAvailableFields(result.available_fields);
      }
      if (result.error) {
        setErrorMessage(result.error);
      } else if (result.message) {
        setErrorMessage(result.message);
      }
    } catch (err) {
      const apiError = err?.response?.data?.error || err?.message || 'Failed to run analysis.';
      setErrorMessage(apiError);
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = () => {
    if (!data.length) return;
    const exportRows = data.map((row, idx) => {
      const shaped = { sr_no: idx + 1 };
      tableHeaders.forEach((header) => {
        shaped[header] = row[header];
      });
      return shaped;
    });
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tableName || 'Analytics');
    XLSX.writeFile(wb, `${tableName || `Analytics_${dataset}`}.xlsx`);
  };

  const exportCSV = () => {
    if (!data.length) return;
    const exportRows = data.map((row, idx) => {
      const shaped = { sr_no: idx + 1 };
      tableHeaders.forEach((header) => {
        shaped[header] = row[header];
      });
      return shaped;
    });
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${tableName || `Analytics_${dataset}`}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    if (!data.length) return;
    const doc = new jsPDF();
    doc.text(`${tableName || 'Analytics Report'} - ${dataset.toUpperCase()}`, 14, 15);
    const tableColumns = ['sr_no', ...tableHeaders].map((key) => ({ header: key.toUpperCase().replaceAll('_', ' '), dataKey: key }));
    const exportRows = data.map((row, idx) => {
      const shaped = { sr_no: idx + 1 };
      tableHeaders.forEach((header) => {
        shaped[header] = row[header];
      });
      return shaped;
    });
    doc.autoTable({
      head: [tableColumns.map((column) => column.header)],
      body: exportRows.map((row) => tableColumns.map((column) => row[column.dataKey])),
      startY: 20,
      styles: { fontSize: 8 },
    });

    doc.save(`${tableName || `Analytics_${dataset}`}.pdf`);
  };

  const filteredAvailableFields = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase();
    if (!q) return availableFields;
    return availableFields.filter((field) => field.toLowerCase().includes(q));
  }, [availableFields, fieldSearch]);

  const tableHeaders = useMemo(() => {
    if (columnsFromApi.length > 0) return columnsFromApi;
    if (data.length > 0) return Object.keys(data[0]);
    if (selectedColumns.length > 0) return selectedColumns;
    return availableFields;
  }, [availableFields, columnsFromApi, data, selectedColumns]);

  const formatCellValue = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'number') {
      return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    }
    return value;
  };

  const renderInsights = () => {
    if (!data.length) return null;
    let topItem = null;
    let totalAmt = 0;

    data.forEach(row => {
      const amt = parseFloat(row.amount || row.total_amount || row.value || row.closing_balance || 0);
      totalAmt += amt;
      if (!topItem || amt > parseFloat(topItem.amount || topItem.total_amount || topItem.value || topItem.closing_balance || 0)) {
        topItem = row;
      }
    });

    const keyName = topItem.party_name || topItem.item_name || topItem.ledger_name || topItem.name || Object.values(topItem)[0];
    const topAmt = parseFloat(topItem.amount || topItem.total_amount || topItem.value || topItem.closing_balance || 0);

    return (
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
        <div style={{ flex: 1, padding: '16px', background: 'rgba(79, 70, 229, 0.1)', borderRadius: '8px', border: '1px solid rgba(79, 70, 229, 0.2)' }}>
          <h4 style={{ margin: 0, color: 'var(--accent)', fontSize: '13px', marginBottom: '4px' }}>Total Analyzed Value</h4>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>₹{totalAmt.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
        </div>
        <div style={{ flex: 1, padding: '16px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <h4 style={{ margin: 0, color: '#10b981', fontSize: '13px', marginBottom: '4px' }}>Top Entity</h4>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{keyName} <span style={{ fontSize: '14px', fontWeight: 'normal' }}>(₹{topAmt.toLocaleString('en-IN')})</span></div>
        </div>
      </div>
    );
  };

  return (
    <div className="analytics-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      
      {/* Header Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '16px', borderRadius: '12px' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Filter size={24} color="var(--accent)" /> Dynamic Analytics Module</h2>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-secondary" onClick={exportCSV} disabled={!data.length}><FileText size={16} /> CSV</button>
          <button className="btn-secondary" onClick={exportExcel} disabled={!data.length}><FileSpreadsheet size={16} /> Excel</button>
          <button className="btn-secondary" onClick={exportPDF} disabled={!data.length}><Download size={16} /> PDF</button>
          <button className="btn-primary" onClick={fetchData} disabled={loading}>
            {loading ? <div className="spinner" style={{width: 16, height: 16}} /> : <Play size={16} />} 
            Run Analysis
          </button>
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', padding: '12px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>CUSTOM TABLE NAME</label>
        <input value={tableName} onChange={(e) => setTableName(e.target.value)} placeholder="e.g. Owner_Monthly_Sales" style={{ minWidth: '280px' }} />
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Used in CSV/Excel/PDF export file names</span>
      </div>

      <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>
        
        <DragDropContext onDragEnd={onDragEnd}>
          
          {/* LEFT PANEL */}
          <div style={{ width: '250px', background: 'var(--bg-card)', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>DATA SOURCE</label>
              <select value={dataset} onChange={(e) => setDataset(e.target.value)} style={{ width: '100%', marginTop: '8px', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                {DATASET_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>

            {dataset === 'transactions' && (
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>TRANSACTION TYPE</label>
                <select value={transactionType} onChange={(e) => setTransactionType(e.target.value)} style={{ width: '100%', marginTop: '8px', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  {TRANSACTION_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
            )}

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>FILTERS</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                <input type="text" placeholder="Search..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
                <input type="text" placeholder="Party Name..." value={filters.party_name} onChange={(e) => setFilters({ ...filters, party_name: e.target.value })} />
                <input type="text" placeholder="Item Name..." value={filters.item_name} onChange={(e) => setFilters({ ...filters, item_name: e.target.value })} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>GROUP BY</label>
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} style={{ width: '100%', marginTop: '8px', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <option value="">None</option>
                {availableFields.map((field) => <option key={`gb-${field}`} value={field}>{field}</option>)}
              </select>
            </div>
            
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>CALCULATIONS</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                  <input type="checkbox" checked={calculations.includes('balance_difference')} onChange={() => toggleCalculation('balance_difference')} /> Balance Difference
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                  <input type="checkbox" checked={calculations.includes('percentage')} onChange={() => toggleCalculation('percentage')} /> Percentage
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                  <input type="checkbox" checked={calculations.includes('total_amount')} onChange={() => toggleCalculation('total_amount')} /> Total Amount
                </label>
              </div>
            </div>

            <Droppable droppableId="availableFields" isDropDisabled={true}>
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>AVAILABLE FIELDS</label>
                  <input
                    type="text"
                    placeholder="Search fields..."
                    value={fieldSearch}
                    onChange={(e) => setFieldSearch(e.target.value)}
                    style={{ width: '100%', marginTop: '8px' }}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button type="button" className="btn-secondary" onClick={selectAllColumns}>Select All</button>
                    <button type="button" className="btn-secondary" onClick={clearColumns}>Clear</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    {filteredAvailableFields.map((field, index) => (
                      <Draggable key={`af-${field}`} draggableId={`af-${field}`} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={{
                              padding: '10px 12px',
                              background: snapshot.isDragging ? 'var(--accent)' : (selectedColumns.includes(field) ? 'rgba(79, 70, 229, 0.15)' : 'var(--bg-main)'),
                              color: snapshot.isDragging ? '#fff' : 'inherit',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              cursor: 'grab',
                              fontSize: '13px',
                              ...provided.draggableProps.style
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                              <span>{field}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addColumn(field);
                                }}
                                className="btn-secondary"
                                style={{ padding: '2px 6px', fontSize: '11px' }}
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>

          </div>

            {/* MIDDLE PANEL - FIELDS */}
          <div style={{ width: '300px', background: 'var(--bg-card)', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Droppable droppableId="selectedColumns">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  style={{
                    flex: 1,
                    background: snapshot.isDraggingOver ? 'rgba(79, 70, 229, 0.05)' : 'var(--bg-main)',
                    border: '1px dashed var(--border)',
                    borderRadius: '8px',
                    padding: '12px',
                  }}
                >
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px', display: 'block' }}>SELECTED COLUMNS</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedColumns.map((col, index) => (
                      <Draggable key={`col-${col}`} draggableId={`col-${col}`} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={{
                              padding: '8px 12px',
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              fontSize: '13px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              ...provided.draggableProps.style
                            }}
                          >
                            {col}
                            <Trash2 size={14} color="#ef4444" style={{ cursor: 'pointer' }} onClick={() => removeColumn(col)} />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {selectedColumns.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '20px 0' }}>Drag fields here to build table columns</div>}
                  </div>
                </div>
              )}
            </Droppable>

          </div>

        </DragDropContext>

        {/* RIGHT PANEL - TABLE + OUTPUT */}
        <div style={{ flex: 1, background: 'var(--bg-card)', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {renderInsights()}
          {!!errorMessage && (
            <div style={{ marginBottom: '10px', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.08)', color: '#fca5a5', fontSize: '13px' }}>
              {errorMessage}
            </div>
          )}

          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px' }}>PREVIEW ({data.length} records)</label>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <span><strong style={{ color: 'var(--text-main)' }}>{tableName || 'Analytics Report'}</strong> (export-ready)</span>
            <span>{dataset.replace('_', ' ')} {dataset === 'transactions' ? `• ${transactionType}` : ''}</span>
          </div>

          <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-main)' }}>
            <table className="data-table">
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr>
                  <th style={{ minWidth: '70px' }}>SR NO</th>
                  {tableHeaders.map((h) => <th key={h}>{h.toUpperCase().replaceAll('_', ' ')}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    {tableHeaders.map((h) => (
                      <td key={h}>
                        {formatCellValue(row[h])}
                      </td>
                    ))}
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={tableHeaders.length || 1} style={{ textAlign: 'center', padding: '40px' }}>
                      {loading ? 'Analyzing...' : 'No data. Add fields and click Run Analysis.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>

      </div>

    </div>
  );
}

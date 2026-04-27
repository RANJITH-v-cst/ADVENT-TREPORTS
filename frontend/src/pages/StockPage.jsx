import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getStock } from '../api';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Download, Printer, Package, ChevronRight, X } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const fmtAmt = (v) => v ? `₹${Math.abs(Number(v)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00';

const exportCSV = (data, filename) => {
  const csvContent = "data:text/csv;charset=utf-8," 
    + "Item Name,Group,Quantity,Unit,Rate,Value\n"
    + data.map(row => `"${row.name}","${row.group}",${row.quantity},"${row.unit}",${row.rate},${row.value}`).join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function StockPage() {
  const { searchTerm, fromDate, toDate } = useOutletContext();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    setLoading(true);
    getStock().then(r => setItems(r.data.items || []))
      .catch(e => setError(e.response?.data?.detail || 'Failed to load stock'))
      .finally(() => setLoading(false));
  }, [fromDate, toDate]);

  const filtered = items.filter(it => 
    !searchTerm || it.name.toLowerCase().includes(searchTerm.toLowerCase()) || it.group.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="loading">Checking Inventory...</div>;

  const top10 = [...filtered].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 10);
  const chartData = {
    labels: top10.map(d => d.name.length > 18 ? d.name.slice(0, 18) + '…' : d.name),
    datasets: [{ label: 'Value (₹)', data: top10.map(d => Math.abs(d.value)), backgroundColor: 'rgba(99,102,241,0.7)', borderRadius: 6, borderSkipped: false }],
  };
  const chartOpts = {
    indexAxis: 'y', responsive: true, maintainAspectRatio: true, aspectRatio: 2.5,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8', cornerRadius: 8, padding: 12 } },
    scales: { x: { grid: { color: 'rgba(148,163,184,0.08)' }, ticks: { color: '#64748b' } }, y: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } } },
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="header-title">
          <h2>Stock Inventory</h2>
          <p>{filtered.length} items in stock for selected period</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => exportCSV(filtered, 'stock_items.csv')}>
            <Download size={18} /> Export CSV
          </button>
          <button className="print-btn" onClick={() => window.print()}>
            <Printer size={18} /> Print
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {top10.length > 0 && <div className="chart-card glass"><h3>Top Stock Items by Value</h3><Bar data={chartData} options={chartOpts} /></div>}
        <div className="kpi-card glass highlight" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <div className="kpi-label">Total Inventory Value</div>
          <div className="kpi-value" style={{ fontSize: 36 }}>{fmtAmt(filtered.reduce((sum, i) => sum + i.value, 0))}</div>
          <div style={{ color: 'var(--text-muted)', marginTop: 8 }}>Based on {filtered.length} filtered items</div>
        </div>
      </div>

      <div className="data-table-wrap glass">
        <table className="data-table">
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Group</th>
              <th className="text-right">Quantity</th>
              <th>Unit</th>
              <th className="text-right">Value</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it, i) => (
              <tr key={i} onClick={() => setSelectedItem(it)} style={{ cursor: 'pointer' }}>
                <td style={{ fontWeight: 600 }}>{it.name}</td>
                <td>{it.group}</td>
                <td className="text-right">{it.quantity}</td>
                <td>{it.unit}</td>
                <td className="text-right positive" style={{ fontWeight: 700 }}>{fmtAmt(it.value)}</td>
                <td><ChevronRight size={16} color="var(--text-muted)" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Item Detail Modal */}
      {selectedItem && (
        <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedItem(null)}><X size={24} /></button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
              <div style={{ padding: 12, background: 'rgba(99, 102, 241, 0.1)', borderRadius: 12, color: 'var(--accent)' }}>
                <Package size={32} />
              </div>
              <div>
                <h3 style={{ fontSize: 24, fontWeight: 800 }}>{selectedItem.name}</h3>
                <p style={{ color: 'var(--text-muted)' }}>{selectedItem.group}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
              <div className="glass" style={{ padding: 20, borderRadius: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>QUANTITY</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{selectedItem.quantity} {selectedItem.unit}</div>
              </div>
              <div className="glass" style={{ padding: 20, borderRadius: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>AVG. RATE</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{fmtAmt(selectedItem.rate)}</div>
              </div>
            </div>

            <div className="glass highlight" style={{ padding: 24, borderRadius: 16, marginBottom: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>TOTAL STOCK VALUE</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent-light)' }}>{fmtAmt(selectedItem.value)}</div>
            </div>

            <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setSelectedItem(null)}>
              Close Detail
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

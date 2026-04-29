import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getStock } from '../api';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Download, Printer, Package, ChevronRight, X, Box, TrendingUp, Archive, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const fmtAmt = (v) => v ? `₹${Math.abs(Number(v)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00';

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

  if (loading) return (
    <div className="loading-wrap" style={{ height: '70vh', flexDirection: 'column', gap: 20 }}>
      <div className="spinner" />
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>AUDITING TALLY INVENTORY...</span>
    </div>
  );

  const top10 = [...filtered].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 10);
  const chartData = {
    labels: top10.map(d => d.name.length > 15 ? d.name.slice(0, 15) + '…' : d.name),
    datasets: [{ 
      label: 'Value (₹)', 
      data: top10.map(d => Math.abs(d.value)), 
      backgroundColor: 'rgba(99, 102, 241, 0.6)', 
      hoverBackgroundColor: 'rgba(99, 102, 241, 0.9)',
      borderRadius: 8, 
      borderSkipped: false 
    }],
  };

  const chartOpts = {
    indexAxis: 'y', 
    responsive: true, 
    maintainAspectRatio: false,
    plugins: { 
      legend: { display: false }, 
      tooltip: { 
        backgroundColor: '#0f172a', 
        titleFont: { family: 'Outfit', size: 12 },
        bodyFont: { family: 'Outfit', size: 12 },
        cornerRadius: 12, 
        padding: 12 
      } 
    },
    scales: { 
      x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#64748b', font: { family: 'Outfit' } } }, 
      y: { grid: { display: false }, ticks: { color: '#cbd5e1', font: { family: 'Outfit', size: 11 } } } 
    },
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="page-content">
      <div className="page-header">
        <div className="header-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Box size={24} color="var(--amber)" />
            <h2 style={{ margin: 0 }}>Inventory Intelligence</h2>
          </div>
          <p>{filtered.length} stock items tracked across groups</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => window.print()}>
            <Printer size={16} /> PRINT CATALOG
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24, marginBottom: 24 }}>
        <div className="chart-card glass-card" style={{ height: 320 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <TrendingUp size={16} color="var(--accent-light)" />
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Top Assets by Value</h3>
          </div>
          <div style={{ height: 'calc(100% - 40px)' }}>
            <Bar data={chartData} options={chartOpts} />
          </div>
        </div>

        <div className="kpi-card glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 12 }}>
          <div style={{ width: 64, height: 64, borderRadius: '20px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--amber)' }}>
            <Archive size={32} />
          </div>
          <div>
            <div className="kpi-label">Total Stock Value</div>
            <div className="kpi-value" style={{ fontSize: 32, letterSpacing: '-0.02em' }}>{fmtAmt(filtered.reduce((sum, i) => sum + i.value, 0))}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>Live Sync: {items.length} SKUs Identified</div>
          </div>
          <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.05)', margin: '10px 0' }} />
          <div style={{ display: 'flex', gap: 20 }}>
             <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--emerald)' }}><Activity size={12} style={{ display: 'inline', marginRight: 4 }} /> 85% Health</div>
             <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--sky)' }}><Package size={12} style={{ display: 'inline', marginRight: 4 }} /> {filtered.reduce((sum, i) => sum + i.quantity, 0)} Units</div>
          </div>
        </div>
      </div>

      <div className="data-table-wrap glass-card">
        <div className="data-table-header">
           <h3 style={{ margin: 0, fontSize: 14 }}>Inventory Ledger</h3>
           <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>SHOWING {filtered.length} ITEMS</div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ paddingLeft: 24 }}>Item Description</th>
              <th>Category</th>
              <th className="text-right">Quantity</th>
              <th>Unit</th>
              <th className="text-right" style={{ paddingRight: 24 }}>Net Value</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it, i) => (
              <motion.tr 
                key={i} 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                transition={{ delay: i * 0.02 }}
                onClick={() => setSelectedItem(it)} 
                style={{ cursor: 'pointer' }}
              >
                <td style={{ paddingLeft: 24, color: 'white', fontWeight: 600 }}>{it.name}</td>
                <td style={{ fontSize: 12 }}>{it.group}</td>
                <td className="text-right" style={{ fontFamily: 'monospace' }}>{it.quantity}</td>
                <td style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{it.unit}</td>
                <td className="text-right" style={{ paddingRight: 24, color: 'var(--emerald)', fontWeight: 700, fontFamily: 'monospace' }}>{fmtAmt(it.value)}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {selectedItem && (
          <div className="modal-overlay" onClick={() => setSelectedItem(null)} style={{ zIndex: 1000 }}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="modal-content glass-card" 
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: 500, padding: 32, background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(30px)' }}
            >
              <button className="modal-close" onClick={() => setSelectedItem(null)} style={{ top: 24, right: 24 }}><X size={20} /></button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32 }}>
                <div style={{ width: 56, height: 56, background: 'rgba(99, 102, 241, 0.1)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                  <Package size={28} />
                </div>
                <div>
                  <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'white' }}>{selectedItem.name}</h3>
                  <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 13, fontWeight: 600 }}>{selectedItem.group}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div style={{ padding: 20, borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 800, marginBottom: 6, letterSpacing: '0.05em' }}>QUANTITY ON HAND</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'white' }}>{selectedItem.quantity} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedItem.unit}</span></div>
                </div>
                <div style={{ padding: 20, borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 800, marginBottom: 6, letterSpacing: '0.05em' }}>VALUATION RATE</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'white' }}>{fmtAmt(selectedItem.rate)}</div>
                </div>
              </div>

              <div style={{ padding: 24, borderRadius: 20, background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.1)', textAlign: 'center', marginBottom: 32 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8 }}>AGGREGATED ASSET VALUE</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--accent-light)' }}>{fmtAmt(selectedItem.value)}</div>
              </div>

              <button className="btn-primary" style={{ width: '100%', padding: 14 }} onClick={() => setSelectedItem(null)}>
                DONE
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

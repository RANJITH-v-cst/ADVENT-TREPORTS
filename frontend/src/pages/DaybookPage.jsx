import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getDaybook } from '../api';
import { Download, Printer, ChevronRight, X, Receipt, ArrowUpRight, ArrowDownLeft, FileText, Calendar, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BADGE_MAP = { 
  'Sales': 'badge-sale', 'Purchase': 'badge-purchase', 
  'Payment': 'badge-payment', 'Receipt': 'badge-receipt', 
  'Journal': 'badge-journal', 'Contra': 'badge-contra' 
};
const getBadge = (type) => { for (const k in BADGE_MAP) { if (type?.includes(k)) return BADGE_MAP[k]; } return 'badge-journal'; };
const fmtAmt = (v) => v ? `₹${Math.abs(Number(v)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00';
const fmtDate = (d) => { if (!d || d.length !== 8) return d; return `${d.slice(6)}-${d.slice(4,6)}-${d.slice(0,4)}`; };

export default function DaybookPage({ filterType, title = 'Day Book' }) {
  const { searchTerm, fromDate, toDate } = useOutletContext();
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedVch, setSelectedVch] = useState(null);

  useEffect(() => {
    setLoading(true);
    getDaybook(fromDate, toDate).then(r => setVouchers(r.data.vouchers || []))
      .catch(e => setError(e.response?.data?.detail || 'Failed to load data'))
      .finally(() => setLoading(false));
  }, [fromDate, toDate]);

  const filtered = vouchers.filter(v => {
    if (filterType && v.type !== filterType && !v.type?.includes(filterType)) return false;
    const s = (searchTerm || '').toLowerCase();
    return !s || v.party?.toLowerCase().includes(s) || v.type?.toLowerCase().includes(s) || v.narration?.toLowerCase().includes(s);
  });

  if (loading) return (
    <div className="loading-wrap" style={{ height: '70vh', flexDirection: 'column', gap: 20 }}>
      <div className="spinner" />
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>RETRIEVING TRANSACTION LOGS...</span>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="page-content">
      <div className="page-header">
        <div className="header-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <FileText size={24} color="var(--accent)" />
            <h2 style={{ margin: 0 }}>{title}</h2>
          </div>
          <p>{filtered.length} synchronized vouchers identified for this period</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" style={{ borderRadius: '12px' }}>
            <Filter size={16} /> ADVANCED FILTER
          </button>
          <button className="btn-run-premium" style={{ padding: '10px 20px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => window.print()}>
            <Printer size={16} /> PRINT BATCH
          </button>
        </div>
      </div>

      <div className="data-table-wrap glass-card">
        <div className="data-table-header">
           <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
             <Calendar size={16} color="var(--text-muted)" />
             <h3 style={{ margin: 0, fontSize: 14 }}>Real-time Transaction Stream</h3>
           </div>
           <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>{filtered.length} RECORDS FOUND</div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ paddingLeft: 24 }}>Date</th>
              <th>Classification</th>
              <th>Vch No.</th>
              <th>Counterparty / Ledger</th>
              <th className="text-right" style={{ paddingRight: 24 }}>Nett Amount</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v, i) => (
              <motion.tr 
                key={i} 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                transition={{ delay: i * 0.01 }}
                onClick={() => setSelectedVch(v)} 
                style={{ cursor: 'pointer' }}
              >
                <td style={{ paddingLeft: 24, fontSize: 12, fontWeight: 500 }}>{fmtDate(v.date)}</td>
                <td><span className={`badge ${getBadge(v.type)}`}>{v.type}</span></td>
                <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{v.number}</td>
                <td style={{ fontWeight: 600, color: 'white' }}>{v.party || 'Multiple Ledgers'}</td>
                <td className="text-right" style={{ paddingRight: 24, fontWeight: 800, color: 'white', fontFamily: 'monospace' }}>{fmtAmt(v.amount)}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {selectedVch && (
          <div className="modal-overlay" onClick={() => setSelectedVch(null)} style={{ zIndex: 1000 }}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="modal-content glass-card" 
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: 600, padding: 32, background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(30px)' }}
            >
              <button className="modal-close" onClick={() => setSelectedVch(null)} style={{ top: 24, right: 24 }}><X size={20} /></button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32 }}>
                <div className={`badge ${getBadge(selectedVch.type)}`} style={{ width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)' }}>
                  <Receipt size={28} />
                </div>
                <div>
                  <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'white' }}>Transaction Detail</h3>
                  <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 13, fontWeight: 600 }}>{selectedVch.type} Voucher • Ref #{selectedVch.number}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 800, marginBottom: 4 }}>POSTING DATE</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>{fmtDate(selectedVch.date)}</div>
                </div>
                <div style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 800, marginBottom: 4 }}>VOUCHER REFERENCE</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>{selectedVch.number}</div>
                </div>
              </div>

              <div style={{ padding: 24, borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 24 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 12 }}>PRIMARY PARTICULARS</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>{selectedVch.party || 'Composite Entry'}</span>
                  <span style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent-light)' }}>{fmtAmt(selectedVch.amount)}</span>
                </div>
                {selectedVch.narration && (
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    "{selectedVch.narration}"
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn-run-premium" style={{ flex: 1, padding: 14, borderRadius: 12 }} onClick={() => window.print()}>
                  <Printer size={16} style={{ marginRight: 8 }} /> PRINT
                </button>
                <button className="btn-secondary" style={{ flex: 1, padding: 14, borderRadius: 12 }} onClick={() => setSelectedVch(null)}>
                  CLOSE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

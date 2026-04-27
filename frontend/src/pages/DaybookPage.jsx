import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getDaybook } from '../api';
import { Download, Printer, ChevronRight, X, Receipt, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

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

  if (loading) return <div className="loading">Loading Transactions...</div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="header-title">
          <h2>{title}</h2>
          <p>{filtered.length} entries found from {fmtDate(fromDate.replace(/-/g,''))} to {fmtDate(toDate.replace(/-/g,''))}</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => {}}>
            <Download size={18} /> Export CSV
          </button>
          <button className="print-btn" onClick={() => window.print()}>
            <Printer size={18} /> Print
          </button>
        </div>
      </div>

      <div className="data-table-wrap glass">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Voucher Type</th>
              <th>No.</th>
              <th>Party / Ledger</th>
              <th className="text-right">Amount</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v, i) => (
              <tr key={i} onClick={() => setSelectedVch(v)} style={{ cursor: 'pointer' }}>
                <td>{fmtDate(v.date)}</td>
                <td><span className={`badge ${getBadge(v.type)}`}>{v.type}</span></td>
                <td>{v.number}</td>
                <td>{v.party || 'Multiple Ledgers'}</td>
                <td className="text-right" style={{ fontWeight: 700 }}>{fmtAmt(v.amount)}</td>
                <td><ChevronRight size={16} color="var(--text-muted)" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Voucher Detail Modal */}
      {selectedVch && (
        <div className="modal-overlay" onClick={() => setSelectedVch(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedVch(null)}><X size={24} /></button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
              <div className={`badge ${getBadge(selectedVch.type)}`} style={{ padding: 12, borderRadius: 12 }}>
                <Receipt size={32} />
              </div>
              <div>
                <h3 style={{ fontSize: 24, fontWeight: 800 }}>Voucher Details</h3>
                <p style={{ color: 'var(--text-muted)' }}>{selectedVch.type} # {selectedVch.number}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
              <div className="glass" style={{ padding: 20, borderRadius: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>DATE</div>
                <div style={{ fontWeight: 600 }}>{fmtDate(selectedVch.date)}</div>
              </div>
              <div className="glass" style={{ padding: 20, borderRadius: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>VOUCHER NO</div>
                <div style={{ fontWeight: 600 }}>{selectedVch.number}</div>
              </div>
            </div>

            <div className="glass" style={{ padding: 24, borderRadius: 16, marginBottom: 32 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>PARTICULARS</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 18, fontWeight: 700 }}>{selectedVch.party || 'Direct Entry'}</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-light)' }}>{fmtAmt(selectedVch.amount)}</span>
              </div>
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', fontSize: 14, color: 'var(--text-secondary)' }}>
                <strong>Narration:</strong> {selectedVch.narration || 'No narration provided.'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => window.print()}>
                <Printer size={18} /> Print Voucher
              </button>
              <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setSelectedVch(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getLedgers } from '../api';
import { Download, Printer, BookOpen, ChevronRight, X } from 'lucide-react';

const fmtAmt = (v) => v ? `₹${Math.abs(Number(v)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00';

const exportCSV = (data, filename) => {
  const csvContent = "data:text/csv;charset=utf-8," 
    + "Ledger Name,Group,Opening Balance,Closing Balance\n"
    + data.map(row => `"${row.name}","${row.parent}",${row.opening},${row.closing}`).join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function LedgersPage() {
  const { searchTerm, fromDate, toDate } = useOutletContext();
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLedger, setSelectedLedger] = useState(null);

  useEffect(() => {
    setLoading(true);
    getLedgers().then(r => setLedgers(r.data.ledgers || [])).catch(() => {}).finally(() => setLoading(false));
  }, [fromDate, toDate]);

  const filtered = ledgers.filter(l => 
    !searchTerm || l.name?.toLowerCase().includes(searchTerm.toLowerCase()) || l.parent?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="loading">Listing Ledgers...</div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="header-title">
          <h2>Accounts Ledger</h2>
          <p>{filtered.length} ledgers active in Tally ERP</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => exportCSV(filtered, 'ledgers.csv')}>
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
              <th>Ledger Name</th>
              <th>Group</th>
              <th className="text-right">Opening Bal</th>
              <th className="text-right">Closing Bal</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l, i) => (
              <tr key={i} onClick={() => setSelectedLedger(l)} style={{ cursor: 'pointer' }}>
                <td style={{ fontWeight: 600 }}>{l.name}</td>
                <td style={{ color: 'var(--text-muted)' }}>{l.parent}</td>
                <td className="text-right">{fmtAmt(l.opening)} {l.opening > 0 ? 'Dr' : l.opening < 0 ? 'Cr' : ''}</td>
                <td className="text-right" style={{ fontWeight: 700 }}>{fmtAmt(l.closing)} {l.closing > 0 ? 'Dr' : l.closing < 0 ? 'Cr' : ''}</td>
                <td><ChevronRight size={16} color="var(--text-muted)" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ledger Detail Modal */}
      {selectedLedger && (
        <div className="modal-overlay" onClick={() => setSelectedLedger(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedLedger(null)}><X size={24} /></button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
              <div style={{ padding: 12, background: 'rgba(99, 102, 241, 0.1)', borderRadius: 12, color: 'var(--accent)' }}>
                <BookOpen size={32} />
              </div>
              <div>
                <h3 style={{ fontSize: 24, fontWeight: 800 }}>{selectedLedger.name}</h3>
                <p style={{ color: 'var(--text-muted)' }}>{selectedLedger.parent}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
              <div className="glass" style={{ padding: 20, borderRadius: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>OPENING</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{fmtAmt(selectedLedger.opening)} {selectedLedger.opening > 0 ? 'Dr' : 'Cr'}</div>
              </div>
              <div className="glass" style={{ padding: 20, borderRadius: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>CLOSING</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-light)' }}>{fmtAmt(selectedLedger.closing)} {selectedLedger.closing > 0 ? 'Dr' : 'Cr'}</div>
              </div>
            </div>

            <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }} onClick={() => window.print()}>
              View Monthly Ledger
            </button>
            <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setSelectedLedger(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

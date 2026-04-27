import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getTDSReport } from '../api';
import { Printer, AlertCircle, ChevronRight, X, FileText, Download } from 'lucide-react';

export default function TDSReportPage() {
  const { searchTerm, fromDate, toDate } = useOutletContext();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLedger, setSelectedLedger] = useState(null);

  useEffect(() => {
    getTDSReport()
      .then(res => {
        setData(res.data.ledgers);
        setLoading(false);
      })
      .catch(err => {
        setError(err.response?.data?.detail || "Failed to load TDS report");
        setLoading(false);
      });
  }, [fromDate, toDate]);

  const filtered = data.filter(l => 
    !searchTerm || l.name.toLowerCase().includes(searchTerm.toLowerCase()) || l.parent.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="loading">Loading TDS Report...</div>;
  if (error) return <div className="error-banner"><AlertCircle size={20}/> {error}</div>;

  const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v);

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="header-title">
          <h2>Taxation: TDS Report</h2>
          <p>Balances for {fromDate} to {toDate}</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => {
            const csv = "data:text/csv;charset=utf-8,Ledger,Parent,Balance\n" + filtered.map(l => `"${l.name}","${l.parent}",${l.balance}`).join("\n");
            const link = document.createElement("a"); link.href = encodeURI(csv); link.download = "tds_report.csv"; link.click();
          }}>
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
              <th>Group / Category</th>
              <th className="text-right">Closing Balance</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? filtered.map((l, idx) => (
              <tr key={idx} onClick={() => setSelectedLedger(l)} style={{ cursor: 'pointer' }}>
                <td style={{ fontWeight: 600 }}>{l.name}</td>
                <td>{l.parent}</td>
                <td className={`text-right ${l.balance >= 0 ? 'positive' : 'negative'}`} style={{ fontWeight: 700 }}>
                  {fmt(Math.abs(l.balance))} {l.balance >= 0 ? 'Dr' : 'Cr'}
                </td>
                <td><ChevronRight size={16} color="var(--text-muted)" /></td>
              </tr>
            )) : (
              <tr><td colSpan="4" className="text-center">No matching TDS records found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selectedLedger && (
        <div className="modal-overlay" onClick={() => setSelectedLedger(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedLedger(null)}><X size={24} /></button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
              <div style={{ padding: 12, background: 'rgba(6, 182, 212, 0.1)', borderRadius: 12, color: 'var(--cyan)' }}>
                <FileText size={32} />
              </div>
              <div>
                <h3 style={{ fontSize: 22, fontWeight: 800 }}>{selectedLedger.name}</h3>
                <p style={{ color: 'var(--text-muted)' }}>{selectedLedger.parent}</p>
              </div>
            </div>

            <div className="glass" style={{ padding: 24, borderRadius: 16, marginBottom: 32 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <span style={{ color: 'var(--text-muted)' }}>Tax Type</span>
                <span style={{ fontWeight: 600 }}>TDS Payable</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 18, fontWeight: 600 }}>Closing Balance</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: selectedLedger.balance >= 0 ? 'var(--emerald)' : 'var(--rose)' }}>
                  {fmt(Math.abs(selectedLedger.balance))} {selectedLedger.balance >= 0 ? 'Dr' : 'Cr'}
                </span>
              </div>
            </div>

            <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setSelectedLedger(null)}>
              Close Detail
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

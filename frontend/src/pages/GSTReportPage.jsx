import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getGSTReport } from '../api';
import { Printer, AlertCircle, X, ChevronRight, Receipt, Download } from 'lucide-react';

export default function GSTReportPage() {
  const { searchTerm, fromDate, toDate } = useOutletContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);

  useEffect(() => {
    getGSTReport()
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.response?.data?.detail || "Failed to load GST report");
        setLoading(false);
      });
  }, [fromDate, toDate]); // Reload data when date changes

  if (loading) return <div className="loading">Loading GST Report...</div>;
  if (error) return <div className="error-banner"><AlertCircle size={20}/> {error}</div>;

  const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v);

  const breakdown = [
    { id: 'igst', name: 'IGST (Integrated Tax)', value: data.igst, desc: 'Inter-state transactions tax' },
    { id: 'cgst', name: 'CGST (Central Tax)', value: data.cgst, desc: 'Intra-state central portion' },
    { id: 'sgst', name: 'SGST / UTGST (State Tax)', value: data.sgst, desc: 'Intra-state state portion' },
    { id: 'cess', name: 'Cess on GST', value: data.cess, desc: 'Compensation cess' },
  ].filter(item => !searchTerm || item.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="header-title">
          <h2>Taxation: GST Report</h2>
          <p>Summary for {fromDate} to {toDate}</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => {
            const csv = "data:text/csv;charset=utf-8,Component,Balance\n" + breakdown.map(b => `"${b.name}",${b.value}`).join("\n");
            const link = document.createElement("a"); link.href = encodeURI(csv); link.download = "gst_report.csv"; link.click();
          }}>
            <Download size={18} /> Export CSV
          </button>
          <button className="print-btn" onClick={() => window.print()}>
            <Printer size={18} /> Print Report
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card glass">
          <div className="kpi-label">IGST</div>
          <div className="kpi-value">{fmt(data.igst)}</div>
        </div>
        <div className="kpi-card glass">
          <div className="kpi-label">CGST</div>
          <div className="kpi-value">{fmt(data.cgst)}</div>
        </div>
        <div className="kpi-card glass">
          <div className="kpi-label">SGST</div>
          <div className="kpi-value">{fmt(data.sgst)}</div>
        </div>
        <div className="kpi-card glass highlight">
          <div className="kpi-label">Total GST</div>
          <div className="kpi-value">{fmt(data.total)}</div>
        </div>
      </div>

      <div className="data-table-wrap glass">
        <div className="data-table-header">
          <h3>Component Breakdown</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Component Name</th>
              <th className="text-right">Balance Amount</th>
              <th>Status</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((item) => (
              <tr key={item.id} onClick={() => setSelectedDetail(item)} style={{ cursor: 'pointer' }}>
                <td>
                  <div style={{ fontWeight: 600 }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.desc}</div>
                </td>
                <td className="text-right" style={{ fontSize: 16, fontWeight: 700 }}>{fmt(item.value)}</td>
                <td><span className="badge">Active</span></td>
                <td><ChevronRight size={16} color="var(--text-muted)" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selectedDetail && (
        <div className="modal-overlay" onClick={() => setSelectedDetail(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedDetail(null)}><X size={24} /></button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div style={{ padding: 12, background: 'rgba(99, 102, 241, 0.1)', borderRadius: 12, color: 'var(--accent)' }}>
                <Receipt size={32} />
              </div>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 700 }}>{selectedDetail.name}</h3>
                <p style={{ color: 'var(--text-muted)' }}>Ledger Detail Summary</p>
              </div>
            </div>
            
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: 24, borderRadius: 16, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <span style={{ color: 'var(--text-muted)' }}>Accounting Period</span>
                <span style={{ fontWeight: 600 }}>{fromDate} to {toDate}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <span style={{ color: 'var(--text-muted)' }}>Component Type</span>
                <span style={{ fontWeight: 600 }}>Indirect Tax</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 18, fontWeight: 600 }}>Closing Balance</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-light)' }}>{fmt(selectedDetail.value)}</span>
              </div>
            </div>

            <div style={{ marginTop: 32 }}>
              <h4 style={{ marginBottom: 16, fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Recent Implications</h4>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                This {selectedDetail.id.toUpperCase()} amount represents the accumulated tax {selectedDetail.value >= 0 ? 'receivable (ITC)' : 'payable'} 
                calculated from sales and purchase transactions recorded in Tally ERP 9 for the selected period.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

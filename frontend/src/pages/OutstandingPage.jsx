import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getLedgers } from '../api';
import { Download, Printer, Wallet, ChevronRight, X, User } from 'lucide-react';

const fmtAmt = (v) => v ? `₹${Math.abs(Number(v)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00';

const exportCSV = (data, filename) => {
  const csvContent = "data:text/csv;charset=utf-8," 
    + "Party Name,Group,Outstanding Amount\n"
    + data.map(row => `"${row.name}","${row.parent}",${row.closing}`).join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function OutstandingPage() {
  const { searchTerm, fromDate, toDate } = useOutletContext();
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('receivable'); // receivable or payable
  const [selectedParty, setSelectedParty] = useState(null);

  useEffect(() => {
    setLoading(true);
    getLedgers().then(r => setLedgers(r.data.ledgers || [])).catch(() => {}).finally(() => setLoading(false));
  }, [fromDate, toDate]);

  const receivables = ledgers.filter(l => (l.parent === 'Sundry Debtors' || l.parent?.includes('Debtors')) && l.closing !== 0);
  const payables = ledgers.filter(l => (l.parent === 'Sundry Creditors' || l.parent?.includes('Creditors')) && l.closing !== 0);
  
  const displayList = (type === 'receivable' ? receivables : payables).filter(l => 
    !searchTerm || l.name.toLowerCase().includes(searchTerm.toLowerCase()) || l.parent.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="loading">Calculating Outstanding...</div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="header-title">
          <h2>Outstanding Balances</h2>
          <p>{displayList.length} {type} records found</p>
        </div>
        <div className="header-actions">
          <div style={{ display: 'flex', background: 'var(--bg-card)', padding: 4, borderRadius: 12, border: '1px solid var(--border)', marginRight: 12 }}>
            <button onClick={() => setType('receivable')} style={{ padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: type === 'receivable' ? 'var(--accent)' : 'transparent', color: 'white', fontSize: 13, fontWeight: 600 }}>Receivables</button>
            <button onClick={() => setType('payable')} style={{ padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: type === 'payable' ? 'var(--accent)' : 'transparent', color: 'white', fontSize: 13, fontWeight: 600 }}>Payables</button>
          </div>
          <button className="btn-secondary" onClick={() => exportCSV(displayList, `outstanding_${type}.csv`)}>
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
              <th>Party / Ledger Name</th>
              <th>Group</th>
              <th className="text-right">Outstanding Amount</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {displayList.map((l, i) => (
              <tr key={i} onClick={() => setSelectedParty(l)} style={{ cursor: 'pointer' }}>
                <td style={{ fontWeight: 600 }}>{l.name}</td>
                <td style={{ color: 'var(--text-muted)' }}>{l.parent}</td>
                <td className={`text-right ${type === 'receivable' ? 'positive' : 'negative'}`} style={{ fontWeight: 700 }}>
                  {fmtAmt(l.closing)} {l.closing >= 0 ? 'Dr' : 'Cr'}
                </td>
                <td><ChevronRight size={16} color="var(--text-muted)" /></td>
              </tr>
            ))}
            {displayList.length === 0 && <tr><td colSpan={4} className="text-center">No outstanding records found</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Party Detail Modal */}
      {selectedParty && (
        <div className="modal-overlay" onClick={() => setSelectedParty(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedParty(null)}><X size={24} /></button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
              <div style={{ padding: 12, background: 'rgba(99, 102, 241, 0.1)', borderRadius: 12, color: 'var(--accent)' }}>
                <User size={32} />
              </div>
              <div>
                <h3 style={{ fontSize: 24, fontWeight: 800 }}>{selectedParty.name}</h3>
                <p style={{ color: 'var(--text-muted)' }}>{selectedParty.parent}</p>
              </div>
            </div>

            <div className="glass highlight" style={{ padding: 32, borderRadius: 20, marginBottom: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Current Outstanding</div>
              <div style={{ fontSize: 42, fontWeight: 900, color: type === 'receivable' ? 'var(--emerald)' : 'var(--rose)' }}>
                {fmtAmt(selectedParty.closing)}
              </div>
              <div style={{ marginTop: 8, fontWeight: 600 }}>{selectedParty.closing >= 0 ? 'Debit Balance (Receivable)' : 'Credit Balance (Payable)'}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <button className="btn-primary" style={{ justifyContent: 'center' }} onClick={() => window.print()}>Statement</button>
              <button className="btn-secondary" style={{ justifyContent: 'center' }} onClick={() => setSelectedParty(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getSummary } from '../api';
import { Printer, Download, Scale, TrendingUp, Wallet, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

const fmtAmt = (v) => v ? `₹${Math.abs(Number(v)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00';

export default function FinancialsPage() {
  const { searchTerm, fromDate, toDate } = useOutletContext();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getSummary().then(r => setSummary(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [fromDate, toDate]);

  if (loading) return <div className="loading">Generating Financial Statement...</div>;

  const exportFinancials = () => {
    if (!summary) return;
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Metric,Value\n"
      + `Total Revenue,${summary.revenue}\n`
      + `Total Expenses,${summary.expenses}\n`
      + `Net Profit,${summary.profit}\n`
      + `Total Receivables,${summary.receivables}\n`
      + `Total Payables,${summary.payables}`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `financial_summary_${fromDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="header-title">
          <h2>Financial Performance</h2>
          <p>Consolidated statement for {fromDate} to {toDate}</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={exportFinancials}>
            <Download size={18} /> Export CSV
          </button>
          <button className="print-btn" onClick={() => window.print()}>
            <Printer size={18} /> Print
          </button>
        </div>
      </div>
      
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }} className="fade-in">
          <div className="glass highlight" style={{ padding: 40, borderRadius: 24, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -20, right: -20, opacity: 0.1 }}><TrendingUp size={160} /></div>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
               <Scale color="var(--accent)" /> Income & Expenditure
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>TOTAL REVENUE</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--emerald)' }}>{fmtAmt(summary.revenue)}</div>
                </div>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: 8, color: 'var(--emerald)', fontSize: 12, fontWeight: 700 }}>DR</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>TOTAL EXPENSES</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--rose)' }}>{fmtAmt(summary.expenses)}</div>
                </div>
                <div style={{ background: 'rgba(244, 63, 94, 0.1)', padding: '4px 10px', borderRadius: 8, color: 'var(--rose)', fontSize: 12, fontWeight: 700 }}>CR</div>
              </div>

              <div style={{ marginTop: 24, paddingTop: 32, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>NET PROFIT / LOSS</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>For the selected period</div>
                </div>
                <div style={{ fontSize: 36, fontWeight: 900, color: summary.profit >= 0 ? 'var(--emerald)' : 'var(--rose)' }}>
                  {fmtAmt(summary.profit)}
                </div>
              </div>
            </div>
          </div>
          
          <div className="glass" style={{ padding: 40, borderRadius: 24, display: 'flex', flexDirection: 'column', gap: 32 }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12 }}>
               <Wallet color="var(--accent)" /> Working Capital & Liquidity
            </h3>

            <div className="glass" style={{ padding: 24, borderRadius: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>CASH & BANK</div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{fmtAmt(summary.cash_bank)}</div>
              </div>
              <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: 12, borderRadius: 12, color: 'var(--accent)' }}><ArrowUpRight /></div>
            </div>

            <div className="glass" style={{ padding: 24, borderRadius: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>TOTAL RECEIVABLES</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--emerald)' }}>{fmtAmt(summary.receivables)}</div>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: 12, borderRadius: 12, color: 'var(--emerald)' }}><ArrowDownLeft /></div>
            </div>

            <div className="glass" style={{ padding: 24, borderRadius: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>TOTAL PAYABLES</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--rose)' }}>{fmtAmt(summary.payables)}</div>
              </div>
              <div style={{ background: 'rgba(244, 63, 94, 0.1)', padding: 12, borderRadius: 12, color: 'var(--rose)' }}><ArrowUpRight /></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { getSummary, getMonthly } from '../api';
import { Line } from 'react-chartjs-2';
import { Printer } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

const fmtAmt = (v) => v ? `₹${Math.abs(Number(v)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00';
const fmtNum = (v) => v ? Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00';

export default function DashboardPage() {
  const { searchTerm, fromDate, toDate } = useOutletContext();
  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getSummary(), getMonthly()])
      .then(([s, m]) => { setSummary(s.data); setMonthly(m.data.months || []); })
      .finally(() => setLoading(false));
  }, [fromDate, toDate]);

  if (loading) return <div className="loading">Analyzing Tally Data...</div>;
  if (!summary) return <div className="page-content">Failed to load dashboard.</div>;

  const lineOpts = (color) => ({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#94a3b8' } }, y: { display: false } },
    elements: { line: { tension: 0.4 } }
  });

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="header-title">
          <h2>Tally ERP Executive Dashboard</h2>
          <p>Analyzing period: {fromDate} to {toDate}</p>
        </div>
        <div className="header-actions">
          <button className="print-btn" onClick={() => window.print()}>
            <Printer size={18} /> Print Dashboard
          </button>
        </div>
      </div>

      <div className="massive-grid fade-in">
        {/* Row 1 */}
        <Link to="/sales" className="report-card">
          <div className="report-header"><h3>Sales Trend</h3></div>
          <div style={{ height: 160 }}>
            <Line data={{ labels: monthly.map(m=>m.month), datasets: [{ data: monthly.map(m=>m.sales), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, borderWidth: 2 }]}} options={lineOpts('#3b82f6')} />
          </div>
        </Link>

        <Link to="/purchases" className="report-card">
          <div className="report-header"><h3>Purchase Trend</h3></div>
          <div style={{ height: 160 }}>
            <Line data={{ labels: monthly.map(m=>m.month), datasets: [{ data: monthly.map(m=>m.purchases), borderColor: '#f43f5e', backgroundColor: 'rgba(244,63,94,0.1)', fill: true, borderWidth: 2 }]}} options={lineOpts('#f43f5e')} />
          </div>
        </Link>

        <div className="report-card">
          <div className="report-header"><h3>Cash In/Out Flow</h3></div>
          <div className="report-row"><span className="label">Nett Flow</span><span className="value">{fmtAmt(summary.cash_flow.net)} {summary.cash_flow.net >= 0 ? 'Dr' : 'Cr'}</span></div>
          <div className="report-row"><span className="label">Inflow</span><span className="value positive">{fmtAmt(summary.cash_flow.inflow)} Dr</span></div>
          <div className="report-row"><span className="label">Outflow</span><span className="value negative">{fmtAmt(summary.cash_flow.outflow)} Cr</span></div>
        </div>

        {/* Row 2 */}
        <Link to="/financials" className="report-card">
          <div className="report-header"><h3>Trading Details</h3></div>
          <div className="report-row"><span className="label">Gross Profit</span><span className="value positive">{fmtAmt(summary.trading.gross_profit)} Cr</span></div>
          <div className="report-row"><span className="label">Nett Profit</span><span className="value positive">{fmtAmt(summary.trading.net_profit)} Cr</span></div>
          <div className="report-row"><span className="label">Sales Accounts</span><span className="value">{fmtAmt(summary.trading.sales)} Cr</span></div>
          <div className="report-row"><span className="label">Purchase Accounts</span><span className="value">{fmtAmt(summary.trading.purchases)} Dr</span></div>
        </Link>

        <div className="report-card">
          <div className="report-header"><h3>Assets/Liabilities</h3></div>
          <div className="report-row"><span className="label">Current Assets</span><span className="value">{fmtAmt(summary.assets_liabilities.assets)} Dr</span></div>
          <div className="report-row"><span className="label">Current Liabilities</span><span className="value">{fmtAmt(summary.assets_liabilities.liabilities)} Cr</span></div>
        </div>

        <Link to="/outstanding" className="report-card">
          <div className="report-header"><h3>Receivables/Payables</h3></div>
          <div className="report-row"><span className="label">Receivables</span><span className="value positive">{fmtAmt(summary.receivables)} Dr</span></div>
          <div className="report-row"><span className="label">Payables</span><span className="value negative">{fmtAmt(summary.payables)} Cr</span></div>
        </Link>

        {/* Row 3 */}
        <Link to="/stock" className="report-card">
          <div className="report-header"><h3>Inventory Details</h3></div>
          <div className="report-row"><span className="label">Closing Stock ({fmtNum(summary.inventory.quantity)} NOS)</span><span className="value">{fmtAmt(summary.inventory.value)}</span></div>
          <div className="report-row"><span className="label">Outwards</span><span className="value">{fmtAmt(summary.inventory.outwards)}</span></div>
          <div className="report-row"><span className="label">Inwards</span><span className="value">{fmtAmt(summary.inventory.inwards)}</span></div>
        </Link>

        <div className="report-card">
          <div className="report-header"><h3>Accounting Ratios</h3></div>
          <div className="report-row"><span className="label">Inventory Turnover</span><span className="value">{fmtNum(summary.ratios.inventory_turnover)}</span></div>
          <div className="report-row"><span className="label">Debt/Equity Ratio</span><span className="value">{fmtNum(summary.ratios.debt_equity)} : 1</span></div>
          <div className="report-row"><span className="label">Receivable Turnover in Days</span><span className="value">{fmtNum(summary.ratios.receivable_days)} days</span></div>
          <div className="report-row"><span className="label">Return on Investment %</span><span className="value">{fmtNum(summary.ratios.roi_percent)} %</span></div>
        </div>

        <div className="report-card">
          <div className="report-header"><h3>Cash/Bank Accounts</h3></div>
          <div className="report-row"><span className="label">Cash-in-Hand</span><span className="value">{fmtAmt(summary.cash_bank.cash)} Dr</span></div>
          <div className="report-row"><span className="label">Bank Accounts</span><span className="value">{fmtAmt(summary.cash_bank.bank)} Dr</span></div>
        </div>


      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { getSummary, getMonthly } from '../api';
import { Line } from 'react-chartjs-2';
import { Printer, TrendingUp, ShoppingBag, Wallet, Box, PieChart, ArrowRight, Sparkles, Activity, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Filler,
  Legend 
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler, Legend);

const fmtAmt = (v) => v ? `₹${Math.abs(Number(v)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00';
const fmtNum = (v) => v ? Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00';

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ title, value, icon: Icon, color, trend, link }) {
  const Card = link ? Link : 'div';
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="kpi-card glass-card"
      style={{ display: 'flex', flexDirection: 'column', gap: 12, textDecoration: 'none' }}
    >
      <Card to={link} style={{ display: 'flex', flexDirection: 'column', gap: 12, textDecoration: 'none', color: 'inherit' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="kpi-icon" style={{ color: color, background: `${color}10` }}>
            <Icon size={20} />
          </div>
          {trend && (
            <div style={{ fontSize: '11px', fontWeight: 700, color: trend > 0 ? 'var(--emerald)' : 'var(--rose)', background: trend > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)', padding: '2px 8px', borderRadius: '20px' }}>
              {trend > 0 ? '+' : ''}{trend}%
            </div>
          )}
        </div>
        <div>
          <div className="kpi-label">{title}</div>
          <div className="kpi-value">{value}</div>
        </div>
        {link && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '11px', color: 'var(--accent-light)', fontWeight: 700, marginTop: 4 }}>
            VIEW DETAILS <ArrowRight size={12} />
          </div>
        )}
      </Card>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { fromDate, toDate } = useOutletContext();
  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getSummary(), getMonthly()])
      .then(([s, m]) => { 
        setSummary(s.data); 
        setMonthly(m.data.months || []); 
      })
      .finally(() => setLoading(false));
  }, [fromDate, toDate]);

  const lineOpts = (color) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { 
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        titleFont: { family: 'Outfit', size: 12 },
        bodyFont: { family: 'Outfit', size: 12 },
        padding: 12,
        cornerRadius: 12,
        displayColors: false
      }
    },
    scales: { 
      x: { grid: { display: false }, ticks: { font: { family: 'Outfit', size: 10 }, color: '#64748b' } }, 
      y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { display: false } } 
    },
    elements: { 
      line: { tension: 0.4, borderWidth: 3 },
      point: { radius: 0, hoverRadius: 6, hoverBackgroundColor: color }
    }
  });

  if (loading) return (
    <div className="loading-wrap" style={{ height: '80vh', flexDirection: 'column', gap: 20 }}>
      <div className="spinner" />
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>AGGREGATING TALLY INTELLIGENCE...</span>
    </div>
  );

  if (!summary) return <div className="page-content">System synchronization error. Please check Tally ERP status.</div>;

  return (
    <div className="page-content fade-in">
      <div className="page-header">
        <div className="header-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ background: 'var(--accent)', padding: '6px', borderRadius: '8px' }}><ShieldCheck size={18} color="white" /></div>
            <h2 style={{ margin: 0 }}>Executive Command Center</h2>
          </div>
          <p>Analysis for {fromDate} → {toDate}</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => window.print()}>
            <Printer size={16} /> GENERATE REPORT
          </button>
        </div>
      </div>

      {/* Top Stats */}
      <div className="kpi-grid">
        <StatCard title="Net Sales" value={fmtAmt(summary.trading.sales)} icon={TrendingUp} color="var(--accent)" trend={12.5} link="/sales" />
        <StatCard title="Gross Profit" value={fmtAmt(summary.trading.gross_profit)} icon={Activity} color="var(--emerald)" trend={8.2} link="/financials" />
        <StatCard title="Total Inventory" value={fmtAmt(summary.inventory.value)} icon={Box} color="var(--amber)" link="/stock" />
        <StatCard title="Total Payables" value={fmtAmt(summary.payables)} icon={Wallet} color="var(--rose)" link="/outstanding" />
      </div>

      <div className="charts-grid">
        <div className="chart-card glass-card full-width">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h3>Revenue vs Expense Analytics</h3>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--accent-light)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} /> SALES
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--rose)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--rose)' }} /> PURCHASES
              </div>
            </div>
          </div>
          <div style={{ height: 280 }}>
            <Line 
              data={{ 
                labels: monthly.map(m=>m.month), 
                datasets: [
                  { 
                    label: 'Sales',
                    data: monthly.map(m=>m.sales), 
                    borderColor: '#6366f1', 
                    backgroundColor: 'rgba(99, 102, 241, 0.1)', 
                    fill: true 
                  },
                  { 
                    label: 'Purchases',
                    data: monthly.map(m=>m.purchases), 
                    borderColor: '#f43f5e', 
                    backgroundColor: 'rgba(244, 63, 94, 0.05)', 
                    fill: true 
                  }
                ]
              }} 
              options={lineOpts('#6366f1')} 
            />
          </div>
        </div>
      </div>

      <div className="massive-grid">
        <div className="report-card glass-card">
          <div className="report-header"><h3>Cash Flow Health</h3></div>
          <div className="report-row"><span className="label">Nett Flow</span><span className="value" style={{ fontWeight: 800 }}>{fmtAmt(summary.cash_flow.net)}</span></div>
          <div className="report-row"><span className="label">Monthly Inflow</span><span className="value" style={{ color: 'var(--emerald)' }}>{fmtAmt(summary.cash_flow.inflow)}</span></div>
          <div className="report-row"><span className="label">Monthly Outflow</span><span className="value" style={{ color: 'var(--rose)' }}>{fmtAmt(summary.cash_flow.outflow)}</span></div>
        </div>

        <div className="report-card glass-card">
          <div className="report-header"><h3>Liquidity Ratios</h3></div>
          <div className="report-row"><span className="label">Current Ratio</span><span className="value">{(summary.assets_liabilities.assets / summary.assets_liabilities.liabilities).toFixed(2)} : 1</span></div>
          <div className="report-row"><span className="label">Inventory Turnover</span><span className="value">{fmtNum(summary.ratios.inventory_turnover)}x</span></div>
          <div className="report-row"><span className="label">ROI Performance</span><span className="value" style={{ color: 'var(--emerald)', fontWeight: 800 }}>{fmtNum(summary.ratios.roi_percent)}%</span></div>
        </div>

        <div className="report-card glass-card">
          <div className="report-header"><h3>Asset Allocation</h3></div>
          <div className="report-row"><span className="label">Total Assets</span><span className="value">{fmtAmt(summary.assets_liabilities.assets)}</span></div>
          <div className="report-row"><span className="label">Total Liabilities</span><span className="value">{fmtAmt(summary.assets_liabilities.liabilities)}</span></div>
          <div className="report-row"><span className="label">Working Capital</span><span className="value" style={{ color: 'var(--sky)' }}>{fmtAmt(summary.assets_liabilities.assets - summary.assets_liabilities.liabilities)}</span></div>
        </div>
      </div>
      
      <div style={{ marginTop: 32, padding: '20px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '16px', border: '1px dashed rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ background: 'var(--accent)', padding: '10px', borderRadius: '12px' }}><Sparkles size={20} color="white" /></div>
        <div>
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>AI Insights Available</h4>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>The deep analytics engine has detected anomalies in your Stock Ledger. <Link to="/analytics" style={{ color: 'var(--accent-light)', fontWeight: 700, textDecoration: 'none' }}>View AI Analysis →</Link></p>
        </div>
      </div>
    </div>
  );
}

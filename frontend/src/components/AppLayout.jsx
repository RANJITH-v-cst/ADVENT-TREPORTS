import { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { getCompanies } from '../api';
import { LayoutDashboard, TrendingUp, ShoppingCart, Package, Wallet, BookOpen, Scale, LogOut, BarChart3, Receipt, FileText, Calendar, PieChart } from 'lucide-react';

export default function AppLayout() {
  const { user, logout } = useAuth();
  
  const [companyName, setCompanyName] = useState('Loading...');
  
  useEffect(() => {
    getCompanies().then(res => {
      const cos = res.data?.companies || [];
      if (cos.length > 0) {
        setCompanyName(cos[0].name);
        
        // Default to Current Financial Year from Tally (format: YYYYMMDD)
        const rawDate = cos[0].from;
        if (rawDate && rawDate.length === 8) {
          const y = rawDate.slice(0, 4);
          const m = rawDate.slice(4, 6);
          const d = rawDate.slice(6, 8);
          const startDate = `${y}-${m}-${d}`;
          setFromDate(startDate);
          
          // Calculate end of FY
          const endDate = new Date(parseInt(y) + 1, parseInt(m) - 1, parseInt(d));
          endDate.setDate(endDate.getDate() - 1);
          setToDate(endDate.toISOString().split('T')[0]);
        }
      }
    }).catch(() => setCompanyName('Tally ERP'));
  }, []);

  // Global Filter States

  const [fromDate, setFromDate] = useState('2023-04-01');
  const [toDate, setToDate] = useState('2024-03-31');

  const initials = (user?.email || 'U').slice(0, 2).toUpperCase();

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon"><BarChart3 size={20} /></div>
          <div>
            <h1>ADVENT TREPORTS</h1>
            <span style={{ color: 'var(--accent-light)', fontWeight: 700, fontSize: '12px' }}>{companyName}</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-label">Core Modules</div>
          <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}><LayoutDashboard size={18} /> Dashboard</NavLink>
          <NavLink to="/sales" className={({ isActive }) => isActive ? 'active' : ''}><TrendingUp size={18} /> Sales</NavLink>
          <NavLink to="/purchases" className={({ isActive }) => isActive ? 'active' : ''}><ShoppingCart size={18} /> Purchases</NavLink>
          <NavLink to="/stock" className={({ isActive }) => isActive ? 'active' : ''}><Package size={18} /> Stock</NavLink>
          <NavLink to="/outstanding" className={({ isActive }) => isActive ? 'active' : ''}><Wallet size={18} /> Outstanding</NavLink>
          <NavLink to="/ledgers" className={({ isActive }) => isActive ? 'active' : ''}><BookOpen size={18} /> Ledgers</NavLink>
          <NavLink to="/financials" className={({ isActive }) => isActive ? 'active' : ''}><Scale size={18} /> Financials</NavLink>
          <NavLink to="/analytics" className={({ isActive }) => isActive ? 'active' : ''}><PieChart size={18} /> Analytics</NavLink>
        </nav>
        <div className="sidebar-footer">
          <div className="user-avatar">{initials}</div>
          <div className="user-info" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <p title={user?.email} style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', margin: 0 }}>{user?.email}</p>
            <div 
              onClick={logout} 
              style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
              title="Click to Logout"
            >
              <LogOut size={14} /> Logout
            </div>
          </div>
        </div>
      </aside>
      
      <main className="main-area">
        <header className="header">
          <div style={{ flex: 1 }}></div>
          <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div className="date-filters">
              <Calendar size={16} />
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              <span>to</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
        </header>
        <div className="page-content-wrap" style={{ flex: 1, overflow: 'auto' }}>
          <Outlet context={{ fromDate, toDate }} />
        </div>
      </main>
    </div>
  );
}

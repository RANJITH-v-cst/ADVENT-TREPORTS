import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import DaybookPage from './pages/DaybookPage';
import StockPage from './pages/StockPage';
import OutstandingPage from './pages/OutstandingPage';
import LedgersPage from './pages/LedgersPage';
import FinancialsPage from './pages/FinancialsPage';
import AdminPage from './pages/AdminPage';
import GSTReportPage from './pages/GSTReportPage';
import TDSReportPage from './pages/TDSReportPage';
import AppLayout from './components/AppLayout';

function ProtectedRoute({ children, adminOnly }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-wrap"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-wrap"><div className="spinner" /></div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="sales" element={<DaybookPage filterType="Sales" title="Sales" />} />
        <Route path="purchases" element={<DaybookPage filterType="Purchase" title="Purchases" />} />
        <Route path="stock" element={<StockPage />} />
        <Route path="outstanding" element={<OutstandingPage />} />
        <Route path="ledgers" element={<LedgersPage />} />
        <Route path="financials" element={<FinancialsPage />} />
        <Route path="gst" element={<GSTReportPage />} />
        <Route path="tds" element={<TDSReportPage />} />
        <Route path="admin" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

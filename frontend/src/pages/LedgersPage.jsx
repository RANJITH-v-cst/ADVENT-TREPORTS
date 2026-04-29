import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getLedgers } from '../api';
import { Download, Printer, BookOpen, ChevronRight, X, Search, Filter, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const fmtAmt = (v) => v ? `₹${Math.abs(Number(v)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00';

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

  if (loading) return (
    <div className="loading-wrap" style={{ height: '70vh', flexDirection: 'column', gap: 20 }}>
      <div className="spinner" />
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>SCANNING ACCOUNT BALANCES...</span>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="page-content">
      <div className="page-header">
        <div className="header-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <BookOpen size={24} color="var(--purple)" />
            <h2 style={{ margin: 0 }}>Chart of Accounts</h2>
          </div>
          <p>{filtered.length} ledgers synchronized from Tally master database</p>
        </div>
        <div className="header-actions">
           <button className="btn-secondary" style={{ borderRadius: '12px' }}>
            <Download size={16} /> DOWNLOAD CSV
          </button>
          <button className="btn-run-premium" style={{ padding: '10px 20px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => window.print()}>
            <Printer size={16} /> PRINT LEDGERS
          </button>
        </div>
      </div>

      <div className="data-table-wrap glass-card">
        <div className="data-table-header">
           <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
             <Search size={16} color="var(--text-muted)" />
             <h3 style={{ margin: 0, fontSize: 14 }}>Global Ledger Registry</h3>
           </div>
           <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>{filtered.length} ENTITIES</div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ paddingLeft: 24 }}>Entity Name</th>
              <th>Primary Grouping</th>
              <th className="text-right">Opening Flux</th>
              <th className="text-right" style={{ paddingRight: 24 }}>Closing Net</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l, i) => (
              <motion.tr 
                key={i} 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                transition={{ delay: i * 0.005 }}
                onClick={() => setSelectedLedger(l)} 
                style={{ cursor: 'pointer' }}
              >
                <td style={{ paddingLeft: 24, color: 'white', fontWeight: 600 }}>{l.name}</td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{l.parent}</td>
                <td className="text-right" style={{ fontSize: 12, fontFamily: 'monospace' }}>
                   {fmtAmt(l.opening)} <span style={{ opacity: 0.5, fontSize: 10 }}>{l.opening > 0 ? 'Dr' : l.opening < 0 ? 'Cr' : ''}</span>
                </td>
                <td className="text-right" style={{ paddingRight: 24, fontWeight: 800, color: 'white', fontFamily: 'monospace' }}>
                   {fmtAmt(l.closing)} <span style={{ color: l.closing > 0 ? 'var(--sky)' : 'var(--rose)', fontSize: 10 }}>{l.closing > 0 ? 'Dr' : l.closing < 0 ? 'Cr' : ''}</span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {selectedLedger && (
          <div className="modal-overlay" onClick={() => setSelectedLedger(null)} style={{ zIndex: 1000 }}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="modal-content glass-card" 
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: 500, padding: 32, background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(30px)' }}
            >
              <button className="modal-close" onClick={() => setSelectedLedger(null)} style={{ top: 24, right: 24 }}><X size={20} /></button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32 }}>
                <div style={{ width: 56, height: 56, background: 'rgba(168, 85, 247, 0.1)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--purple)' }}>
                  <Activity size={28} />
                </div>
                <div>
                  <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'white' }}>{selectedLedger.name}</h3>
                  <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 13, fontWeight: 600 }}>{selectedLedger.parent}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 800, marginBottom: 6 }}>OPENING BALANCE</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>{fmtAmt(selectedLedger.opening)} <span style={{ fontSize: 10, opacity: 0.5 }}>{selectedLedger.opening > 0 ? 'Dr' : 'Cr'}</span></div>
                </div>
                <div style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 800, marginBottom: 6 }}>CURRENT STATUS</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--emerald)' }}>ACTIVE</div>
                </div>
              </div>

              <div style={{ padding: 24, borderRadius: 20, background: 'rgba(168, 85, 247, 0.05)', border: '1px solid rgba(168, 85, 247, 0.1)', textAlign: 'center', marginBottom: 32 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8 }}>NET LIQUIDITY POSITION</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--purple)' }}>{fmtAmt(selectedLedger.closing)} <span style={{ fontSize: 14 }}>{selectedLedger.closing > 0 ? 'Dr' : 'Cr'}</span></div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn-run-premium" style={{ flex: 1, padding: 14, borderRadius: 12 }} onClick={() => window.print()}>
                  EXTRACT LEDGER
                </button>
                <button className="btn-secondary" style={{ flex: 1, padding: 14, borderRadius: 12 }} onClick={() => setSelectedLedger(null)}>
                  CLOSE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

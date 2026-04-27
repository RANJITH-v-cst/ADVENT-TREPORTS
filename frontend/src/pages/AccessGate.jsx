import { useState, useEffect } from 'react';
import axios from 'axios';
import { Mail, ShieldCheck, Clock, CheckCircle2, ArrowRight } from 'lucide-react';

const API_BASE = "http://localhost:8000/api/license";

export default function AccessGate({ onApproved }) {
  const [email, setEmail] = useState(localStorage.getItem('pending_email') || '');
  const [status, setStatus] = useState('initial');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (email) {
      checkStatus();
      const timer = setInterval(checkStatus, 10000); // Auto-check every 10s
      return () => clearInterval(timer);
    }
  }, []);

  const checkStatus = async () => {
    const currentEmail = email || localStorage.getItem('pending_email');
    if (!currentEmail) return;

    try {
      const res = await axios.get(`${API_BASE}/status/${currentEmail}`);
      if (res.data.status === 'approved') {
        localStorage.setItem('advent_license_approved', 'true');
        onApproved();
      } else if (res.data.status === 'pending') {
        setStatus('pending');
      }
    } catch (e) { console.error("Status check failed", e); }
  };

  const handleRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg('');
    try {
      await axios.post(`${API_BASE}/request`, { email });
      localStorage.setItem('pending_email', email);
      setStatus('pending');
      setMsg("Request sent! Please wait for admin approval.");
    } catch (err) {
      setMsg(err.response?.data?.detail || "Failed to send request");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyCenter: 'center', background: '#0f172a', color: 'white', fontFamily: 'Inter, sans-serif' }}>
      <div className="glass" style={{ width: '100%', maxWidth: 450, padding: 40, borderRadius: 32, textAlign: 'center', margin: '0 auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
        
        <div style={{ width: 80, height: 80, background: 'linear-gradient(135deg, #6366f1, #a855f7)', borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px', boxShadow: '0 10px 20px rgba(99, 102, 241, 0.3)' }}>
          {status === 'pending' ? <Clock size={40} /> : <ShieldCheck size={40} />}
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>ADVENT TREPORTS</h1>
        <p style={{ color: '#94a3b8', fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
          {status === 'pending' 
            ? "Your access request is currently pending admin approval. We will notify you once granted."
            : "Welcome! To ensure security, please request access to unlock the full dashboard features."}
        </p>

        {status === 'initial' ? (
          <form onSubmit={handleRequest} style={{ textAlign: 'left' }}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8 }}>Professional Email</label>
              <div style={{ position: 'relative' }}>
                <Mail style={{ position: 'absolute', left: 16, top: 14, color: '#475569' }} size={20} />
                <input 
                  type="email" required placeholder="name@company.com"
                  style={{ width: '100%', padding: '14px 16px 14px 48px', borderRadius: 16, background: '#1e293b', border: '1px solid #334155', color: 'white', fontSize: 15 }}
                  value={email} onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>
            <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: 16, borderRadius: 16, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading ? "Sending..." : "Request Access"} <ArrowRight size={20} />
            </button>
          </form>
        ) : (
          <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: 24, borderRadius: 20, border: '1px solid rgba(99, 102, 241, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#818cf8', marginBottom: 16, justifyContent: 'center' }}>
              <Clock size={20} /> <span style={{ fontWeight: 600 }}>Waiting for Admin...</span>
            </div>
            <button className="btn-secondary" onClick={checkStatus} style={{ width: '100%', padding: 12, borderRadius: 12 }}>
              Check Status Now
            </button>
          </div>
        )}

        {msg && <div style={{ marginTop: 24, padding: 16, borderRadius: 12, background: 'rgba(244, 63, 94, 0.1)', color: '#fb7185', fontSize: 14 }}>{msg}</div>}
        
        <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid #1e293b', fontSize: 12, color: '#475569' }}>
          Contact support if you need immediate assistance.<br/>
          <strong>ranjithsvhpc1234@gmail.com</strong>
        </div>
      </div>
    </div>
  );
}

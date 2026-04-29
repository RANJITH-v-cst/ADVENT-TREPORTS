import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { BarChart3, Sparkles, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="login-card"
        style={{ background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(30px)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
      >
        <div className="brand">
          <div className="icon" style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', boxShadow: '0 0 20px rgba(99, 102, 241, 0.5)' }}>
            <Sparkles size={28} color="white" />
          </div>
          <h1 style={{ background: 'linear-gradient(90deg, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ADVENT TREPORTS</h1>
          <p style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 500, letterSpacing: '0.05em' }}>PREMIUM TALLY INTELLIGENCE</p>
        </div>
        
        {error && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="error-msg"
            style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', border: '1px solid rgba(244, 63, 94, 0.2)', padding: '12px', borderRadius: '12px', fontSize: '13px', marginBottom: '20px', textAlign: 'center' }}
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Authorized Email</label>
            <input 
              id="login-email" 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="name@company.com" 
              style={{ width: '100%', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '12px 16px', color: 'white', fontSize: '14px', outline: 'none' }}
              autoFocus 
              required 
            />
          </div>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Security Token</label>
            <input 
              id="login-password" 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="••••••••" 
              style={{ width: '100%', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '12px 16px', color: 'white', fontSize: '14px', outline: 'none' }}
              required 
            />
          </div>

          <button 
            id="login-submit" 
            className="btn-primary" 
            type="submit" 
            disabled={loading}
            style={{ 
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)', 
              color: 'white', 
              border: 'none', 
              borderRadius: '12px', 
              padding: '14px', 
              fontSize: '15px', 
              fontWeight: 700, 
              cursor: 'pointer', 
              boxShadow: '0 10px 25px rgba(99, 102, 241, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
          >
            {loading ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} style={{ width: '18px', height: '18px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%' }} />
                Authenticating...
              </>
            ) : (
              <>
                <ShieldCheck size={18} />
                Secure Access
              </>
            )}
          </button>
        </form>
        
        <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
          Enterprise Grade Security • SSL Encrypted
        </div>
      </motion.div>
    </div>
  );
}

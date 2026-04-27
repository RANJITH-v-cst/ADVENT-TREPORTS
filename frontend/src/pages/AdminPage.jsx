import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getUsers, createUser, deleteUser } from '../api';
import { Trash2, UserPlus, Users, ShieldCheck, AlertCircle } from 'lucide-react';

export default function AdminPage() {
  const { searchTerm } = useOutletContext();
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('user');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => getUsers().then(r => setUsers(r.data)).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await createUser({ username, password, role, full_name: fullName });
      setUsername(''); setPassword(''); setFullName(''); setRole('user');
      load();
    } catch (err) { setError(err.response?.data?.detail || 'Failed to create user'); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete user "${name}"?`)) return;
    try { await deleteUser(id); load(); } catch (err) { setError(err.response?.data?.detail || 'Failed'); }
  };

  const filteredUsers = users.filter(u => 
    !searchTerm || 
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.full_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="loading">Initializing Admin Controls...</div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="header-title">
          <h2>Security & Admin Panel</h2>
          <p>Manage user accounts and system permissions</p>
        </div>
      </div>

      {error && <div className="error-banner" style={{ marginBottom: 24 }}><AlertCircle size={20}/> {error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 32 }} className="fade-in">
        
        {/* Creation Form */}
        <div className="glass" style={{ padding: 32, borderRadius: 24 }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
            <UserPlus color="var(--accent)" /> Create Account
          </h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>FULL NAME</label>
              <input 
                style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'white' }}
                placeholder="John Doe" value={fullName} onChange={e => setFullName(e.target.value)} 
              />
            </div>
            <div className="form-group">
              <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>USERNAME</label>
              <input 
                style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'white' }}
                placeholder="johndoe" value={username} onChange={e => setUsername(e.target.value)} required 
              />
            </div>
            <div className="form-group">
              <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>PASSWORD</label>
              <input 
                type="password"
                style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'white' }}
                placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required 
              />
            </div>
            <div className="form-group">
              <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>ACCESS LEVEL</label>
              <select 
                style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'white' }}
                value={role} onChange={e => setRole(e.target.value)}
              >
                <option value="user">Standard User</option>
                <option value="admin">System Administrator</option>
              </select>
            </div>
            <button className="btn-primary" type="submit" style={{ marginTop: 12, width: '100%' }}>
              Create Account
            </button>
          </form>
        </div>

        {/* User List */}
        <div className="glass" style={{ padding: 32, borderRadius: 24 }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Users color="var(--accent)" /> Registered Users ({users.length})
          </h3>
          <div className="data-table-wrap" style={{ background: 'transparent', border: 'none', padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Display Name</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th style={{ width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.full_name || '—'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{u.username}</td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'badge-sale' : 'badge-payment'}`} style={{ display: 'flex', alignItems: 'center', gap: 4, width: 'fit-content' }}>
                        {u.role === 'admin' && <ShieldCheck size={12} />} {u.role}
                      </span>
                    </td>
                    <td>
                      <button 
                        onClick={() => handleDelete(u.id, u.username)}
                        style={{ background: 'rgba(244, 63, 94, 0.1)', color: 'var(--rose)', border: 'none', padding: 8, borderRadius: 8, cursor: 'pointer' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

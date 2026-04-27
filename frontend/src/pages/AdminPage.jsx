import { useState, useEffect } from 'react';
import { getUsers, createUser, deleteUser } from '../api';
import { Trash2 } from 'lucide-react';

export default function AdminPage() {
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

  if (loading) return <div className="page-content"><div className="loading-wrap"><div className="spinner" /></div></div>;

  return (
    <div className="page-content">
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Admin Panel</h2>
      {error && <div className="error-banner">{error}</div>}
      <div className="admin-grid fade-in">
        <div className="admin-card">
          <h3>Create New User</h3>
          <form onSubmit={handleCreate}>
            <div className="form-row"><input placeholder="Full Name" value={fullName} onChange={e => setFullName(e.target.value)} /></div>
            <div className="form-row"><input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required /></div>
            <div className="form-row"><input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
            <div className="form-row">
              <select value={role} onChange={e => setRole(e.target.value)}><option value="user">User</option><option value="admin">Admin</option></select>
              <button className="btn-sm btn-add" type="submit">Create User</button>
            </div>
          </form>
        </div>
        <div className="admin-card">
          <h3>All Users ({users.length})</h3>
          <table className="data-table" style={{ marginTop: 8 }}>
            <thead><tr><th>Name</th><th>Username</th><th>Role</th><th></th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.full_name || '—'}</td>
                  <td>{u.username}</td>
                  <td><span className={`badge ${u.role === 'admin' ? 'badge-sale' : 'badge-payment'}`}>{u.role}</span></td>
                  <td><button className="btn-sm btn-delete" onClick={() => handleDelete(u.id, u.username)}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

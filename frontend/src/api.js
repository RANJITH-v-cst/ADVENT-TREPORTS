import axios from 'axios';

const API = axios.create({ baseURL: 'http://localhost:8000' });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const company = localStorage.getItem('tally_company');
  if (company) config.headers['X-Company-Name'] = company;
  return config;
});

API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const login = (username, password) => API.post('/api/auth/login', { username, password });
export const getMe = () => API.get('/api/auth/me');
export const logout = () => API.post('/api/auth/logout');

export const getCompanies = () => API.get('/api/dashboard/companies');
export const getSummary = () => API.get('/api/dashboard/summary');
export const getMonthly = () => API.get('/api/dashboard/monthly');
export const getLedgers = () => API.get('/api/dashboard/ledgers');
export const getStock = () => API.get('/api/dashboard/stock');
export const getDaybook = (from, to) => API.get('/api/dashboard/daybook', { params: { from_date: from, to_date: to } });
export const getGroups = () => API.get('/api/dashboard/groups');
export const getGSTReport = () => API.get('/api/dashboard/gst-report');
export const getTDSReport = () => API.get('/api/dashboard/tds-report');
export const getAnalyticsConfig = () => API.get('/api/analytics/config');
export const runAnalytics = (payload) => API.post('/api/analytics', payload);

export const getUsers = () => API.get('/api/admin/users');
export const createUser = (data) => API.post('/api/admin/users', data);
export const deleteUser = (id) => API.delete(`/api/admin/users/${id}`);

export default API;

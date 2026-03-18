const BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
  ? import.meta.env.VITE_API_URL
  : 'http://localhost:8000';

const getToken = () => localStorage.getItem('mj_token');

const get = async (url) => {
  const token = getToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(BASE + url, { headers });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
};

const post = async (url, body) => {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
};

const put = async (url, body) => {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `${res.status}`);
  }
  return res.json();
};

export const api = {
  health: () => get('/health'),
  price: (ticker) => get(`/price/${ticker}`),
  indicators: (ticker) => get(`/indicators/${ticker}`),
  fundamentals: (ticker) => get(`/fundamentals/${ticker}`),
  rMultiple: (ticker, entry, stop) => get(`/r/${ticker}?entry=${entry}&stop=${stop}`),
  batchR: (trades) => post('/batch_r', trades),

  // Auth
  register: (username, password, portfolioSize) =>
    post('/auth/register', { username, password, portfolioSize }),
  login: (username, password) =>
    post('/auth/login', { username, password }),
  me: () => get('/auth/me'),
  logout: () => post('/auth/logout', {}),
  updatePortfolio: (portfolioSize) => put('/auth/portfolio', { portfolioSize }),
};

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setCurrentUser, saveUser, loadUser } from '../utils/storage';
import { api } from '../services/api';

const BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
  ? import.meta.env.VITE_API_URL
  : 'http://localhost:8000';

async function isBackendOnline() {
  try {
    const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export default function Login({ setUser }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [portfolioSize, setPortfolioSize] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    const user = username.trim().toLowerCase();
    if (!user || user.length < 3) {
      setError('اسم المستخدم يجب أن يكون 3 أحرف على الأقل');
      return;
    }
    if (!password || password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    const size = parseFloat((portfolioSize || '').replace(/,/g, ''));
    if (!portfolioSize || isNaN(size) || size <= 0) {
      setError('أدخل حجم المحفظة بالدولار');
      return;
    }

    setLoading(true);
    try {
      const online = await isBackendOnline();
      if (online) {
        // Register via backend
        const result = await api.register(user, password, size);
        localStorage.setItem('mj_token', result.token);
        const userData = { username: user, portfolioSize: size, token: result.token };
        saveUser(user, userData);
        setCurrentUser(user);
        setUser(userData);
        navigate('/dashboard', { replace: true });
      } else {
        // Offline fallback: store locally with hashed password
        const existing = loadUser(user);
        if (existing && existing.password) {
          setError('اسم المستخدم موجود بالفعل');
          return;
        }
        const userData = { username: user, password: btoa(password), portfolioSize: size };
        saveUser(user, userData);
        setCurrentUser(user);
        setUser(userData);
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'خطأ في التسجيل');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const user = username.trim().toLowerCase();
    if (!user) { setError('أدخل اسم المستخدم'); return; }
    if (!password) { setError('أدخل كلمة المرور'); return; }

    setLoading(true);
    try {
      const online = await isBackendOnline();
      if (online) {
        // Login via backend
        const result = await api.login(user, password);
        localStorage.setItem('mj_token', result.token);
        // Load existing local data or create new user
        const existing = loadUser(user) || {};
        const userData = {
          ...existing,
          username: user,
          portfolioSize: existing.portfolioSize || result.portfolioSize || 0,
          token: result.token,
        };
        saveUser(user, userData);
        setCurrentUser(user);
        setUser(userData);
        navigate('/dashboard', { replace: true });
      } else {
        // Offline fallback: check local storage
        const userData = loadUser(user);
        if (!userData) {
          setError('اسم المستخدم غير موجود — الخادم غير متصل، لا يمكن التحقق');
          return;
        }
        // Check old PIN or new password
        const valid = userData.pin === btoa(password) || userData.password === btoa(password);
        if (!valid) {
          setError('كلمة المرور غير صحيحة');
          return;
        }
        setCurrentUser(user);
        setUser(userData);
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'خطأ في تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6">
      <h1 className="font-display text-gold text-4xl mb-2">Minervini Journal</h1>
      <p className="text-muted text-sm mb-8 font-mono">TRADING JOURNAL</p>

      <div className="w-full max-w-sm">
        <div className="flex gap-2 mb-6 border-b border-border pb-2">
          <button
            type="button"
            onClick={() => { setTab('login'); setError(''); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'login' ? 'bg-s2 text-gold border border-gold/50' : 'text-muted hover:text-fg'
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setError(''); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'register' ? 'bg-s2 text-gold border border-gold/50' : 'text-muted hover:text-fg'
            }`}
          >
            حساب جديد
          </button>
        </div>

        {error && (
          <p className="text-red text-sm mb-4 text-center bg-red/10 border border-red/30 rounded-lg px-3 py-2">{error}</p>
        )}

        {tab === 'register' ? (
          <form onSubmit={handleRegister} className="space-y-4">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="اسم المستخدم (3 أحرف على الأقل)"
              className="w-full bg-s2 border border-border rounded-lg px-4 py-3 text-fg placeholder-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold"
              dir="rtl"
              autoComplete="username"
              disabled={loading}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="كلمة المرور (6 أحرف على الأقل)"
              className="w-full bg-s2 border border-border rounded-lg px-4 py-3 text-fg placeholder-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold"
              dir="rtl"
              autoComplete="new-password"
              disabled={loading}
            />
            <input
              type="text"
              value={portfolioSize}
              onChange={(e) => setPortfolioSize(e.target.value)}
              placeholder="حجم المحفظة (USD)"
              className="w-full bg-s2 border border-border rounded-lg px-4 py-3 text-fg placeholder-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold"
              dir="ltr"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gold text-black font-bold py-3 rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-60"
            >
              {loading ? 'جارٍ التسجيل...' : 'إنشاء الحساب'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="اسم المستخدم"
              className="w-full bg-s2 border border-border rounded-lg px-4 py-3 text-fg placeholder-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold"
              dir="rtl"
              autoComplete="username"
              disabled={loading}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="كلمة المرور"
              className="w-full bg-s2 border border-border rounded-lg px-4 py-3 text-fg placeholder-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold"
              dir="rtl"
              autoComplete="current-password"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gold text-black font-bold py-3 rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-60"
            >
              {loading ? 'جارٍ التحقق...' : 'دخول'}
            </button>
          </form>
        )}

        <p className="text-muted text-xs text-center mt-6">
          بياناتك محفوظة على جهازك بشكل آمن
        </p>
      </div>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { getCurrentUser, loadUser, loadData, saveData, saveUser, loadWatchlist } from '../../utils/storage';
import { defaultSettings } from '../../utils/portfolioUtils';
import { calcPortfolioRisk } from '../../utils/stockCalcs';

const navSections = [
  {
    label: 'رئيسي',
    items: [
      { to: '/dashboard', label: 'لوحة التحكم', icon: '📊' },
      { to: '/watchlist', label: 'قائمة المراقبة', icon: '📋' },
    ],
  },
  {
    label: 'الأدوات',
    items: [
      { to: '/strategies', label: 'الاستراتيجيات', icon: '⬡' },
      { to: '/stats', label: 'الإحصائيات', icon: '◎' },
      { to: '/sepa', label: 'SEPA', icon: '✦' },
    ],
  },
];

export default function Sidebar({ user, setUser, logout }) {
  const navigate = useNavigate();
  const username = getCurrentUser();
  const userFromStorage = username ? loadUser(username) : null;
  const displayUser = userFromStorage || user;
  const settings = username ? (loadData(username, 'settings', defaultSettings()) || defaultSettings()) : defaultSettings();
  const portfolioSize = settings.portfolioSize ?? displayUser?.portfolioSize ?? 0;
  const [editingPortfolio, setEditingPortfolio] = useState(false);
  const [portfolioInput, setPortfolioInput] = useState(String(portfolioSize || ''));

  const watchlist = useMemo(() => (username ? loadWatchlist(username) : []), [username]);
  const openStocks = useMemo(() => watchlist.filter((s) => s.status === 'open'), [watchlist]);
  const portfolioRisk = useMemo(
    () => (portfolioSize > 0 ? calcPortfolioRisk(openStocks, portfolioSize) : null),
    [openStocks, portfolioSize]
  );
  const maxTotalRiskPct = settings?.maxTotalRiskPct ?? 6;
  const totalRiskPct = portfolioRisk?.totalRiskPct ?? 0;
  const riskBarPct = totalRiskPct > 0 ? Math.min(100, Math.max(3, (totalRiskPct / Math.max(0.5, maxTotalRiskPct)) * 100)) : 0;
  const riskBarColorClass = totalRiskPct <= (maxTotalRiskPct * 0.5) ? 'bg-teal' : totalRiskPct <= maxTotalRiskPct ? 'bg-amber-500' : 'bg-red';
  const riskLabel = totalRiskPct <= (maxTotalRiskPct * 0.5) ? 'منخفضة ✓' : totalRiskPct <= maxTotalRiskPct ? 'معتدلة' : 'مرتفعة';

  const formatCurrency = (n) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const savePortfolioSize = (value) => {
    const num = parseFloat(String(value).replace(/,/g, ''));
    if (username && !isNaN(num) && num > 0) {
      const next = { ...defaultSettings(), ...settings, portfolioSize: num, updatedAt: new Date().toISOString() };
      saveData(username, 'settings', next);
      if (setUser) setUser({ ...(displayUser || user), portfolioSize: num });
      saveUser(username, { ...(displayUser || user), portfolioSize: num });
    }
    setEditingPortfolio(false);
    setPortfolioInput(String(portfolioSize || ''));
  };

  const handlePortfolioBlur = () => {
    savePortfolioSize(portfolioInput);
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed right-0 top-0 h-screen w-[220px] bg-s1 border-l border-border flex-col z-10">
        <div className="p-5 border-b border-border">
          <div className="font-display text-gold text-xl">
            {displayUser ? displayUser.username : 'Meshal Journal'}
          </div>
          <div className="text-muted font-mono text-xs tracking-widest mt-1">
            TRADING JOURNAL
          </div>
        </div>
        <nav className="flex-1 py-4 overflow-y-auto">
          {navSections.map((section) => (
            <div key={section.label} className="mb-6">
              <div className="px-5 text-muted font-mono text-xs tracking-wider mb-2">
                {section.label}
              </div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors border-r-2 border-transparent ${
                      isActive ? 'text-gold border-gold bg-gold/10' : 'text-fg/80 hover:text-gold hover:bg-s2'
                    }`
                  }
                  end={item.to === '/dashboard'}
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="p-4 border-t border-border space-y-3">
          <div className="bg-s2 rounded-lg px-4 py-3">
            <div className="text-muted text-xs mb-0.5 flex items-center justify-between">
              <span>المحفظة</span>
              {!editingPortfolio && (
                <button type="button" onClick={() => { setEditingPortfolio(true); setPortfolioInput(String(portfolioSize || '')); }} className="text-muted hover:text-gold p-0.5" title="تعديل" aria-label="تعديل">
                  ✏️
                </button>
              )}
            </div>
            {editingPortfolio ? (
              <input
                type="text"
                inputMode="decimal"
                value={portfolioInput}
                onChange={(e) => setPortfolioInput(e.target.value)}
                onBlur={handlePortfolioBlur}
                onKeyDown={(e) => { if (e.key === 'Enter') savePortfolioSize(portfolioInput); }}
                className="w-full bg-s3 border border-border rounded px-2 py-1 font-mono text-gold text-sm"
                dir="ltr"
                autoFocus
              />
            ) : (
              <div className="font-mono text-gold font-medium">
                {portfolioSize > 0 ? formatCurrency(portfolioSize) : '—'}
              </div>
            )}
          </div>
          {portfolioSize > 0 && (
            <div className="bg-s2 rounded-lg px-4 py-3 border border-border mt-2">
              <p className="text-muted text-xs mb-1.5">خطر المحفظة</p>
              <div className="h-2 bg-s3 rounded-full overflow-hidden mb-1" dir="ltr">
                <div
                  className={`h-full rounded-full transition-all ${riskBarColorClass} ${totalRiskPct > maxTotalRiskPct ? 'animate-pulse' : ''}`}
                  style={{ width: `${riskBarPct}%`, minWidth: totalRiskPct > 0 ? 6 : 0 }}
                />
              </div>
              <p className="text-xs font-mono text-fg">{totalRiskPct.toFixed(1)}%</p>
              <p className="text-xs text-muted">{openStocks.length} مراكز مفتوحة · مخاطرة {riskLabel}</p>
            </div>
          )}
          <button type="button" onClick={handleLogout} className="w-full py-2 text-sm text-muted hover:text-red transition-colors rounded-lg border border-border hover:border-red/50">
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-s1 border-t border-border z-10 flex justify-around py-2 safe-area-pb">
        {navSections.flatMap((s) => s.items).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-xs transition-colors ${isActive ? 'text-gold bg-gold/10' : 'text-muted'}`
            }
            end={item.to === '/dashboard'}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="truncate max-w-[4rem]">{item.label}</span>
          </NavLink>
        ))}
        <button type="button" onClick={handleLogout} className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-xs text-muted hover:text-red" title="تسجيل الخروج">
          <span className="text-lg">⎋</span>
          <span>خروج</span>
        </button>
      </nav>
    </>
  );
}

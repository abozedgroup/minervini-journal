import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadData, saveData, saveUser, loadWatchlist } from '../utils/storage';
import { calcRMultiple, formatR, formatRShort } from '../utils/calculations';
import { calcPortfolioRisk, calcProgressiveExposure } from '../utils/stockCalcs';
import { getConsecutiveLosses, getExposure, getSectorConcentration, getTradePositionValue, defaultSettings } from '../utils/portfolioUtils';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import EditTradeModal from '../components/trades/EditTradeModal';
import DeleteTradeModal from '../components/trades/DeleteTradeModal';
import EditHistoryPopover from '../components/trades/EditHistoryPopover';
import { useLiveR } from '../hooks/useLiveR';
import { usePortfolioSnapshot } from '../hooks/usePortfolioSnapshot';
import { useLivePositions } from '../hooks/useLivePositions';

const formatNum = (n) => (n == null || Number.isNaN(n) ? '—' : n);
const formatPct = (n) => (n == null || Number.isNaN(n) ? '—' : `${n.toFixed(1)}%`);

function computeKPIs(trades, portfolioSize) {
  const closed = trades.filter((t) => t.status === 'closed');
  const open = trades.filter((t) => t.status === 'open');
  const portfolio = portfolioSize || 1;

  const avgR = closed.length > 0 ? closed.reduce((s, t) => s + (t.rMultiple ?? 0), 0) / closed.length : null;
  const wins = closed.filter((t) => (t.rMultiple ?? 0) > 0).length;
  const winRate = closed.length > 0 ? (wins / closed.length) * 100 : null;

  let profitFactor = null;
  if (closed.length > 0) {
    let grossWins = 0;
    let grossLosses = 0;
    closed.forEach((t) => {
      const shares = t.shares ?? t.sharesActual ?? 0;
      const pnl = (t.closePrice - t.entryPrice) * shares;
      if (pnl > 0) grossWins += pnl;
      else grossLosses += Math.abs(pnl);
    });
    profitFactor = grossLosses > 0 ? grossWins / grossLosses : (grossWins > 0 ? 999 : null);
  }

  const openValue = open.reduce((s, t) => s + (t.entryPrice || 0) * (t.shares ?? t.sharesActual ?? 0), 0);
  const exposure = portfolio > 0 ? (openValue / portfolio) * 100 : null;

  let maxDrawdown = null;
  if (closed.length > 0) {
    const sorted = [...closed].sort((a, b) => new Date(a.closeDate || 0) - new Date(b.closeDate || 0));
    let peak = 0;
    let maxDD = 0;
    let cum = 0;
    sorted.forEach((t) => {
      const shares = t.shares ?? t.sharesActual ?? 0;
      const pnl = (t.closePrice - t.entryPrice) * shares;
      cum += pnl;
      if (cum > peak) peak = cum;
      const dd = peak - cum;
      if (dd > maxDD) maxDD = dd;
    });
    maxDrawdown = peak > 0 ? (maxDD / peak) * 100 : 0;
  }
  return { avgR, winRate, profitFactor, exposure, maxDrawdown };
}

function getRDistribution(trades) {
  const closed = trades.filter((t) => t.status === 'closed');
  const ranges = [
    { range: '≥2R', min: 2, max: Infinity },
    { range: '1R–2R', min: 1, max: 2 },
    { range: '0–1R', min: 0, max: 1 },
    { range: '-1R–0', min: -1, max: 0 },
    { range: '<-1R', min: -Infinity, max: -1 },
  ];
  return ranges.map((r) => {
    const count = closed.filter((t) => t.rMultiple != null && t.rMultiple >= r.min && t.rMultiple < r.max).length;
    const pct = closed.length > 0 ? (count / closed.length) * 100 : 0;
    return { ...r, count, pct };
  });
}

function getMonthlyNetR(trades) {
  const closed = trades.filter((t) => t.status === 'closed' && t.closeDate);
  const byMonth = {};
  closed.forEach((t) => {
    const ym = t.closeDate.slice(0, 7);
    if (!byMonth[ym]) byMonth[ym] = 0;
    byMonth[ym] += t.rMultiple ?? 0;
  });
  const now = new Date();
  const last6 = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    last6.push({ month: ym, netR: byMonth[ym] ?? 0 });
  }
  return last6.reverse();
}

const MONTH_NAMES = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
function formatMonthShort(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_NAMES[m - 1].slice(0, 3)} ${String(y).slice(2)}`;
}

const LOSS_REVIEW_CHECKLIST = [
  'هل السوق في اتجاه هابط؟',
  'هل خرجت من الصفقات مبكراً؟',
  'هل التزمت بقواعد الدخول؟',
  'هل حجم المراكز كان مناسباً؟',
];

export default function Dashboard({ user, setUser }) {
  const navigate = useNavigate();
  const username = user?.username || '';
  const settings = username ? (loadData(username, 'settings', defaultSettings()) || defaultSettings()) : defaultSettings();
  const portfolioSize = settings.portfolioSize ?? user?.portfolioSize ?? 0;
  const { showToast } = useToast();
  const [watchlist, setWatchlist] = useState([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editTrade, setEditTrade] = useState(null);
  const [deleteTrade, setDeleteTrade] = useState(null);
  const [lossReviewOpen, setLossReviewOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  useEffect(() => {
    if (!username) return;
    setWatchlist(loadWatchlist(username) || []);
  }, [username]);

  const openStocks = watchlist.filter((s) => s.status === 'open');
  const closedStocks = watchlist.filter((s) => s.status === 'closed');
  const openTrades = openStocks.map((s) => ({
    ...(s.trade || {}),
    id: s.id,
    ticker: s.ticker,
    company: s.company,
    status: 'open',
    entryPrice: s.trade?.entryPrice,
    stopLoss: s.trade?.currentStop ?? s.plan?.stop,
    rMultiple: s.trade?.currentR ?? s.trade?.rMultiple,
  }));
  const closedTrades = closedStocks.map((s) => ({
    ...(s.trade || {}),
    id: s.id,
    ticker: s.ticker,
    company: s.company,
    status: 'closed',
    closeDate: s.close?.closeDate ?? s.trade?.closeDate,
    rMultiple: s.close?.finalR ?? s.trade?.finalR ?? s.trade?.rMultiple,
    closePrice: s.close?.closePrice ?? s.trade?.closePrice,
  }));
  const trades = openTrades.concat(closedTrades);

  const { liveData, loading: liveLoading, lastUpdate, refresh: refreshLiveR } = useLiveR(openTrades);
  const { snapshot: portfolioSnapshot, loading: snapshotLoading, refresh: refreshSnapshot, lastUpdated: snapshotLastUpdated } = usePortfolioSnapshot(settings);
  const { positions: livePositions, loading: livePositionsLoading, lastUpdated: livePositionsUpdated, error: livePositionsError, refresh: refreshLivePositions } = useLivePositions(openStocks, settings);

  const kpis = computeKPIs(trades, portfolioSize);
  const rDist = getRDistribution(trades);
  const monthlyBars = getMonthlyNetR(trades);
  const recentTrades = [...trades].sort((a, b) => new Date(b.entryDate || b.closeDate || 0) - new Date(a.entryDate || a.closeDate || 0)).slice(0, 5);

  const consecutiveLosses = getConsecutiveLosses(trades);
  const exposure = portfolioSize > 0 ? getExposure(openTrades, portfolioSize) : 0;
  const cash = portfolioSize > 0 ? Math.max(0, portfolioSize - openTrades.reduce((s, t) => s + getTradePositionValue(t), 0)) : 0;
  const cashPct = portfolioSize > 0 ? (cash / portfolioSize) * 100 : 0;
  const sectorConcentration = getSectorConcentration(openTrades, portfolioSize);
  const portfolioRisk = calcPortfolioRisk(openStocks, portfolioSize);
  const maxTotalRiskPct = settings?.maxTotalRiskPct ?? 6;
  const totalRiskPct = portfolioRisk?.totalRiskPct ?? 0;
  const riskBarColorClass = totalRiskPct <= (maxTotalRiskPct * 0.5) ? 'bg-teal' : totalRiskPct <= maxTotalRiskPct ? 'bg-gold' : 'bg-red';
  const riskBarLabel = totalRiskPct <= (maxTotalRiskPct * 0.5) ? 'مخاطرة منخفضة ✓' : totalRiskPct <= maxTotalRiskPct ? 'مخاطرة معتدلة' : '⚠️ مخاطرة مرتفعة';
  const progressiveExposure = calcProgressiveExposure(closedStocks);
  const largestPosition = openTrades.length > 0 ? openTrades.reduce((best, t) => {
    const val = getTradePositionValue(t);
    const pct = portfolioSize > 0 ? (val / portfolioSize) * 100 : 0;
    return !best || pct > best.pct ? { ticker: t.ticker, pct } : best;
  }, null) : null;

  const recommendations = [];
  if (totalRiskPct > maxTotalRiskPct) recommendations.push(`⚠️ مخاطرة مرتفعة (${totalRiskPct.toFixed(1)}% > ${maxTotalRiskPct}%) — لا تفتح مراكز جديدة`);
  if (progressiveExposure?.phase === 'hard') recommendations.push(`⚠️ السوق صعب — قلّص الحجم إلى ${progressiveExposure.suggested}%`);
  if (consecutiveLosses >= 3) recommendations.push('🛑 توقف وراجع منهجك — 3 خسائر متتالية');
  else if (consecutiveLosses >= 2) recommendations.push('⚠️ خسارتان متتاليتان — قلّص الأحجام 50%');
  if (exposure > (settings?.maxExposurePct ?? 70)) recommendations.push('التعرض مرتفع — لا تفتح مراكز جديدة حتى تغلق واحدة');
  if (largestPosition && largestPosition.pct > (settings?.maxPositionPct ?? 25)) recommendations.push(`مركز ${largestPosition.ticker} كبير جداً (${largestPosition.pct.toFixed(0)}%) — راقبه`);
  if (progressiveExposure?.phase === 'easy' && totalRiskPct < 4) recommendations.push(`✅ السوق سهل — يمكنك زيادة الحجم إلى ${progressiveExposure.suggested}%`);
  if (kpis.winRate != null && kpis.winRate < 40) recommendations.push('راجع معايير الدخول');
  if (kpis.profitFactor != null && kpis.profitFactor < 1.5) recommendations.push('نسبة الربح/خسارة تحتاج تحسين');

  const saveWatchlist = (next) => {
    setWatchlist(next);
    saveData(username, 'watchlist', next);
  };

  const handleAddTrade = (e) => {
    e.preventDefault();
    const form = e.target;
    const entry = parseFloat(form.entryPrice?.value) || 0;
    const stop = parseFloat(form.stopLoss?.value) || 0;
    const target = parseFloat(form.target?.value) || 0;
    const shares = parseInt(form.shares?.value, 10) || 0;
    if (!entry || !stop || !target || !shares) return;
    const newTrade = {
      id: Date.now(),
      ticker: (form.ticker?.value || '').toUpperCase().trim(),
      company: form.company?.value?.trim() || '',
      setup: form.setup?.value || 'Minervini Core',
      strategy: 'Minervini Core',
      entryPrice: entry,
      stopLoss: stop,
      target,
      shares,
      rRisk: entry - stop,
      positionValue: entry * shares,
      status: 'open',
      entryNote: form.entryNote?.value?.trim() || '',
      execNote: '',
      checks: [],
      dailyNotes: [],
      entryDate: new Date().toISOString(),
      rMultiple: null,
      closePrice: null,
      closeNote: null,
      closeReason: null,
      grade: null,
      closeDate: null,
    };
    const newStock = { id: newTrade.id, ticker: newTrade.ticker, company: newTrade.company, status: 'open', plan: { pivot: newTrade.entryPrice, stop: newTrade.stopLoss, riskPct: 1.5 }, trade: { ...newTrade, currentStop: newTrade.stopLoss, originalStop: newTrade.stopLoss } };
    saveWatchlist([...watchlist, newStock]);
    setAddModalOpen(false);
    showToast('تمت إضافة الصفقة', 'success');
  };

  const handleImportClosed = (e) => {
    e.preventDefault();
    const form = e.target;
    const entry = parseFloat(form.entryPrice?.value) || 0;
    const exit = parseFloat(form.exitPrice?.value) || 0;
    const stop = parseFloat(form.stopLoss?.value) || 0;
    const shares = parseInt(form.shares?.value, 10) || 0;
    const dateStr = form.closeDate?.value || new Date().toISOString().slice(0, 10);
    if (!entry || !exit || !stop || !shares) return;
    const rMult = calcRMultiple(entry, exit, stop);
    const newTrade = {
      id: Date.now(),
      source: 'import',
      ticker: (form.ticker?.value || '').toUpperCase().trim(),
      company: form.company?.value?.trim() || '',
      setup: form.setup?.value || 'Minervini Core',
      strategy: 'Minervini Core',
      entryPrice: entry,
      stopLoss: stop,
      target: entry + (entry - stop) * 2,
      shares,
      status: 'closed',
      closePrice: exit,
      closeDate: dateStr + (dateStr.length === 10 ? 'T12:00:00.000Z' : ''),
      closeNote: form.notes?.value?.trim() || '',
      closeReason: null,
      grade: null,
      rMultiple: rMult,
      entryDate: dateStr + (dateStr.length === 10 ? 'T09:00:00.000Z' : ''),
      dailyNotes: [],
    };
    const newStock = { id: newTrade.id, ticker: newTrade.ticker, company: newTrade.company, status: 'open', plan: { pivot: newTrade.entryPrice, stop: newTrade.stopLoss, riskPct: 1.5 }, trade: { ...newTrade, currentStop: newTrade.stopLoss, originalStop: newTrade.stopLoss } };
    saveWatchlist([...watchlist, newStock]);
    setImportModalOpen(false);
    showToast('تم استيراد الصفقة المغلقة', 'success');
  };

  return (
    <div className="min-h-screen">
      {/* ═══ HEADER ═══ */}
      <header className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-border px-6 py-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <h1 className="font-display text-xl text-fg">لوحة التحكم</h1>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded bg-s2 border border-border text-xs font-mono text-teal">NASDAQ +1.2%</span>
            <span className="px-2.5 py-1 rounded bg-s2 border border-border text-xs font-mono text-teal">S&P +0.8%</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setSettingsModalOpen(true)} className="px-3 py-2 rounded-lg border border-border text-muted hover:text-fg hover:bg-s2 text-sm">⚙️ الإعدادات</button>
          <button type="button" onClick={() => setImportModalOpen(true)} className="px-3 py-2 rounded-lg border border-border text-fg hover:bg-s2 text-sm">استيراد صفقة</button>
          <button type="button" onClick={() => setAddModalOpen(true)} className="px-4 py-2 rounded-lg bg-gold text-black font-bold text-sm hover:bg-gold/90">+ صفقة جديدة</button>
        </div>
      </header>

      {/* ═══ STATUS BAR ═══ */}
      <div className="flex items-center gap-3 px-6 py-2 bg-s1 border-b border-border text-xs text-muted" dir="rtl">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${liveLoading ? 'bg-gold animate-pulse' : 'bg-teal'}`} />
        <span>{liveLoading ? 'جاري تحديث الأسعار...' : lastUpdate ? `آخر تحديث: ${lastUpdate.toLocaleTimeString('ar')}` : 'لم يتم التحديث بعد'}</span>
        {portfolioSnapshot && snapshotLastUpdated && (
          <span className="text-border">|</span>
        )}
        {portfolioSnapshot && snapshotLastUpdated && (
          <span>لقطة محدّثة منذ {Math.round((Date.now() - snapshotLastUpdated.getTime()) / 60000)} د</span>
        )}
        <div className="mr-auto flex gap-2">
          <button type="button" onClick={refreshLiveR} disabled={liveLoading} className="px-2 py-1 rounded bg-s3 border border-border hover:border-gold disabled:opacity-50">🔄 تحديث</button>
          {portfolioSnapshot && <button type="button" onClick={refreshSnapshot} className="px-2 py-1 rounded bg-s3 border border-border hover:border-gold">📊</button>}
        </div>
      </div>

      {/* ═══ ALERT: CONSECUTIVE LOSSES ═══ */}
      {consecutiveLosses >= 2 && (
        <div className={`flex items-center justify-between px-6 py-2.5 text-sm ${consecutiveLosses >= 3 ? 'bg-red/15 text-red border-b border-red/30' : 'bg-amber-500/15 text-amber-400 border-b border-amber-500/30'}`} dir="rtl">
          <span>{consecutiveLosses >= 3 ? `🔴 ${consecutiveLosses} خسائر متتالية — توقف وراجع منهجك` : `🟡 خسارتان متتاليتان — قلّص حجم مراكزك 50%`}</span>
          {consecutiveLosses >= 3 && (
            <button type="button" onClick={() => setLossReviewOpen(true)} className="px-3 py-1 rounded border border-current text-xs font-medium">قائمة المراجعة</button>
          )}
        </div>
      )}

      <div className="p-6 space-y-6" dir="rtl">

        {/* ══════════════════════════════════════════════
            SECTION 1 — نظرة عامة على المحفظة
        ══════════════════════════════════════════════ */}
        <div>
          <h2 className="text-xs font-medium text-muted uppercase tracking-widest mb-3">نظرة عامة على المحفظة</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-s1 border border-border rounded-xl p-4">
              <p className="text-muted text-xs mb-1">قيمة المحفظة</p>
              <p className="font-mono font-bold text-teal text-lg leading-tight">
                ${(portfolioSnapshot?.currentPortfolioValue ?? portfolioSize).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="bg-s1 border border-border rounded-xl p-4">
              <p className="text-muted text-xs mb-1">النقد المتاح</p>
              <p className="font-mono font-bold text-fg text-lg leading-tight">${cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              <p className="text-xs text-muted mt-0.5">{cashPct.toFixed(0)}% من المحفظة</p>
            </div>
            <div className="bg-s1 border border-border rounded-xl p-4">
              <p className="text-muted text-xs mb-1">تعرض السوق</p>
              <p className={`font-mono font-bold text-lg leading-tight ${exposure > (settings?.maxExposurePct ?? 70) ? 'text-red' : exposure > 50 ? 'text-gold' : 'text-teal'}`}>{exposure.toFixed(0)}%</p>
              <div className="mt-1.5 h-1.5 bg-s3 rounded-full overflow-hidden w-full" dir="ltr">
                <div className={`h-full rounded-full transition-all ${exposure > (settings?.maxExposurePct ?? 70) ? 'bg-red' : exposure > 50 ? 'bg-gold' : 'bg-teal'}`} style={{ width: `${Math.min(100, Math.max(exposure > 0 ? 3 : 0, (exposure / Math.max(1, settings?.maxExposurePct ?? 70)) * 100))}%`, minWidth: exposure > 0 ? 6 : 0 }} />
              </div>
            </div>
            <div className="bg-s1 border border-border rounded-xl p-4">
              <p className="text-muted text-xs mb-1">خطر المحفظة</p>
              <p className={`font-mono font-bold text-lg leading-tight ${totalRiskPct > maxTotalRiskPct ? 'text-red' : totalRiskPct > (maxTotalRiskPct / 2) ? 'text-gold' : 'text-teal'}`}>{totalRiskPct.toFixed(1)}%</p>
              <p className="text-xs text-muted mt-0.5">{riskBarLabel} (الحد {maxTotalRiskPct}%)</p>
              <p className="text-[0.65rem] text-muted mt-0.5">إجمالي المبلغ المعرّض للخسارة لو وصلت كل الصفقات للوقف</p>
            </div>
            <div className="bg-s1 border border-border rounded-xl p-4">
              <p className="text-muted text-xs mb-1">ربح محقق</p>
              <p className={`font-mono font-bold text-lg leading-tight ${(portfolioSnapshot?.closedPnL ?? 0) >= 0 ? 'text-teal' : 'text-red'}`}>
                {portfolioSnapshot ? `$${(portfolioSnapshot.closedPnL ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
              </p>
            </div>
            <div className="bg-s1 border border-border rounded-xl p-4">
              <p className="text-muted text-xs mb-1">إجمالي العائد</p>
              <p className={`font-mono font-bold text-lg leading-tight ${(portfolioSnapshot?.totalReturnPct ?? 0) >= 0 ? 'text-teal' : 'text-red'}`}>
                {portfolioSnapshot ? `${(portfolioSnapshot.totalReturnPct ?? 0) >= 0 ? '+' : ''}${(portfolioSnapshot.totalReturnPct ?? 0).toFixed(1)}%` : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            SECTION 2 — مؤشرات الأداء
        ══════════════════════════════════════════════ */}
        <div>
          <h2 className="text-xs font-medium text-muted uppercase tracking-widest mb-3">مؤشرات الأداء</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-s1 border border-border rounded-xl p-4">
              <p className="text-muted text-xs mb-1">متوسط R-Multiple</p>
              <p className={`font-mono font-bold text-xl ${kpis.avgR != null && kpis.avgR >= 1.5 ? 'text-teal' : kpis.avgR != null && kpis.avgR >= 1 ? 'text-gold' : 'text-muted'}`}>{formatR(kpis.avgR)}</p>
            </div>
            <div className="bg-s1 border border-border rounded-xl p-4">
              <p className="text-muted text-xs mb-1">نسبة الفوز</p>
              <p className={`font-mono font-bold text-xl ${kpis.winRate != null && kpis.winRate >= 50 ? 'text-teal' : kpis.winRate != null && kpis.winRate >= 40 ? 'text-gold' : 'text-red'}`}>{formatPct(kpis.winRate)}</p>
            </div>
            <div className="bg-s1 border border-border rounded-xl p-4">
              <p className="text-muted text-xs mb-1">معامل الربح</p>
              <p className={`font-mono font-bold text-xl ${kpis.profitFactor != null && kpis.profitFactor >= 2 ? 'text-teal' : kpis.profitFactor != null && kpis.profitFactor >= 1.5 ? 'text-gold' : 'text-red'}`}>
                {kpis.profitFactor != null ? kpis.profitFactor.toFixed(2) : '—'}
              </p>
            </div>
            <div className="bg-s1 border border-border rounded-xl p-4">
              <p className="text-muted text-xs mb-1">أقصى انخفاض</p>
              <p className={`font-mono font-bold text-xl ${kpis.maxDrawdown != null && kpis.maxDrawdown > 20 ? 'text-red' : kpis.maxDrawdown != null && kpis.maxDrawdown > 10 ? 'text-gold' : 'text-teal'}`}>
                {kpis.maxDrawdown != null ? `-${kpis.maxDrawdown.toFixed(1)}%` : '—'}
              </p>
            </div>
            <div className="bg-s1 border border-border rounded-xl p-4">
              <p className="text-muted text-xs mb-1">حجم مقترح</p>
              {progressiveExposure ? (
                <>
                  <p className={`font-mono font-bold text-xl ${progressiveExposure.phase === 'easy' ? 'text-teal' : progressiveExposure.phase === 'hard' ? 'text-red' : 'text-gold'}`}>{progressiveExposure.suggested}%</p>
                  <p className="text-xs text-muted mt-0.5">{progressiveExposure.phase === 'easy' ? '🟢 سوق سهل' : progressiveExposure.phase === 'hard' ? '🔴 سوق صعب' : '🟡 طبيعي'}</p>
                </>
              ) : <p className="font-mono text-xl text-muted">—</p>}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            SECTION 3 — صحة المحفظة + الأداء الشهري
        ══════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Portfolio Health */}
          <div className="lg:col-span-2 bg-s1 border border-border rounded-xl p-5">
            <h3 className="text-gold font-medium mb-4">صحة المحفظة <span className="text-teal text-xs font-normal">مينيرفيني ✓</span></h3>

            {/* Progress bars */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="min-w-0">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted">تعرض السوق</span>
                  <span className="font-mono text-fg">{exposure.toFixed(0)}% / {settings?.maxExposurePct ?? 70}%</span>
                </div>
                <div className="h-2 bg-s2 rounded-full overflow-hidden w-full" dir="ltr">
                  <div className={`h-full rounded-full transition-all ${exposure > (settings?.maxExposurePct ?? 70) ? 'bg-red' : exposure > 50 ? 'bg-gold' : 'bg-teal'}`} style={{ width: `${Math.min(100, Math.max(exposure > 0 ? 3 : 0, (exposure / Math.max(1, settings?.maxExposurePct ?? 70)) * 100))}%`, minWidth: exposure > 0 ? 6 : 0 }} />
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted">خطر المحفظة</span>
                  <span className="font-mono text-fg">{totalRiskPct.toFixed(1)}% / {maxTotalRiskPct}%</span>
                </div>
                <div className="h-2 bg-s2 rounded-full overflow-hidden w-full" dir="ltr">
                  <div className={`h-full rounded-full transition-all ${riskBarColorClass}`} style={{ width: `${Math.min(100, Math.max(totalRiskPct > 0 ? 3 : 0, (totalRiskPct / Math.max(0.5, maxTotalRiskPct)) * 100))}%`, minWidth: totalRiskPct > 0 ? 6 : 0 }} />
                </div>
              </div>
            </div>

            {/* Key stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-s2 rounded-lg p-3">
                <p className="text-muted text-xs mb-1">أكبر مركز</p>
                <p className="font-mono text-sm">{largestPosition ? `${largestPosition.ticker} ${largestPosition.pct.toFixed(0)}%${largestPosition.pct <= (settings?.maxPositionPct ?? 25) ? ' ✓' : ' ⚠️'}` : '—'}</p>
              </div>
              <div className="bg-s2 rounded-lg p-3">
                <p className="text-muted text-xs mb-1">خسائر متتالية</p>
                <p className="font-mono text-sm">{consecutiveLosses === 0 ? '0 🟢' : consecutiveLosses === 1 ? '1 🟢' : consecutiveLosses === 2 ? '2 🟡' : `${consecutiveLosses} 🔴`}</p>
              </div>
            </div>

            {/* Risk per trade */}
            {openTrades.length > 0 && portfolioRisk && (
              <div className="mb-4">
                <p className="text-xs text-muted mb-2">خطر كل صفقة على حدة:</p>
                <div className="space-y-1.5">
                  {portfolioRisk.trades.map(({ ticker: tick, riskPct: rPct, isProtected }) => {
                    const scaleMax = Math.max(maxTotalRiskPct, 1);
                    const barPct = rPct != null && rPct > 0 ? Math.min(100, Math.max(3, (rPct / scaleMax) * 100)) : 0;
                    const barColorClass = (rPct ?? 0) > (maxTotalRiskPct * 0.5) ? 'bg-red' : (rPct ?? 0) > (maxTotalRiskPct * 0.25) ? 'bg-gold' : 'bg-teal';
                    return (
                      <div key={tick} className="flex items-center gap-2 text-xs min-w-0">
                        <span className="font-mono text-gold w-14 shrink-0">{tick}</span>
                        <div className="flex-1 min-w-[80px] h-2 bg-s3 rounded-full overflow-hidden" dir="ltr">
                          <div className={`h-full rounded-full transition-all ${barColorClass}`} style={{ width: `${barPct}%`, minWidth: (rPct ?? 0) > 0 ? 8 : 0 }} />
                        </div>
                        <span className="font-mono w-10 text-left shrink-0">{(rPct ?? 0).toFixed(1)}%</span>
                        {isProtected && <span className="text-gold text-[0.6rem] shrink-0">🔒</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sector concentration */}
            {sectorConcentration.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {sectorConcentration.map(({ sector, pct }) => (
                  <span key={sector} className={`text-xs px-2 py-0.5 rounded-full ${pct > 40 ? 'bg-red/20 text-red' : 'bg-s3 text-muted'}`}>
                    {sector}: {pct.toFixed(0)}%{pct > 40 ? ' ⚠️' : ''}
                  </span>
                ))}
              </div>
            )}

            {/* Recommendations — show all */}
            {recommendations.length > 0 ? (
              <div className="rounded-lg p-3 bg-amber-500/10 border border-amber-500/20 text-sm text-amber-300">
                <p className="text-xs font-medium text-amber-400 mb-2">💡 التوصيات:</p>
                <ul className="space-y-1.5 list-none p-0 m-0 text-right">
                  {recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-amber-500 shrink-0">{i + 1}.</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-lg p-3 bg-teal/10 border border-teal/20 text-sm text-teal">✅ المحفظة ضمن معايير مينيرفيني</div>
            )}
          </div>

          {/* Monthly Performance */}
          <div className="bg-s1 border border-border rounded-xl p-5">
            <h3 className="text-gold font-medium mb-4">أداء شهري (صافي R)</h3>
            {monthlyBars.every((m) => m.netR === 0) ? (
              <p className="text-muted text-sm">لا توجد صفقات مغلقة بعد</p>
            ) : (
              <div className="flex items-end gap-1.5 h-28 mb-2">
                {monthlyBars.map((m) => (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <span className={`text-[0.6rem] font-mono ${m.netR >= 0 ? 'text-teal' : 'text-red'}`}>{m.netR !== 0 ? formatRShort(m.netR) : ''}</span>
                    <div className={`w-full rounded-sm min-h-[4px] transition-all ${m.netR >= 0 ? 'bg-teal/70' : 'bg-red/70'}`} style={{ height: `${Math.min(80, Math.abs(m.netR) * 15 + 4)}px` }} />
                    <span className="text-muted text-[0.6rem]">{formatMonthShort(m.month)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted mb-0.5">آخر 10 — نسبة فوز</p>
                <p className="font-mono font-bold text-lg text-gold">{portfolioSnapshot ? `${((portfolioSnapshot.last10WinRate ?? 0) * 100).toFixed(0)}%` : `${kpis.winRate != null ? kpis.winRate.toFixed(0) : '—'}%`}</p>
              </div>
              <div>
                <p className="text-muted mb-0.5">صفقات مفتوحة</p>
                <p className="font-mono font-bold text-lg text-fg">{openTrades.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            SECTION 4 — المراكز المفتوحة (مباشر)
        ══════════════════════════════════════════════ */}
        {openStocks.length > 0 && (
          <div className="bg-s1 border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-gold font-medium">المراكز المفتوحة</h3>
                <span className="flex items-center gap-1 text-xs text-red-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  مباشر
                </span>
              </div>
              <div className="flex items-center gap-3">
                {livePositionsError === 'backend_offline' && (
                  <span className="text-red-400 text-xs">⚠️ الخادم غير متصل</span>
                )}
                {livePositionsUpdated && !livePositionsLoading && (
                  <span className="text-muted text-xs">{livePositionsUpdated.toLocaleTimeString('ar')}</span>
                )}
                <button type="button" onClick={refreshLivePositions} disabled={livePositionsLoading} className="text-xs text-gold hover:underline disabled:opacity-50">🔄 تحديث</button>
              </div>
            </div>

            {livePositionsLoading && !livePositionsError ? (
              <div className="flex items-center gap-2 text-muted text-sm p-5">
                <div className="w-2.5 h-2.5 rounded-full bg-gold animate-pulse" />
                جاري جلب الأسعار...
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                {livePositions.some((p) => p.live) && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-s2/50 border-b border-border">
                    <div>
                      <p className="text-muted text-xs mb-0.5">إجمالي غير محقق</p>
                      <p className={`font-mono font-bold text-base ${livePositions.reduce((s, p) => s + (p.live?.unrealizedPnL ?? 0), 0) >= 0 ? 'text-teal' : 'text-red'}`}>
                        ${livePositions.reduce((s, p) => s + (p.live?.unrealizedPnL ?? 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted text-xs mb-0.5">أفضل مركز</p>
                      {(() => {
                        const best = livePositions.reduce((a, p) => (p.live && (a == null || (p.live.currentR ?? -999) > (a.live?.currentR ?? -999)) ? p : a), null);
                        return best?.live ? <p className="font-mono text-teal font-bold">{best.ticker} {formatR(best.live.currentR)}</p> : <p className="text-muted font-mono">—</p>;
                      })()}
                    </div>
                    <div>
                      <p className="text-muted text-xs mb-0.5">أسوأ مركز</p>
                      {(() => {
                        const worst = livePositions.reduce((a, p) => (p.live && (a == null || (p.live.currentR ?? 999) < (a.live?.currentR ?? 999)) ? p : a), null);
                        return worst?.live ? <p className="font-mono text-red font-bold">{worst.ticker} {formatR(worst.live.currentR)}</p> : <p className="text-muted font-mono">—</p>;
                      })()}
                    </div>
                    <div>
                      <p className="text-muted text-xs mb-0.5">ربح غير محقق %</p>
                      <p className={`font-mono font-bold text-base ${(portfolioSnapshot?.totalUnrealizedPnL ?? 0) >= 0 ? 'text-teal' : 'text-red'}`}>
                        {portfolioSnapshot ? `${(portfolioSnapshot.totalUnrealizedPnLPct ?? 0) >= 0 ? '+' : ''}${(portfolioSnapshot.totalUnrealizedPnLPct ?? 0).toFixed(2)}%` : '—'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Unified Positions Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-s2 text-right border-b border-border">
                        <th className="px-4 py-2.5 text-muted font-medium">الرمز</th>
                        <th className="px-4 py-2.5 text-muted font-medium">الدخول</th>
                        <th className="px-4 py-2.5 text-muted font-medium">السعر الآن</th>
                        <th className="px-4 py-2.5 text-muted font-medium">تغير %</th>
                        <th className="px-4 py-2.5 text-muted font-medium">ربح/خسارة $</th>
                        <th className="px-4 py-2.5 text-muted font-medium">R الحالي</th>
                        <th className="px-4 py-2.5 text-muted font-medium">أهم تلميح</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(livePositions.length > 0 ? livePositions : openStocks.map((s) => ({ ...s, live: null }))).map((t) => {
                        const live = t.live;
                        const r = live?.currentR ?? (liveData[t.ticker]?.r_multiple ?? null);
                        const rowBg = r != null && r > 2 ? 'bg-teal-500/5' : r != null && r < 0 ? 'bg-red-500/5' : '';
                        const hint = live?.hints?.[0];
                        const entryPrice = t.trade?.entryPrice ?? t.entryPrice ?? 0;
                        return (
                          <tr key={t.id} className={`border-b border-border/50 hover:bg-s2/50 text-right ${rowBg}`}>
                            <td className="px-4 py-2.5 font-mono text-gold font-bold">
                              <button
                                type="button"
                                onClick={() => navigate('/stock/' + t.id)}
                                className="hover:underline hover:text-gold/80 transition-colors"
                              >
                                {t.ticker}
                              </button>
                              <EditHistoryPopover editHistory={t.editHistory ?? t.trade?.editHistory} />
                            </td>
                            <td className="px-4 py-2.5 font-mono text-muted text-xs">${Number(entryPrice).toFixed(2)}</td>
                            <td className="px-4 py-2.5 font-mono">{live ? `$${live.currentPrice.toFixed(2)}` : '—'}</td>
                            <td className={`px-4 py-2.5 font-mono ${(live?.changePct ?? 0) >= 0 ? 'text-teal' : 'text-red'}`}>
                              {live ? `${(live.changePct ?? 0) >= 0 ? '+' : ''}${(live.changePct ?? 0).toFixed(2)}%` : '—'}
                            </td>
                            <td className={`px-4 py-2.5 font-mono ${(live?.unrealizedPnL ?? 0) >= 0 ? 'text-teal' : 'text-red'}`}>
                              {live ? `$${live.unrealizedPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${(live.unrealizedPnLPct * 100) >= 0 ? '+' : ''}${(live.unrealizedPnLPct * 100).toFixed(1)}%)` : '—'}
                            </td>
                            <td className={`px-4 py-2.5 font-mono font-bold ${r != null && r > 2 ? 'text-teal' : r != null && r >= 0 ? 'text-gold' : r != null ? 'text-red' : 'text-muted'}`}>
                              {formatR(r)}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted max-w-[200px] truncate" title={hint ? `${hint.message}` : ''}>
                              {hint ? `${hint.icon} ${hint.message}` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            SECTION 5 — آخر الصفقات + توزيع R
        ══════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Recent Trades */}
          <div className="bg-s1 border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-display text-gold text-base">آخر الصفقات</h2>
            </div>
            <div className="overflow-x-auto">
              {recentTrades.length === 0 ? (
                <div className="p-6 text-muted text-center text-sm">لا توجد صفقات. أضف أو استورد صفقة.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted text-right border-b border-border bg-s2">
                      <th className="px-4 py-2 font-medium">الرمز</th>
                      <th className="px-4 py-2 font-medium">Setup</th>
                      <th className="px-4 py-2 font-medium">الدخول</th>
                      <th className="px-4 py-2 font-medium">R</th>
                      <th className="px-4 py-2 font-medium">الدرجة</th>
                      <th className="px-4 py-2 font-medium">الحالة</th>
                      <th className="px-4 py-2 font-medium">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTrades.map((t) => (
                      <tr key={t.id} className="border-b border-border/50 hover:bg-s2/50 text-right">
                        <td className="px-4 py-2 font-mono text-gold font-bold">
                          <button
                            type="button"
                            onClick={() => navigate('/stock/' + t.id)}
                            className="hover:underline hover:text-gold/80 transition-colors"
                          >
                            {t.ticker}
                          </button>
                        </td>
                        <td className="px-4 py-2 text-muted text-xs">{t.setup ?? '—'}</td>
                        <td className="px-4 py-2 font-mono text-sm">{t.entryPrice ?? '—'}</td>
                        <td className="px-4 py-2">
                          {t.status === 'closed' && t.rMultiple != null ? (
                            <span className={`font-mono font-bold ${t.rMultiple < 0 ? 'text-red' : 'text-teal'}`}>{formatR(t.rMultiple)}</span>
                          ) : t.status === 'open' && liveData[t.ticker] ? (
                            <span className={`font-mono font-bold ${liveData[t.ticker].r_multiple > 0 ? 'text-teal' : liveData[t.ticker].r_multiple < 0 ? 'text-red' : 'text-muted'}`}>
                              {liveData[t.ticker].r_multiple != null ? formatR(liveData[t.ticker].r_multiple) : '—'}
                            </span>
                          ) : <span className="text-muted font-mono">—</span>}
                        </td>
                        <td className="px-4 py-2 font-mono text-gold">{t.grade ?? '—'}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${t.status === 'open' ? 'bg-teal/10 text-teal' : 'bg-s3 text-muted'}`}>
                            <span className={`w-1 h-1 rounded-full ${t.status === 'open' ? 'bg-teal' : 'bg-muted'}`} />
                            {t.status === 'open' ? 'مفتوحة' : 'مغلقة'}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1">
                            <EditHistoryPopover editHistory={t.editHistory} />
                            <button type="button" onClick={() => setEditTrade(t)} className="px-2 py-0.5 rounded border border-border text-xs hover:bg-s2">✏️</button>
                            <button type="button" onClick={() => setDeleteTrade(t)} className="px-2 py-0.5 rounded border border-red/50 text-red text-xs hover:bg-red/10">🗑</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* R-Multiple Distribution */}
          <div className="bg-s1 border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-display text-gold text-base">توزيع R-Multiple</h2>
            </div>
            <div className="p-5 space-y-3">
              {rDist.map((row) => (
                <div key={row.range} className="flex items-center gap-3">
                  <div className={`w-16 font-mono text-xs shrink-0 ${row.min >= 2 ? 'text-teal' : row.max <= 0 ? 'text-red' : row.min >= 1 ? 'text-teal/70' : 'text-muted'}`}>{row.range}</div>
                  <div className="flex-1 min-w-[60px] h-5 bg-s2 rounded-full overflow-hidden" dir="ltr">
                    <div className={`h-full rounded-full transition-all ${row.min >= 1 ? 'bg-teal/60' : row.max <= 0 ? 'bg-red/60' : 'bg-gold/50'}`} style={{ width: `${row.pct}%`, minWidth: row.pct > 0 ? 4 : 0 }} />
                  </div>
                  <div className="w-16 font-mono text-xs text-left">
                    <span className="text-gold font-bold">{row.count}</span>
                    <span className="text-muted mr-1">({row.pct.toFixed(0)}%)</span>
                  </div>
                </div>
              ))}
              {rDist.every((r) => r.count === 0) && (
                <p className="text-muted text-sm text-center py-4">لا توجد صفقات مغلقة بعد</p>
              )}
            </div>
          </div>
        </div>

      </div>

      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title="صفقة جديدة">
        <form onSubmit={handleAddTrade} className="space-y-4">
          <div>
            <label className="block text-muted text-sm mb-1">الرمز</label>
            <input name="ticker" required className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" placeholder="AAPL" dir="ltr" />
          </div>
          <div>
            <label className="block text-muted text-sm mb-1">الشركة</label>
            <input name="company" className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" placeholder="اسم الشركة" dir="rtl" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-muted text-sm mb-1">سعر الدخول</label>
              <input name="entryPrice" type="number" step="0.01" required className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="ltr" />
            </div>
            <div>
              <label className="block text-muted text-sm mb-1">وقف الخسارة</label>
              <input name="stopLoss" type="number" step="0.01" required className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="ltr" />
            </div>
            <div>
              <label className="block text-muted text-sm mb-1">الهدف</label>
              <input name="target" type="number" step="0.01" required className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="ltr" />
            </div>
          </div>
          <div>
            <label className="block text-muted text-sm mb-1">عدد الأسهم</label>
            <input name="shares" type="number" min="1" required className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="ltr" />
          </div>
          <div>
            <label className="block text-muted text-sm mb-1">Setup</label>
            <input name="setup" defaultValue="Minervini Core" className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="ltr" />
          </div>
          <div>
            <label className="block text-muted text-sm mb-1">ملاحظة الدخول</label>
            <textarea name="entryNote" rows={2} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" placeholder="ملاحظات" dir="rtl" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setAddModalOpen(false)} className="px-4 py-2 rounded-lg border border-border text-fg hover:bg-s2">إلغاء</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-gold text-black font-bold">إضافة الصفقة</button>
          </div>
        </form>
      </Modal>

      <Modal open={importModalOpen} onClose={() => setImportModalOpen(false)} title="استيراد صفقة مغلقة">
        <form onSubmit={handleImportClosed} className="space-y-4">
          <div>
            <label className="block text-muted text-sm mb-1">الرمز</label>
            <input name="ticker" required className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" placeholder="AAPL" dir="ltr" />
          </div>
          <div>
            <label className="block text-muted text-sm mb-1">الشركة</label>
            <input name="company" className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" placeholder="اسم الشركة" dir="rtl" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-muted text-sm mb-1">سعر الدخول</label>
              <input name="entryPrice" type="number" step="0.01" required className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="ltr" />
            </div>
            <div>
              <label className="block text-muted text-sm mb-1">سعر الخروج</label>
              <input name="exitPrice" type="number" step="0.01" required className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="ltr" />
            </div>
            <div>
              <label className="block text-muted text-sm mb-1">وقف الخسارة</label>
              <input name="stopLoss" type="number" step="0.01" required className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="ltr" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-muted text-sm mb-1">عدد الأسهم</label>
              <input name="shares" type="number" min="1" required className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="ltr" />
            </div>
            <div>
              <label className="block text-muted text-sm mb-1">تاريخ الإغلاق</label>
              <input name="closeDate" type="date" className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="ltr" />
            </div>
          </div>
          <div>
            <label className="block text-muted text-sm mb-1">Setup</label>
            <input name="setup" defaultValue="Minervini Core" className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="ltr" />
          </div>
          <div>
            <label className="block text-muted text-sm mb-1">ملاحظات</label>
            <textarea name="notes" rows={2} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" placeholder="ملاحظات الصفقة" dir="rtl" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setImportModalOpen(false)} className="px-4 py-2 rounded-lg border border-border text-fg hover:bg-s2">إلغاء</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-gold text-black font-bold">استيراد</button>
          </div>
        </form>
      </Modal>

      {editTrade && (
        <EditTradeModal
          trade={editTrade}
          username={username}
          onClose={() => setEditTrade(null)}
          onSave={(updated) => {
            const next = watchlist.map((s) => (s.id === editTrade.id ? { ...s, trade: { ...(s.trade || {}), ...updated } } : s));
            saveWatchlist(next);
            setEditTrade(null);
            showToast('✅ تم تعديل الصفقة — تم حفظ سجل التعديل');
          }}
        />
      )}
      {deleteTrade && (
        <DeleteTradeModal
          trade={deleteTrade}
          onClose={() => setDeleteTrade(null)}
          onConfirm={(reason) => {
            const deleted = { ...deleteTrade, deletedAt: new Date().toISOString(), deleteReason: reason };
            const deletedList = loadData(username, 'deleted_trades', []);
            saveData(username, 'deleted_trades', [...deletedList, deleted]);
            saveWatchlist(watchlist.filter((s) => s.id !== deleteTrade.id));
            setDeleteTrade(null);
            showToast('🗑 تم حذف الصفقة — يمكن مراجعتها في سجل المحذوفات');
          }}
        />
      )}

      <Modal open={lossReviewOpen} onClose={() => setLossReviewOpen(false)} title="مراجعة بعد خسائر متتالية" size="md">
        <p className="text-muted text-sm mb-4">راجع النقاط التالية قبل العودة للتداول:</p>
        <ul className="space-y-2">
          {LOSS_REVIEW_CHECKLIST.map((item, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="text-gold">□</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={() => setLossReviewOpen(false)} className="px-4 py-2 rounded-lg bg-gold text-black font-bold text-sm">تمت المراجعة</button>
        </div>
      </Modal>

      <Modal open={settingsModalOpen} onClose={() => setSettingsModalOpen(false)} title="حجم المحفظة والإعدادات" size="sm">
        <SettingsForm
          user={user}
          settings={settings}
          onSaveUser={(updates) => {
            const next = { ...user, ...updates };
            setUser(next);
            saveUser(username, next);
            setSettingsModalOpen(false);
            showToast('تم حفظ إعدادات المحفظة');
          }}
          onSaveSettings={(next) => {
            saveData(username, 'settings', { ...defaultSettings(), ...next });
            setSettingsModalOpen(false);
            showToast('تم حفظ الإعدادات');
          }}
        />
      </Modal>
    </div>
  );
}

function SettingsForm({ user, settings, onSaveUser, onSaveSettings }) {
  const currentPortfolio = settings?.portfolioSize ?? user?.portfolioSize ?? 0;
  const [portfolioSize, setPortfolioSize] = useState(String(currentPortfolio || ''));
  const [quickUpdateValue, setQuickUpdateValue] = useState('');
  const [defaultRiskPct, setDefaultRiskPct] = useState(String(settings?.defaultRiskPct ?? 1.5));
  const [maxPositionPct, setMaxPositionPct] = useState(String(settings?.maxPositionPct ?? 20));
  const [maxExposurePct, setMaxExposurePct] = useState(String(settings?.maxExposurePct ?? 70));
  const [maxTotalRiskPct, setMaxTotalRiskPct] = useState(String(settings?.maxTotalRiskPct ?? 6));

  const handleSubmit = (e) => {
    e.preventDefault();
    const size = parseFloat(String(portfolioSize).replace(/,/g, ''));
    const maxRisk = parseFloat(maxTotalRiskPct) || 6;
    if (!isNaN(size) && size > 0) {
      onSaveUser({ portfolioSize: size });
      onSaveSettings({
        ...settings,
        defaultRiskPct: parseFloat(defaultRiskPct) || 1.5,
        maxPositionPct: parseFloat(maxPositionPct) || 20,
        maxExposurePct: parseFloat(maxExposurePct) || 70,
        maxTotalRiskPct: maxRisk,
        minRR: settings?.minRR ?? 3,
        portfolioSize: size,
        updatedAt: new Date().toISOString(),
      });
    } else {
      onSaveSettings({
        ...settings,
        defaultRiskPct: parseFloat(defaultRiskPct) || 1.5,
        maxPositionPct: parseFloat(maxPositionPct) || 20,
        maxExposurePct: parseFloat(maxExposurePct) || 70,
        maxTotalRiskPct: maxRisk,
        minRR: settings?.minRR ?? 3,
      });
    }
  };

  const handleQuickUpdate = () => {
    const num = parseFloat(String(quickUpdateValue).replace(/,/g, ''));
    if (!isNaN(num) && num > 0) {
      setPortfolioSize(String(num));
      onSaveUser({ portfolioSize: num });
      onSaveSettings({ ...settings, portfolioSize: num, updatedAt: new Date().toISOString() });
      setQuickUpdateValue('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg p-3 bg-s2 border border-border">
        <h4 className="text-muted text-xs font-medium mb-2">تحديث حجم المحفظة بعد الصفقات</h4>
        <p className="text-muted text-xs mb-2">الحالي: <span className="font-mono text-gold">${Number(currentPortfolio).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            inputMode="decimal"
            value={quickUpdateValue}
            onChange={(e) => setQuickUpdateValue(e.target.value)}
            placeholder="قيمة جديدة"
            className="flex-1 min-w-[100px] bg-s3 border border-border rounded-lg px-3 py-2 font-mono text-sm"
            dir="ltr"
          />
          <button type="button" onClick={handleQuickUpdate} className="px-3 py-2 rounded-lg bg-gold/20 text-gold text-sm font-medium hover:bg-gold/30">
            تحديث
          </button>
        </div>
        <p className="text-muted text-xs mt-2">حدّث هذا الرقم بعد كل فترة أو عند إضافة/سحب رأس مال</p>
      </div>
      <div>
        <label className="block text-muted text-sm mb-1">حجم المحفظة $</label>
        <input type="text" inputMode="decimal" value={portfolioSize} onChange={(e) => setPortfolioSize(e.target.value)} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 font-mono" dir="ltr" placeholder="50000" />
      </div>
      <div>
        <label className="block text-muted text-sm mb-1">المخاطرة الافتراضية %</label>
        <input type="number" step="0.1" min="0.5" max="5" value={defaultRiskPct} onChange={(e) => setDefaultRiskPct(e.target.value)} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 font-mono" dir="ltr" />
      </div>
      <div>
        <label className="block text-muted text-sm mb-1">أقصى حجم مركز %</label>
        <input type="number" step="1" min="5" max="50" value={maxPositionPct} onChange={(e) => setMaxPositionPct(e.target.value)} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 font-mono" dir="ltr" />
      </div>
      <div>
        <label className="block text-muted text-sm mb-1">أقصى تعرض %</label>
        <input type="number" step="5" min="20" max="100" value={maxExposurePct} onChange={(e) => setMaxExposurePct(e.target.value)} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 font-mono" dir="ltr" />
      </div>
      <div>
        <label className="block text-muted text-sm mb-1">أقصى خطر محفظة %</label>
        <input type="number" step="0.5" min="3" max="15" value={maxTotalRiskPct} onChange={(e) => setMaxTotalRiskPct(e.target.value)} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 font-mono" dir="ltr" placeholder="6" />
        <p className="text-muted text-xs mt-0.5">الحد الذي تعتبر عنده مخاطرة المحفظة مرتفعة (مينيرفيني يوصي 6%)</p>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="submit" className="px-4 py-2 rounded-lg bg-gold text-black font-bold">حفظ</button>
      </div>
    </form>
  );
}

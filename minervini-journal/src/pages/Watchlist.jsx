import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { loadWatchlist, loadData, saveData, migrateStock, defaultStock, defaultPlan } from '../utils/storage';
import { migrateStrategy } from '../utils/strategySchema';
import { mergeTradesIntoWatchlist, migrateStockToPhaseModel, STATUS } from '../utils/stockSchema';
import { calcRR, calcShares, calcRMultiple, calcRRFromResistance, calcRRFromResistancePrice, calcRiskPctFromTriggerStop, calcRiskAmount, formatR } from '../utils/calculations';
import { calcSlippage } from '../utils/stockCalcs';
import { defaultSettings, calcPositionPct, getTradeTotalShares, getTradeAvgCost, getTradeRemainingShares, getTradePositionValue, getTradeRiskMetrics } from '../utils/portfolioUtils';
import { calcPhaseReadiness, DEFAULT_PHASES } from '../utils/watchlistModel';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import EditTradeModal from '../components/trades/EditTradeModal';
import DeleteTradeModal from '../components/trades/DeleteTradeModal';
import EditHistoryPopover from '../components/trades/EditHistoryPopover';
import { useLivePositions } from '../hooks/useLivePositions';
import RProgressBar from '../components/ui/RProgressBar';
import AddStockModal from '../components/modals/AddStockModal';
import SmartEntryPanel from '../components/modals/SmartEntryPanel';
import ExecutionModal from '../components/modals/ExecutionModal';
import CloseTradeModal from '../components/modals/CloseTradeModal';

const SETUP_OPTIONS = ['VCP', 'Pivot Breakout', 'Cup & Handle', 'Flat Base', 'RSI Bounce'];
const EXEC_CHECKS = [
  'السعر يتداول فوق Pivot Point بوضوح',
  'الحجم أعلى من المتوسط بـ 40%+',
  'NASDAQ / SP500 إيجابي الآن',
  'لم أتجاوز حد المخاطرة 2% من المحفظة',
  'Stop Loss محدد ومعروف مسبقاً',
  'لا إعلانات أرباح خلال أسبوعين',
  'نسبة التعرض الكلي ستبقى تحت 50%',
  'لست في سلسلة خسائر متتالية',
];
const EXIT_REASONS = [
  'وصل الهدف',
  'كسر Stop Loss',
  'تغير في سلوك السهم',
  'ضعف السوق العام',
  'أخذ جزء من الأرباح',
];

function calcReadiness(stock) {
  const { readiness } = calcPhaseReadiness(stock?.phases);
  if (stock?.phases) return readiness;
  let score = 0;
  const fields = [
    stock?.ticker,
    stock?.company,
    stock?.setup,
    stock?.trigger > 0,
    stock?.stop > 0,
    (stock?.resistancePct != null && stock.resistancePct > 0) || stock?.trigger > 0,
    stock?.riskPct > 0,
    stock?.technicalNotes,
    stock?.epsGrowth != null && stock.epsGrowth !== '',
    stock?.revenueGrowth != null && stock.revenueGrowth !== '',
    stock?.entryNote,
  ];
  const total = fields.length;
  fields.forEach((f) => { if (f) score += 1; });
  const checks = stock?.checks || {};
  const checkFields = ['above200', 'above50', 'dryUp', 'rsRating', 'patternComplete'];
  checkFields.forEach((k) => { if (checks[k]) score += 2; });
  return Math.min(100, Math.round((score / (total + checkFields.length * 2)) * 100));
}

const defaultChecks = () => ({
  above200: false,
  above50: false,
  dryUp: false,
  rsRating: false,
  patternComplete: false,
});

export default function Watchlist({ user }) {
  const username = user?.username || '';
  const settings = username ? (loadData(username, 'settings', defaultSettings()) || defaultSettings()) : defaultSettings();
  const portfolioSize = settings.portfolioSize ?? user?.portfolioSize ?? 0;
  const navigate = useNavigate();
  const location = useLocation();
  const [watchlist, setWatchlist] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [trades, setTrades] = useState([]);
  const [tab, setTab] = useState('watching');
  const [strategyFilterId, setStrategyFilterId] = useState('');
  const { showToast } = useToast();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [smartEntryStock, setSmartEntryStock] = useState(null);
  const [editStock, setEditStock] = useState(null);
  const [execStock, setExecStock] = useState(null);
  const [closeTrade, setCloseTrade] = useState(null);
  const [editTrade, setEditTrade] = useState(null);
  const [deleteTrade, setDeleteTrade] = useState(null);

  useEffect(() => {
    if (!username) return;
    let list = (loadWatchlist(username) || []).map(migrateStockToPhaseModel);
    const legacyTrades = loadData(username, 'trades', []) || [];
    if (legacyTrades.length > 0) {
      list = mergeTradesIntoWatchlist(list, legacyTrades);
      saveData(username, 'watchlist', list);
      saveData(username, 'trades', []);
    }
    setWatchlist(list);
    const raw = loadData(username, 'strategies', []) || [];
    setStrategies(Array.isArray(raw) ? raw.map(migrateStrategy) : []);
  }, [username]);

  useEffect(() => {
    const execId = location.state?.executeStockId;
    const smartEntryId = location.state?.openSmartEntryId;
    const closeId = location.state?.closeTradeId;
    const tabFromState = location.state?.tab;
    if (tabFromState) setTab(tabFromState);
    if (execId && watchlist.length) {
      const stock = watchlist.find((s) => String(s.id) === String(execId));
      if (stock) setExecStock(stock);
      // Use React Router navigate to clear state — window.history.replaceState doesn't update location.state
      navigate(location.pathname, { replace: true, state: {} });
    }
    if (smartEntryId && watchlist.length) {
      const stock = watchlist.find((s) => String(s.id) === String(smartEntryId));
      if (stock) setSmartEntryStock(stock);
      navigate(location.pathname, { replace: true, state: {} });
    }
    if (closeId && watchlist.length) {
      const stock = watchlist.find((s) => String(s.id) === String(closeId));
      if (stock) setCloseTrade(stock);
      setTab('open');
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, watchlist]);

  const saveWatchlist = (next) => {
    setWatchlist(next);
    saveData(username, 'watchlist', next);
  };

  const updateWatchlistItem = (id, updates) => {
    const next = watchlist.map((s) => (s.id === id ? { ...s, ...updates } : s));
    saveWatchlist(next);
  };

  const watchingStocks = watchlist.filter((s) => s.status === STATUS.WATCHING);
  const readyStocks = watchlist.filter((s) => s.status === STATUS.READY);
  const openStocks = watchlist.filter((s) => s.status === STATUS.OPEN);
  const closedStocks = watchlist.filter((s) => s.status === STATUS.CLOSED);
  const { positions: livePositions, loading: liveLoading, lastUpdated: liveLastUpdated, error: liveError, refresh: refreshLive } = useLivePositions(openStocks, settings);
  const displayOpenStocks = livePositions.length > 0 ? livePositions : openStocks;

  const monthsWithTrades = (() => {
    const set = new Set();
    closedStocks.forEach((s) => {
      const d = s.close?.closeDate ?? s.trade?.closeDate;
      if (d) set.add(d.slice(0, 7));
    });
    const now = new Date();
    set.add(now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0'));
    return Array.from(set).sort().reverse();
  })();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  });

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-xl text-fg">قائمة المراقبة</h1>
          {tab === 'open' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={refreshLive}
                disabled={liveLoading}
                className="text-xs text-muted hover:text-gold transition-colors disabled:opacity-50"
                title="تحديث الأسعار"
              >
                {liveLoading ? '⟳ جارٍ...' : '⟳ تحديث'}
              </button>
              {liveLastUpdated && (
                <span className="text-xs text-muted">
                  آخر تحديث: {liveLastUpdated.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          className="px-4 py-2 rounded-lg bg-gold text-black font-bold text-sm hover:bg-gold/90"
        >
          + إضافة سهم
        </button>
      </header>

      <div className="p-6">
        {(tab === 'watching' || tab === 'ready') && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label className="text-muted text-sm">الاستراتيجية:</label>
            <select
              value={strategyFilterId}
              onChange={(e) => setStrategyFilterId(e.target.value)}
              className="bg-s2 border border-border rounded-lg px-3 py-1.5 text-fg text-sm"
            >
              <option value="">كل الاستراتيجيات</option>
              {strategies.map((s) => (
                <option key={s.id} value={String(s.id)}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-2 mb-6 border-b border-border pb-2">
          {[
            { key: 'watching', label: '👁 المراقبة' },
            { key: 'ready', label: '🎯 جاهز' },
            { key: 'open', label: '📈 مفتوحة' },
            { key: 'closed', label: '✅ مغلقة' },
            { key: 'monthly', label: 'شهري' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                tab === t.key ? 'bg-gold/20 text-gold border border-gold/50' : 'text-muted hover:text-fg border border-transparent'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {(tab === 'watching' || tab === 'ready') && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setStrategyFilterId('')}
              className={`px-3 py-1.5 rounded-lg text-sm ${!strategyFilterId ? 'bg-gold/20 text-gold border border-gold/50' : 'bg-s2 text-muted border border-border hover:text-fg'}`}
            >
              الكل
            </button>
            {strategies.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStrategyFilterId(String(s.id))}
                className={`px-3 py-1.5 rounded-lg text-sm ${strategyFilterId === String(s.id) ? 'bg-gold/20 text-gold border border-gold/50' : 'bg-s2 text-muted border border-border hover:text-fg'}`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        {(tab === 'watching' || tab === 'ready') && (() => {
          const list = tab === 'ready' ? readyStocks : watchingStocks;
          const filtered = list.filter((s) => {
            if (!strategyFilterId) return true;
            const ids = s.strategies || [];
            return ids.some((sid) => String(sid) === String(strategyFilterId));
          });
          return (
          <div className="space-y-4">
            {filtered.map((stock) =>
                tab === 'ready' ? (
                  <ReadyStockCard
                    key={stock.id}
                    stock={stock}
                    strategies={strategies}
                    portfolioSize={portfolioSize}
                    settings={settings}
                    onUpdate={(updates) => updateWatchlistItem(stock.id, updates)}
                    onRemove={() => {
                      if (window.confirm('حذف هذا السهم من القائمة؟')) {
                        saveWatchlist(watchlist.filter((w) => w.id !== stock.id));
                      }
                    }}
                    onEdit={() => setEditStock(stock)}
                    onExecute={() => setExecStock(stock)}
                    onEditPlan={() => setSmartEntryStock(stock)}
                    onNavigate={() => navigate('/stock/' + stock.id)}
                    onMoveToWatching={() => updateWatchlistItem(stock.id, { status: STATUS.WATCHING })}
                  />
                ) : (
                  <WatchingStockCard
                    key={stock.id}
                    stock={stock}
                    strategies={strategies}
                    onUpdate={(updates) => updateWatchlistItem(stock.id, updates)}
                    onRemove={() => {
                      if (window.confirm('حذف هذا السهم من القائمة؟')) {
                        saveWatchlist(watchlist.filter((w) => w.id !== stock.id));
                      }
                    }}
                    onEdit={() => setEditStock(stock)}
                    onOpenSmartEntry={() => setSmartEntryStock(stock)}
                    onNavigate={() => navigate('/stock/' + stock.id)}
                  />
                )
              )}
            {filtered.length === 0 && (
              <p className="text-muted text-center py-8">
                {watchlist.length === 0 ? 'لا توجد أسهم. أضف سهم من الزر أعلاه.' : 'لا توجد نتائج لهذا الفلتر.'}
              </p>
            )}
          </div>
          );
        })()}

        {tab === 'open' && (
          <div className="space-y-6">
            {liveError === 'backend_offline' && openStocks.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-right">
                <span className="text-red-400 text-sm">
                  ⚠️ الخادم غير متصل — شغّل:{' '}
                  <code className="mx-1 text-xs bg-[#0e1016] px-2 py-0.5 rounded font-mono">uvicorn main:app --reload --port 8000</code>
                </span>
              </div>
            )}
            {liveLoading && !liveError && openStocks.length > 0 && (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <div className="w-3 h-3 rounded-full bg-[#f0b429] animate-pulse" />
                جاري جلب الأسعار...
              </div>
            )}
            {liveLastUpdated && !liveLoading && openStocks.length > 0 && (
              <div className="flex items-center gap-2 text-gray-500 text-xs">
                <div className="w-2 h-2 rounded-full bg-teal-400" />
                محدّث: {liveLastUpdated.toLocaleTimeString('ar')}
                <button type="button" onClick={refreshLive} className="text-[#f0b429] hover:underline mr-2">
                  🔄 تحديث
                </button>
              </div>
            )}
            {displayOpenStocks.map((stock) => (
              <OpenTradeCard
                key={stock.id}
                stock={stock}
                strategies={strategies}
                portfolioSize={portfolioSize}
                maxPositionPct={(settings.maxPositionPct ?? 25) / 100}
                onUpdateStock={(updated) => {
                  const base = updated.live != null ? { ...updated, live: undefined, liveError: undefined } : updated;
                  const next = watchlist.map((s) => (s.id === stock.id ? base : s));
                  saveWatchlist(next);
                }}
                watchlist={watchlist}
                username={username}
                onCloseClick={() => setCloseTrade(stock)}
                onEdit={() => setEditTrade(stock)}
                onDelete={() => setDeleteTrade(stock)}
                liveLastUpdated={liveLastUpdated}
                onRefreshLive={refreshLive}
                onNavigate={() => navigate('/stock/' + stock.id)}
              />
            ))}
            {openStocks.length === 0 && (
              <p className="text-muted text-center py-8">لا توجد صفقات مفتوحة.</p>
            )}
          </div>
        )}

        {tab === 'closed' && (
          <div className="space-y-4">
            {closedStocks.length === 0 && (
              <p className="text-muted text-center py-8">لا توجد صفقات مغلقة.</p>
            )}
            {closedStocks.map((s) => {
              const t = s.trade || {};
              const c = s.close || {};
              const finalR = c.finalR ?? t.finalR ?? t.rMultiple;
              const closePrice = c.closePrice ?? t.closePrice;
              const closeDate = c.closeDate ?? t.closeDate;
              const grade = c.grade ?? t.grade;
              const pnlUSD = c.pnlUSD ?? t.pnlUSD;
              const exitReason = c.exitReason ?? t.exitReason;
              const EXIT_LABELS = {
                ema21_break: '📉 كسر EMA21', volume_sell: '📊 بيع مؤسسي',
                pct_from_peak: '🏔️ 10%- من القمة', earnings_guard: '📅 قبل الأرباح',
                stop_hit: '🛑 وقف الخسارة', target_reached: '🎯 وصل الهدف',
                manual: '✋ قرار يدوي', other: '📝 سبب آخر',
              };
              const rIsPos = (finalR ?? 0) >= 0;
              return (
              <div key={s.id} className="bg-s1 border border-border rounded-xl p-4">
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                    type="button"
                    onClick={() => navigate('/stock/' + s.id)}
                    className="font-mono text-gold hover:text-gold/80 hover:underline transition-colors"
                  >
                    {s.ticker}
                  </button>
                    <span className="text-muted">— {s.company}</span>
                    {grade && (
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded font-mono ${
                        grade === 'A' ? 'bg-teal/20 text-teal' :
                        grade === 'B' ? 'bg-gold/20 text-gold' :
                        grade === 'C' ? 'bg-gray-500/20 text-gray-400' :
                        'bg-red/20 text-red'
                      }`}>{grade}</span>
                    )}
                    <EditHistoryPopover editHistory={t.editHistory} />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-mono font-bold ${rIsPos ? 'text-teal' : 'text-red'}`}>
                      {finalR != null ? formatR(finalR) : '—'}
                    </span>
                    {pnlUSD != null && (
                      <span className={`text-sm font-mono ${pnlUSD >= 0 ? 'text-teal' : 'text-red'}`}>
                        {pnlUSD >= 0 ? '+' : ''}${Math.round(pnlUSD).toLocaleString()}
                      </span>
                    )}
                    <button type="button" onClick={() => setEditTrade(s)} className="px-2 py-1 rounded-lg border border-border text-sm hover:bg-s2 hover:border-gold/50">✏️ تعديل</button>
                    <button type="button" onClick={() => setDeleteTrade(s)} className="px-2 py-1 rounded-lg border border-red/50 text-red text-sm hover:bg-red/10">🗑 حذف</button>
                  </div>
                </div>
                <div className="text-muted text-sm mt-1 flex flex-wrap items-center gap-x-3 gap-y-1" dir="rtl">
                  <span>دخول: <span className="text-fg font-mono">${t.entryPrice}</span></span>
                  <span>خروج: <span className="text-fg font-mono">${closePrice}</span></span>
                  {exitReason && <span className="text-xs">{EXIT_LABELS[exitReason] ?? exitReason}</span>}
                  <span className="text-xs">{closeDate ? new Date(closeDate).toLocaleDateString('ar-SA') : ''}</span>
                </div>
              </div>
            );})}
          </div>
        )}

        {tab === 'monthly' && (
          <MonthlyView
            closedStocks={closedStocks}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            monthOptions={monthsWithTrades}
          />
        )}
      </div>

      <AddStockModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSave={(newStock) => {
          const item = migrateStock(newStock);
          saveWatchlist([...watchlist, item]);
          setAddModalOpen(false);
          showToast('تمت إضافة السهم للمراقبة');
          navigate('/stock/' + item.id);
        }}
      />

      {smartEntryStock && (
        <SmartEntryPanel
          open={!!smartEntryStock}
          stock={smartEntryStock}
          settings={settings}
          onClose={() => setSmartEntryStock(null)}
          onConfirm={(updatedStock) => {
            const next = watchlist.map((s) => (s.id === updatedStock.id ? updatedStock : s));
            saveWatchlist(next);
            setSmartEntryStock(null);
            setTab('ready');
            showToast(`✅ ${updatedStock.ticker} — جاهز للدخول`);
          }}
        />
      )}

      {editStock && (
        <EditStockModal
          stock={editStock}
          onClose={() => setEditStock(null)}
          onSave={(updated) => {
            const next = watchlist.map((s) => (s.id === editStock.id ? { ...s, ...updated, readinessScore: calcReadiness({ ...s, ...updated }) } : s));
            saveWatchlist(next);
            setEditStock(null);
            showToast('تم التحديث');
          }}
        />
      )}

      {execStock && (
        <ExecutionModal
          stock={execStock}
          strategies={strategies}
          settings={settings}
          onClose={() => setExecStock(null)}
          onConfirm={(updatedStock) => {
            const next = watchlist.map((s) => (s.id === updatedStock.id ? updatedStock : s));
            saveWatchlist(next);
            setExecStock(null);
            setTab('open');
            showToast(`✅ ${updatedStock.ticker} — الصفقة مفتوحة`);
          }}
        />
      )}

      {closeTrade && (
        <CloseTradeModal
          stock={closeTrade}
          onClose={() => setCloseTrade(null)}
          onConfirm={(closeData) => {
            if (closeData.isPartial) {
              // ── إغلاق جزئي: الصفقة تبقى مفتوحة ──
              const prevTrade      = closeTrade.trade || {};
              const prevRemaining  = getTradeRemainingShares(prevTrade);
              const newRemaining   = Math.max(0, prevRemaining - closeData.sharesExited);
              const partialEntry   = {
                date:       closeData.closeDate,
                shares:     closeData.sharesExited,
                price:      closeData.closePrice,
                atR:        closeData.finalR,
                pct:        prevRemaining > 0 ? (closeData.sharesExited / prevRemaining) * 100 : 0,
                exitReason: closeData.exitReason,
                grade:      closeData.grade,
              };
              const updated = {
                ...closeTrade,
                trade: {
                  ...prevTrade,
                  remainingShares: newRemaining,
                  partialExits: [...(prevTrade.partialExits || []), partialEntry],
                },
              };
              const next = watchlist.map((s) => (s.id === closeTrade.id ? updated : s));
              saveWatchlist(next);
              setCloseTrade(null);
              showToast(
                `✂️ ${closeTrade.ticker} — خروج جزئي ${closeData.sharesExited} سهم @ $${closeData.closePrice} | ${formatR(closeData.finalR)} | يتبقى ${newRemaining} سهم`
              );
            } else {
              // ── إغلاق كامل ──
              const updated = {
                ...closeTrade,
                status: STATUS.CLOSED,
                close: closeData,
              };
              const next = watchlist.map((s) => (s.id === closeTrade.id ? updated : s));
              saveWatchlist(next);
              setCloseTrade(null);
              showToast(`✅ ${closeTrade.ticker} أُغلقت | ${formatR(closeData.finalR)} | درجة ${closeData.grade}`);
            }
          }}
        />
      )}

      {editTrade && (
        <EditTradeModal
          trade={editTrade.trade || editTrade}
          stock={editTrade}
          username={username}
          onClose={() => setEditTrade(null)}
          onSave={(updatedTrade) => {
            const updated = { ...editTrade, trade: { ...(editTrade.trade || {}), ...updatedTrade } };
            const next = watchlist.map((s) => (s.id === editTrade.id ? updated : s));
            saveWatchlist(next);
            setEditTrade(null);
            showToast('✅ تم تعديل الصفقة — تم حفظ سجل التعديل');
            // تأخير بسيط حتى تتحدث React state + tradesRef قبل إعادة الجلب
            setTimeout(() => refreshLive(), 80);
          }}
        />
      )}

      {deleteTrade && (
        <DeleteTradeModal
          trade={deleteTrade.trade || deleteTrade}
          stock={deleteTrade}
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
    </div>
  );
}

/** Extract first line of plain text from a note value (string or Tiptap JSON doc) */
function extractNoteText(note) {
  if (!note) return '';
  if (typeof note === 'string') return note.split('\n')[0];
  if (typeof note === 'object' && note.type === 'doc' && Array.isArray(note.content)) {
    for (const block of note.content) {
      if (!block.content) continue;
      const text = block.content
        .filter((n) => n.type === 'text')
        .map((n) => n.text || '')
        .join('');
      if (text.trim()) return text;
    }
  }
  return '';
}

function getRRDisplay(rr, minRR) {
  if (minRR == null || minRR === undefined) return { className: 'text-gold', msg: null };
  if (rr < minRR) return { className: 'text-red', msg: `⚠️ أقل من الحد الأدنى للاستراتيجية (${minRR}:1)` };
  return { className: 'text-teal', msg: '✓ يلبي شرط الاستراتيجية' };
}

/** Phase 1 — watching: no prices, readiness + phase dots, جاهز للدخول opens SmartEntryPanel */
function WatchingStockCard({ stock, strategies, onUpdate, onRemove, onEdit, onOpenSmartEntry, onNavigate }) {
  const phases = stock.phases || DEFAULT_PHASES;
  const { readiness } = calcPhaseReadiness(phases);
  const trendDone = (phases.trend?.checks || []).filter(Boolean).length;
  const trendTotal = Math.max((phases.trend?.items || phases.trend?.checks || []).length, 1);
  const patternDone = (phases.pattern?.checks || []).filter(Boolean).length;
  const patternTotal = Math.max((phases.pattern?.items || phases.pattern?.checks || []).length, 1);
  const entryDone = (phases.entry?.checks || []).filter(Boolean).length;
  const entryTotal = Math.max((phases.entry?.items || phases.entry?.checks || []).length, 1);
  const linkedStrategies = (stock.strategies || []).map((sid) => strategies.find((s) => String(s.id) === String(sid))).filter(Boolean);
  const previewLine = extractNoteText(stock.notes?.chart) || extractNoteText(stock.notes?.daily) || extractNoteText(stock.notes?.financial) || '';
  const canMoveToReady = readiness >= 60;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => { if (!e.target.closest('button')) onNavigate?.(); }}
      onKeyDown={(e) => { if (e.key === 'Enter' && !e.target.closest('button')) onNavigate?.(); }}
      className="bg-s1 border border-border rounded-xl p-4 cursor-pointer hover:border-gold/40 transition-colors"
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onNavigate?.(); }}
            className="bg-gold/20 text-gold px-2 py-0.5 rounded font-mono text-sm hover:bg-gold/40 transition-colors"
          >
            {stock.ticker}
          </button>
          <span className="text-fg">{stock.company}</span>
          {stock.sentiment && (() => {
            const s = [
              { key: 'very_bullish', emoji: '🔥' },
              { key: 'bullish', emoji: '👍' },
              { key: 'neutral', emoji: '😐' },
              { key: 'cautious', emoji: '😟' },
              { key: 'bearish', emoji: '🚫' },
            ].find((x) => x.key === stock.sentiment);
            return s ? <span className="text-base" title={stock.sentiment}>{s.emoji}</span> : null;
          })()}
          {linkedStrategies.map((s) => (
            <span key={s.id} className="text-xs bg-s2 border border-border rounded px-1.5 py-0.5 text-muted">{s.name}</span>
          ))}
        </div>
        <div className="shrink-0 flex items-center gap-1">
          <svg width="36" height="36" className="rotate-[-90deg]">
            <circle cx="18" cy="18" r="14" fill="none" stroke="#1e2438" strokeWidth="3" />
            <circle cx="18" cy="18" r="14" fill="none" stroke={readiness >= 80 ? '#10b981' : readiness >= 50 ? '#f0b429' : '#ef4444'} strokeWidth="3" strokeDasharray={2 * Math.PI * 14} strokeDashoffset={2 * Math.PI * 14 * (1 - readiness / 100)} strokeLinecap="round" />
          </svg>
          <span className="text-xs font-mono text-fg w-6">{readiness}%</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2 text-xs">
        <span className={trendDone === trendTotal ? 'text-teal' : 'text-muted'}>[الاتجاه {trendDone}/{trendTotal} {trendDone === trendTotal ? '✓' : '⏳'}]</span>
        <span className={patternDone === patternTotal ? 'text-blue' : 'text-muted'}>[النموذج {patternDone}/{patternTotal} {patternDone === patternTotal ? '✓' : '⏳'}]</span>
        <span className={entryDone === entryTotal ? 'text-teal' : 'text-muted'}>[الدخول {entryDone}/{entryTotal} {entryDone === entryTotal ? '✓' : '⏳'}]</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-1 text-xs text-muted">
        {stock.addedDate && <span>أضيف: {new Date(stock.addedDate).toLocaleDateString('ar-SA')}</span>}
        {stock.discoveredFrom && <span>📍 {stock.discoveredFrom}</span>}
        {(stock.attachments?.length ?? 0) > 0 && <span>📎 {stock.attachments.length}</span>}
      </div>
      {previewLine && <div className="text-muted text-xs truncate max-w-full mb-2">{previewLine}</div>}
      <div className="flex gap-2 pt-2 border-t border-border" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onNavigate} className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-s2">تفاصيل</button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onOpenSmartEntry?.(); }} className="px-3 py-1.5 rounded-lg bg-gold text-black text-sm font-bold hover:bg-gold/90">جاهز للدخول 🎯</button>
      </div>
    </div>
  );
}

const RISK_PCT_OPTIONS = [0.5, 1, 1.5, 2];

function ReadyStockCard({ stock, strategies, portfolioSize, settings = {}, onUpdate, onRemove, onEdit, onEditPlan, onExecute, onNavigate, onMoveToWatching }) {
  const plan = stock.plan || defaultPlan();
  const pivot = (plan.pivot ?? stock.trigger) ?? 0;
  const stop = (plan.stop ?? stock.stop) ?? 0;
  // Normalize: SmartEntryPanel stores riskPct as a decimal fraction (e.g. 0.009),
  // but calcRiskAmount and the UI expect a percentage (e.g. 0.9).
  const riskPctRaw = plan.riskPct ?? settings?.defaultRiskPct ?? 1.5;
  const riskPct = typeof riskPctRaw === 'number' && riskPctRaw > 0 && riskPctRaw < 1
    ? riskPctRaw * 100
    : riskPctRaw;
  const riskPerShare = pivot > 0 && stop < pivot ? pivot - stop : 0;
  const riskAmount = calcRiskAmount(portfolioSize, riskPct);
  const shares = riskPerShare > 0 ? Math.floor(riskAmount / riskPerShare) : 0;
  const positionValue = shares * pivot;
  const positionPct = portfolioSize > 0 ? (positionValue / portfolioSize) * 100 : 0;
  const resistance = plan.resistance ?? null;
  const rrManual = plan.rrManual ?? plan.rr ?? null;
  const rr = resistance != null && resistance > pivot && riskPerShare > 0
    ? (resistance - pivot) / riskPerShare
    : (rrManual != null && rrManual > 0 ? rrManual : (resistance != null && resistance > pivot && riskPerShare > 0 ? (resistance - pivot) / riskPerShare : 0));
  const canExecute = pivot > 0 && stop > 0 && stop < pivot && rr >= 2;
  const linkedStrategies = (stock.strategies || []).map((sid) => strategies.find((s) => String(s.id) === String(sid))).filter(Boolean);
  const rrDisplay = rr >= 3 ? { className: 'text-teal', msg: '✓ ممتاز' } : rr >= 2 ? { className: 'text-gold', msg: '✓ مقبول — الحد الأدنى لمينيرفيني' } : { className: 'text-red', msg: '⚠️ ضعيف — مينيرفيني لا يدخل' };
  const phases = stock.phases || DEFAULT_PHASES;
  const entryItems = phases.entry?.items || [];
  const entryChecks = phases.entry?.checks || [];
  const entryAllDone = entryItems.length > 0 && entryChecks.every((c, i) => (entryChecks[i] ?? false));

  const updatePlan = (updates) => onUpdate({ plan: { ...plan, ...updates } });
  const toggleEntry = (i) => {
    const next = [...entryChecks];
    while (next.length <= i) next.push(false);
    next[i] = !next[i];
    onUpdate({ phases: { ...phases, entry: { ...(phases.entry || {}), label: phases.entry?.label || 'الدخول', items: entryItems, checks: next } } });
  };

  return (
    <div className={`rounded-xl p-5 border-2 transition-all ${entryAllDone ? 'bg-gold/10 border-gold shadow-lg shadow-gold/10' : 'bg-s1 border-border'}`}>
      {entryAllDone && (
        <div className="mb-3 py-2 px-3 rounded-lg bg-gold/20 text-gold font-medium text-center text-sm">⚡ جاهز للتنفيذ الآن</div>
      )}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onNavigate}
            className="bg-gold/20 text-gold px-2 py-0.5 rounded font-mono text-lg hover:bg-gold/40 transition-colors"
          >
            {stock.ticker}
          </button>
          <span className="text-fg font-medium">{stock.company}</span>
          {stock.sentiment && (() => {
            const s = [
              { key: 'very_bullish', emoji: '🔥' },
              { key: 'bullish', emoji: '👍' },
              { key: 'neutral', emoji: '😐' },
              { key: 'cautious', emoji: '😟' },
              { key: 'bearish', emoji: '🚫' },
            ].find((x) => x.key === stock.sentiment);
            return s ? <span className="text-base">{s.emoji}</span> : null;
          })()}
          {linkedStrategies.map((s) => (
            <span key={s.id} className="text-xs bg-s2 border border-border rounded px-1.5 py-0.5 text-muted">{s.name}</span>
          ))}
        </div>
        <button type="button" onClick={onNavigate} className="text-gold text-sm hover:underline">فتح التفاصيل ←</button>
      </div>
      <div className="space-y-3 mb-3">
        <div>
          <label className="text-muted text-xs block mb-1">نقطة الاختراق (Pivot)</label>
          <input type="number" step="0.01" value={pivot || ''} onChange={(e) => updatePlan({ pivot: parseFloat(e.target.value) || 0 })} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg font-mono" dir="ltr" placeholder="السعر الذي تنتظر كسره" />
        </div>
        <div>
          <label className="text-muted text-xs block mb-1">وقف الخسارة (Stop Loss)</label>
          <input type="number" step="0.01" value={stop || ''} onChange={(e) => updatePlan({ stop: parseFloat(e.target.value) || 0 })} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg font-mono" dir="ltr" placeholder="تحت آخر تضيق في النموذج" />
        </div>
        <div>
          <label className="text-muted text-xs block mb-1">تحديد R:R بـ: مقاومة $ أو R:R مباشرة</label>
          <div className="flex gap-2">
            <input type="number" step="0.01" value={resistance ?? ''} onChange={(e) => updatePlan({ resistance: e.target.value === '' ? null : parseFloat(e.target.value) })} className="flex-1 bg-s2 border border-border rounded-lg px-3 py-2 text-fg font-mono" dir="ltr" placeholder="مقاومة $" />
            <input type="number" step="0.1" value={rrManual ?? ''} onChange={(e) => updatePlan({ rrManual: e.target.value === '' ? null : parseFloat(e.target.value) })} className="w-24 bg-s2 border border-border rounded-lg px-3 py-2 text-fg font-mono" dir="ltr" placeholder="R:R :1" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3 bg-s2/50 rounded-lg mb-3 text-sm">
        <div><span className="text-muted text-xs">R:R المبدئي</span><div className={`font-mono font-medium ${rrDisplay.className}`}>{(rr || 0).toFixed(1)}:1 {rrDisplay.msg}</div></div>
        <div><span className="text-muted text-xs">المخاطرة</span><div className="font-mono">${riskAmount.toFixed(0)}</div></div>
        <div><span className="text-muted text-xs">نسبة المخاطرة</span><div className="font-mono">{(+riskPct).toFixed(2)}%</div></div>
        <div><span className="text-muted text-xs">الأسهم</span><div className="font-mono">{shares} سهم</div></div>
        <div className="col-span-2"><span className="text-muted text-xs">قيمة المركز</span><div className="font-mono">${positionValue.toFixed(0)} ({positionPct.toFixed(1)}%)</div></div>
      </div>
      <div className="flex flex-wrap gap-1 mb-2">
        {RISK_PCT_OPTIONS.map((p) => (
          <button key={p} type="button" onClick={() => updatePlan({ riskPct: p })} className={`px-2 py-1 rounded text-xs font-mono ${riskPct === p ? 'bg-gold text-black' : 'bg-s2 border border-border text-muted hover:text-fg'}`}>{p}%</button>
        ))}
      </div>
      {positionPct > 25 && positionPct > 0 && <div className="rounded-lg p-2 bg-amber-500/20 border border-amber-500/50 text-amber-200 text-xs mb-2">⚠️ المركز كبير — مينيرفيني يوصي بـ 25% كحد أقصى</div>}
      {rr < 2 && (pivot > 0 || stop > 0) && <div className="rounded-lg p-2 bg-red/20 border border-red/50 text-red text-xs mb-2">⚠️ R:R ضعيف — الحد الأدنى لمينيرفيني 2:1</div>}
      <div className="mb-3">
        <p className="text-muted text-xs mb-1">الدخول</p>
        <div className="flex flex-wrap gap-2">
          {entryItems.map((label, i) => (
            <label key={i} className="flex items-center gap-1 text-sm cursor-pointer">
              <input type="checkbox" checked={!!entryChecks[i]} onChange={() => toggleEntry(i)} className="rounded border-border" />
              <span className={entryChecks[i] ? 'text-teal' : 'text-muted'}>{label}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {onMoveToWatching && <button type="button" onClick={onMoveToWatching} className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-s2">← رجوع للمراقبة</button>}
        <button type="button" onClick={onNavigate} className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-s2">تفاصيل</button>
        {onEditPlan && <button type="button" onClick={onEditPlan} className="px-3 py-1.5 rounded-lg border border-border text-muted text-sm hover:bg-s2">← تعديل الخطة</button>}
        <button type="button" onClick={onEdit} className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-s2">تعديل السهم</button>
        <button type="button" onClick={onRemove} className="px-3 py-1.5 rounded-lg border border-red/50 text-red text-sm hover:bg-red/10">🗑</button>
        <button type="button" onClick={onExecute} disabled={!canExecute} className="px-4 py-2 rounded-lg bg-teal text-black font-bold hover:bg-teal/90 disabled:opacity-50 disabled:cursor-not-allowed">دخلت الصفقة 📈</button>
      </div>
    </div>
  );
}

function EditStockModal({ stock, onClose, onSave }) {
  const [form, setForm] = useState({
    ticker: stock.ticker || '',
    company: stock.company || '',
    setup: stock.setup || SETUP_OPTIONS[0],
    trigger: stock.trigger ?? '',
    stop: stock.stop ?? '',
    resistancePct: stock.resistancePct ?? 15,
    riskPct: stock.riskPct ?? 2,
    technicalNotes: stock.technicalNotes || '',
    epsGrowth: stock.epsGrowth ?? '',
    revenueGrowth: stock.revenueGrowth ?? '',
    entryNote: stock.entryNote || '',
    checks: { ...defaultChecks(), ...stock.checks },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      trigger: parseFloat(form.trigger) || 0,
      stop: parseFloat(form.stop) || 0,
      resistancePct: parseFloat(form.resistancePct) || 15,
      riskPct: parseFloat(form.riskPct) || 2,
      epsGrowth: form.epsGrowth === '' ? null : parseFloat(form.epsGrowth),
      revenueGrowth: form.revenueGrowth === '' ? null : parseFloat(form.revenueGrowth),
    });
  };

  return (
    <Modal open={!!stock} onClose={onClose} title="تعديل السهم" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-muted text-sm mb-1">الرمز</label>
            <input value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="ltr" />
          </div>
          <div>
            <label className="block text-muted text-sm mb-1">الشركة</label>
            <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="rtl" />
          </div>
        </div>
        <div>
          <label className="block text-muted text-sm mb-1">نوع الإعداد</label>
          <select value={form.setup} onChange={(e) => setForm({ ...form, setup: e.target.value })} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg">
            {SETUP_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div><label className="block text-muted text-sm mb-1">Trigger</label><input type="number" step="0.01" value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="ltr" /></div>
          <div><label className="block text-muted text-sm mb-1">Stop</label><input type="number" step="0.01" value={form.stop} onChange={(e) => setForm({ ...form, stop: e.target.value })} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="ltr" /></div>
          <div><label className="block text-muted text-sm mb-1">مسافة مقاومة %</label><input type="number" step="0.5" min="0" value={form.resistancePct} onChange={(e) => setForm({ ...form, resistancePct: e.target.value })} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="ltr" /></div>
        </div>
        <div><label className="block text-muted text-sm mb-1">المخاطرة %</label><input type="number" step="0.1" value={form.riskPct} onChange={(e) => setForm({ ...form, riskPct: e.target.value })} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="ltr" /></div>
        <div><label className="block text-muted text-sm mb-1">ملاحظات فنية</label><textarea value={form.technicalNotes} onChange={(e) => setForm({ ...form, technicalNotes: e.target.value })} rows={2} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="rtl" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="block text-muted text-sm mb-1">نمو EPS %</label><input type="number" step="0.1" value={form.epsGrowth} onChange={(e) => setForm({ ...form, epsGrowth: e.target.value })} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="ltr" /></div>
          <div><label className="block text-muted text-sm mb-1">نمو الإيرادات %</label><input type="number" step="0.1" value={form.revenueGrowth} onChange={(e) => setForm({ ...form, revenueGrowth: e.target.value })} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="ltr" /></div>
        </div>
        <div><label className="block text-muted text-sm mb-1">ملاحظة الدخول</label><textarea value={form.entryNote} onChange={(e) => setForm({ ...form, entryNote: e.target.value })} rows={2} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="rtl" /></div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-fg hover:bg-s2">إلغاء</button>
          <button type="submit" className="px-4 py-2 rounded-lg bg-gold text-black font-bold">حفظ</button>
        </div>
      </form>
    </Modal>
  );
}

function OpenTradeCard({ stock, strategies = [], portfolioSize = 0, maxPositionPct = 0.25, onUpdateStock, watchlist, username, onCloseClick, onEdit, onDelete, liveLastUpdated, onRefreshLive, onNavigate }) {
  const trade = stock.trade || {};
  const dailyNotes = trade.dailyNotes || [];
  const today = new Date().toISOString().slice(0, 10);
  const lastNote = dailyNotes[dailyNotes.length - 1];
  const isTodayNote = lastNote && lastNote.date?.slice(0, 10) === today;
  const [todayNote, setTodayNote] = useState(isTodayNote ? (lastNote?.text || '') : '');
  const [exitPlanCollapsed, setExitPlanCollapsed] = useState(true);
  const [pyramidModal, setPyramidModal] = useState(null);
  const [partialExitModal, setPartialExitModal] = useState(null);
  const [breakevenDismissed, setBreakevenDismissed] = useState(false);
  const [newStopInput, setNewStopInput] = useState('');
  const [stopHistoryCollapsed, setStopHistoryCollapsed] = useState(true);
  const [editingStop, setEditingStop] = useState(false);

  const updateTrade = (updates) => onUpdateStock({ ...stock, trade: { ...trade, ...updates } });

  const strategy = trade.strategyId != null ? strategies.find((s) => String(s.id) === String(trade.strategyId)) : strategies.find((s) => s.name === trade.strategy);
  const exitRules = strategy?.exitRules;
  const entry = parseFloat(trade.entryPrice) || 0;
  const stopPrice = parseFloat(trade.stopLoss ?? trade.currentStop) || 0;
  const riskMetrics = getTradeRiskMetrics({ ...trade, stopLoss: trade.stopLoss ?? trade.currentStop, originalStop: trade.originalStop ?? stock.plan?.stop }, portfolioSize);
  const { originalStop, currentStop, originalRisk, currentRisk, riskReduction, riskPctNow, lockedProfit, isProtected, stopRaised } = riskMetrics;
  const riskPerR = entry > 0 && (trade.originalStop ?? stopPrice) < entry ? entry - (trade.originalStop ?? stopPrice) : (entry - stopPrice) || 0;
  const currentR = typeof trade.currentR === 'number' ? trade.currentR : (typeof trade.rMultiple === 'number' ? trade.rMultiple : 0);
  const partialExitsList = exitRules?.partialExits?.filter((pe) => pe.enabled) || [];
  const behaviorExitsList = exitRules?.behaviorExits?.filter((be) => be.enabled) || [];
  const tradePartialExits = trade.partialExits || [];
  const behaviorExitsChecked = trade.behaviorExitsChecked || {};
  const pyramidEntries = trade.pyramidEntries || [];
  const stopHistory = trade.stopHistory || [];

  const initialShares = trade.shares ?? trade.sharesActual ?? 0;
  const add1Price = entry * 1.02;
  const add2Price = entry * 1.04;
  const addShares = Math.max(0, Math.floor(initialShares * 0.25));
  const totalShares = getTradeTotalShares(trade);
  const avgCost = getTradeAvgCost(trade);
  const remainingShares = getTradeRemainingShares(trade);
  const positionValue = getTradePositionValue(trade);
  const positionPct = portfolioSize > 0 ? (positionValue / portfolioSize) * 100 : 0;
  const canAdd1 = currentR >= 0 && pyramidEntries.length < 1;
  const canAdd2 = currentR >= 0 && pyramidEntries.length === 1;

  const saveDailyNote = () => {
    const text = todayNote.trim();
    if (!text) return;
    let nextNotes;
    if (isTodayNote) {
      nextNotes = dailyNotes.map((n) => (n.date?.slice(0, 10) === today ? { ...n, text } : n));
    } else {
      nextNotes = [...dailyNotes, { date: new Date().toISOString(), text }];
    }
    updateTrade({ dailyNotes: nextNotes });
  };

  const setPartialExitDone = (atR, pct, done) => {
    const next = done ? [...tradePartialExits, { date: new Date().toISOString(), pct, atR, price: entry + riskPerR * atR, shares: Math.floor((totalShares || initialShares) * (pct / 100)) }] : tradePartialExits.filter((x) => x.atR !== atR);
    updateTrade({ partialExits: next });
  };

  const savePartialExit = (atR, pct, price, shares) => {
    const next = [...tradePartialExits.filter((x) => x.atR !== atR), { date: new Date().toISOString(), pct, atR, price, shares }];
    // احسب remainingShares بعد البيع الجزئي
    const newSold = next.reduce((s, e) => s + (e.shares || 0), 0);
    const newRemaining = Math.max(0, totalShares - newSold);
    updateTrade({ partialExits: next, remainingShares: newRemaining });
    setPartialExitModal(null);
  };

  const savePyramidAdd = (addIndex, price, shares, note) => {
    const entryItem = { date: new Date().toISOString(), price, shares, note: note || '' };
    const nextPyramid = [...pyramidEntries, entryItem];
    // احسب remainingShares الجديد بعد الإضافة
    const newTotal = initialShares + nextPyramid.reduce((s, e) => s + (e.shares || 0), 0);
    const sold = tradePartialExits.reduce((s, e) => s + (e.shares || 0), 0);
    const newRemaining = Math.max(0, newTotal - sold);
    updateTrade({ pyramidEntries: nextPyramid, remainingShares: newRemaining });
    setPyramidModal(null);
  };

  const moveStopToBreakeven = () => {
    const from = parseFloat(trade.stopLoss ?? trade.currentStop) || 0;
    updateTrade({
      stopLoss: entry,
      currentStop: entry,
      stopHistory: [...stopHistory, { date: new Date().toISOString(), from, to: entry, reason: 'breakeven' }],
    });
    setBreakevenDismissed(true);
  };

  const updateStopTrailing = (newStop, reason) => {
    const from = parseFloat(trade.stopLoss ?? trade.currentStop) || 0;
    if (newStop <= from) return;
    updateTrade({
      stopLoss: newStop,
      currentStop: newStop,
      stopHistory: [...stopHistory, { date: new Date().toISOString(), from, to: newStop, reason: reason || 'trailing' }],
    });
    setNewStopInput('');
    setEditingStop(false);
  };

  const setBehaviorExitChecked = (id, checked) => {
    updateTrade({ behaviorExitsChecked: { ...behaviorExitsChecked, [id]: checked } });
  };

  const rBarTicks = [0, 1, 2, 3, 5];
  const maxR = Math.max(5, ...partialExitsList.map((pe) => pe.atR), 1);

  const entryDateStr = trade.entryDate ? new Date(trade.entryDate).toLocaleDateString('ar-SA') : '—';
  const entryDateObj = trade.entryDate ? new Date(trade.entryDate) : null;
  const daysSinceEntry = entryDateObj ? Math.max(0, Math.floor((Date.now() - entryDateObj.getTime()) / 86400000)) : 0;
  const riskPerShareForPnL = entry - (trade.originalStop ?? stock.plan?.stop ?? originalStop) || 0;
  const unrealizedPnL = riskPerShareForPnL > 0 ? currentR * riskPerShareForPnL * remainingShares : 0;
  const unrealizedPnLPct = positionValue > 0 ? unrealizedPnL / positionValue : 0;
  const originalRiskPct = portfolioSize > 0 ? originalRisk / portfolioSize : 0;
  const currentRiskPct = portfolioSize > 0 ? currentRisk / portfolioSize : 0;
  const handleRaiseStop = () => {
    const v = parseFloat(newStopInput);
    if (!Number.isNaN(v) && v > currentStop) updateStopTrailing(v);
  };
  const pastNotes = dailyNotes.filter((n) => n.date?.slice(0, 10) !== today).map((n) => ({ text: n.text, date: n.date ? new Date(n.date).toLocaleDateString('ar-SA') : '' }));
  const displayR = stock.live ? stock.live.currentR : currentR;
  const displayPnL = stock.live ? stock.live.unrealizedPnL : unrealizedPnL;
  const displayPnLPct = stock.live ? stock.live.unrealizedPnLPct : unrealizedPnLPct;

  return (
    <div className="open-trade-card bg-s1 border border-[#1e2438] rounded-xl overflow-hidden" dir="rtl">
      {/* ═══ HEADER BAR ═══ */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2438]">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={onNavigate}
            className="text-2xl font-bold text-white font-mono hover:text-gold transition-colors"
            title="فتح بطاقة السهم"
          >
            {stock.ticker}
          </button>
          <span className="px-2 py-1 rounded-full text-xs bg-teal-500/20 text-teal-400 border border-teal-500/30">مفتوحة</span>
          <span className="text-xs text-gray-500">
            دخول: {entryDateStr} · {daysSinceEntry} يوم
          </span>
          <EditHistoryPopover editHistory={trade.editHistory} />
        </div>
        <div className="flex gap-2">
          {onEdit && (
            <button type="button" onClick={onEdit} className="text-xs px-3 py-1.5 rounded border border-[#1e2438] text-gray-400 hover:text-white hover:border-gray-500">
              ✏️ تعديل
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} className="text-xs px-3 py-1.5 rounded border border-[#1e2438] text-gray-400 hover:text-white">🗑 حذف</button>
          )}
          <button type="button" onClick={onCloseClick} className="text-xs px-3 py-1.5 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10">
            إغلاق الصفقة
          </button>
        </div>
      </div>

      {/* ── LIVE PRICE BANNER ── */}
      {stock.live && (
        <div className={`flex flex-wrap items-center justify-between gap-4 px-6 py-3 border-b border-[#1e2438] ${stock.live.changePct >= 0 ? 'bg-teal-500/5' : 'bg-red-500/5'}`} dir="rtl">
          <div className="flex items-center gap-4 text-right">
            <div>
              <p className="text-xs text-gray-500">السعر الحالي</p>
              <p className="text-2xl font-bold text-white font-mono">${Number(stock.live.currentPrice).toFixed(2)}</p>
            </div>
            <div className={stock.live.changePct >= 0 ? 'text-teal-400' : 'text-red-400'}>
              <p className="text-xs text-gray-500">التغير اليوم</p>
              <p className="text-lg font-bold font-mono">{stock.live.changePct >= 0 ? '+' : ''}{Number(stock.live.changePct).toFixed(2)}%</p>
            </div>
          </div>
          <div className="flex-1 min-w-[200px] max-w-md mx-4">
            <RProgressBar currentR={stock.live.currentR} entry={trade.entryPrice} stop={trade.currentStop ?? stock.plan?.stop} />
          </div>
          <div className="text-left">
            <p className="text-xs text-gray-500">ربح/خسارة غير محقق</p>
            <p className={`text-2xl font-bold font-mono ${stock.live.unrealizedPnL >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
              {stock.live.unrealizedPnL >= 0 ? '+' : ''}${Math.abs(stock.live.unrealizedPnL ?? 0).toLocaleString()}
            </p>
            <p className={`text-xs ${(stock.live.unrealizedPnLPct ?? 0) >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
              {(stock.live.unrealizedPnLPct ?? 0) >= 0 ? '+' : ''}{((stock.live.unrealizedPnLPct ?? 0) * 100).toFixed(2)}%
            </p>
          </div>
        </div>
      )}

      {/* ── SMART HINTS ── */}
      {stock.live?.hints?.length > 0 && (
        <div className="px-6 py-3 space-y-2 border-b border-[#1e2438]">
          {stock.live.hints.map((hint, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 p-3 rounded-lg text-right ${
                hint.type === 'danger' ? 'bg-red-500/10 border border-red-500/20' :
                hint.type === 'warning' ? 'bg-yellow-500/10 border border-yellow-500/20' :
                hint.type === 'success' ? 'bg-teal-500/10 border border-teal-500/20' :
                'bg-blue-500/10 border border-blue-500/20'
              }`}
            >
              <div className="flex-1">
                <p className={`text-sm font-semibold ${
                  hint.type === 'danger' ? 'text-red-400' :
                  hint.type === 'warning' ? 'text-yellow-400' :
                  hint.type === 'success' ? 'text-teal-400' : 'text-blue-400'
                }`}>
                  {hint.icon} {hint.message}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{hint.action}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ SECTION 1: KEY METRICS (4 cards) ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-b border-[#1e2438]">
        <div className="p-5 border-l border-[#1e2438] text-right">
          <p className="text-xs text-gray-500 mb-1">سعر الدخول</p>
          <p className="text-2xl font-bold text-[#f0b429] font-mono">${Number(entry).toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-1">{remainingShares.toLocaleString()} سهم</p>
        </div>
        <div className="p-5 border-l border-[#1e2438] text-right">
          <p className="text-xs text-gray-500 mb-1">وقف الخسارة</p>
          <p className="text-2xl font-bold text-[#ef476f] font-mono">${Number(currentStop).toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">
            أصلي: ${Number(originalStop).toFixed(2)}
            {currentStop > originalStop && <span className="text-teal-400 mr-1">↑ محرّك</span>}
          </p>
        </div>
        <div className="p-5 border-l border-[#1e2438] text-right">
          <p className="text-xs text-gray-500 mb-1">R الحالي</p>
          <p className={`text-2xl font-bold font-mono ${displayR >= 2 ? 'text-[#06d6a0]' : displayR >= 0 ? 'text-[#f0b429]' : 'text-[#ef476f]'}`}>
            {displayR >= 0 ? '+' : ''}{Number(displayR).toFixed(2)}R
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {displayR >= 2 ? '✅ ارفع الوقف لنقطة التعادل' : displayR >= 0 ? '⏳ قيد التطور' : '⚠️ تحت الضغط'}
          </p>
        </div>
        <div className="p-5 text-right">
          <p className="text-xs text-gray-500 mb-1">الربح / الخسارة</p>
          <p className={`text-2xl font-bold font-mono ${displayPnL >= 0 ? 'text-[#06d6a0]' : 'text-[#ef476f]'}`}>
            {displayPnL >= 0 ? '+' : ''}${Math.abs(displayPnL ?? 0).toLocaleString()}
          </p>
          <p className={`text-xs mt-1 ${(displayPnLPct ?? 0) >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
            {(displayPnLPct ?? 0) >= 0 ? '+' : ''}{((displayPnLPct ?? 0) * 100).toFixed(2)}%
          </p>
        </div>
      </div>

      {/* ═══ SECTION 1b: POSITION SUMMARY ═══ */}
      {(() => {
        // مستوى التعرض: ربع / نصف / كامل بالنسبة لـ maxPositionPct
        const maxPct = (maxPositionPct || 0.25) * 100;
        const ratio  = maxPct > 0 ? positionPct / maxPct : 0;
        const sizeLabel =
          ratio >= 0.80 ? { label: 'كامل',  color: 'text-teal-400',   bg: 'bg-teal-500/15 border-teal-500/30' }
          : ratio >= 0.40 ? { label: 'نصف',   color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/30' }
          : ratio >= 0.15 ? { label: 'ربع',   color: 'text-orange-400', bg: 'bg-orange-500/15 border-orange-500/30' }
          :                  { label: 'رمزي',  color: 'text-gray-400',   bg: 'bg-gray-500/10  border-gray-500/20'  };
        const pnlPctDisplay = (displayPnLPct ?? 0) * 100;
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-b border-[#1e2438]">
            {/* 1 - الأسهم */}
            <div className="p-4 border-l border-[#1e2438] text-right">
              <p className="text-xs text-gray-500 mb-1">الأسهم المتبقية</p>
              <p className="text-xl font-bold text-white font-mono">{remainingShares.toLocaleString()}</p>
              {totalShares !== remainingShares && (
                <p className="text-xs text-gray-400 mt-0.5">الكلي: {totalShares.toLocaleString()}</p>
              )}
            </div>
            {/* 2 - حجم المركز */}
            <div className="p-4 border-l border-[#1e2438] text-right">
              <p className="text-xs text-gray-500 mb-1">حجم المركز</p>
              <p className="text-xl font-bold text-white font-mono">
                ${positionValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{positionPct.toFixed(1)}% من المحفظة</p>
            </div>
            {/* 3 - مستوى التعرض */}
            <div className="p-4 border-l border-[#1e2438] text-right">
              <p className="text-xs text-gray-500 mb-1">مستوى التعرض</p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold border ${sizeLabel.bg} ${sizeLabel.color}`}>
                {sizeLabel.label}
              </span>
              <p className="text-xs text-gray-400 mt-1">{positionPct.toFixed(1)}% / {maxPct.toFixed(0)}% حد أقصى</p>
            </div>
            {/* 4 - نسبة العائد % */}
            <div className="p-4 text-right">
              <p className="text-xs text-gray-500 mb-1">العائد من التكلفة</p>
              <p className={`text-xl font-bold font-mono ${pnlPctDisplay >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                {pnlPctDisplay >= 0 ? '+' : ''}{pnlPctDisplay.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                avg cost ${getTradeAvgCost(trade).toFixed(2)}
              </p>
            </div>
          </div>
        );
      })()}

      {/* R progress bar + milestone alerts */}
      <div className="px-6 py-4 border-b border-[#1e2438] bg-[#0e1016]">
        <div className="flex justify-between text-xs text-gray-500 mb-1 font-mono">
          <span>-1R</span>
          <span>0</span>
          <span>+1R</span>
          <span>+2R</span>
          <span>+3R</span>
          <span>+5R</span>
        </div>
        <div className="h-3 bg-s2 rounded-full overflow-hidden relative">
          <div
            className="absolute inset-y-0 right-0 bg-gradient-to-l from-teal-500/80 to-gold/60 transition-all duration-300 rounded-full"
            style={{
              width: `${Math.min(100, Math.max(0, ((displayR + 1) / 6) * 100))}%`,
            }}
          />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/80 rounded-full"
            style={{
              right: `${Math.min(100, Math.max(0, ((displayR + 1) / 6) * 100))}%`,
              transform: 'translateX(50%)',
            }}
          />
        </div>
        <p className="text-xs text-center mt-1 text-gray-400 font-mono">
          ↑ الآن: {displayR >= 0 ? '+' : ''}{Number(displayR).toFixed(2)}R
        </p>
        {displayR >= 3 && (
          <p className="text-xs text-teal mt-2 text-center">🔥 أداء استثنائي — ثبّت جزءاً من الأرباح؟</p>
        )}
        {displayR >= 2 && displayR < 3 && stopPrice < entry && (
          <p className="text-xs text-teal mt-2 text-center">✅ الوقف يجب أن يكون فوق سعر الدخول الآن</p>
        )}
        {displayR >= 1 && displayR < 2 && (
          <p className="text-xs text-gold mt-2 text-center">💡 فكر في رفع الوقف إلى نقطة التعادل</p>
        )}
        {displayR > -0.5 && displayR < 0 && (
          <p className="text-xs text-amber-400 mt-2 text-center">⏳ قريب من التعادل</p>
        )}
        {displayR <= -0.5 && (
          <p className="text-xs text-red-400 mt-2 text-center">⚠️ اقترب من الوقف — راجع الصفقة</p>
        )}
      </div>

      {/* Breakeven CTA */}
      {displayR >= 2 && stopPrice < entry && !breakevenDismissed && (
        <div className="px-6 py-3 border-b border-[#1e2438] bg-[#f0b429]/10 border-l-4 border-l-[#f0b429]">
          <p className="text-sm font-medium text-[#f0b429] mb-2">📌 السهم وصل +2R — هل تريد نقل الـ Stop لنقطة التعادل؟</p>
          <div className="flex gap-2">
            <button type="button" onClick={moveStopToBreakeven} className="px-3 py-1.5 rounded bg-[#f0b429] text-black font-medium text-xs">نعم، حرّك Stop إلى ${entry.toFixed(2)}</button>
            <button type="button" onClick={() => setBreakevenDismissed(true)} className="px-3 py-1.5 rounded border border-[#1e2438] text-gray-500 text-xs">لاحقاً</button>
          </div>
        </div>
      )}

      {/* ═══ SECTION 2: RISK MANAGEMENT ═══ */}
      <div className="p-5 border-b border-[#1e2438]">
        <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
          <span>🛡️</span> إدارة المخاطر
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="bg-[#0e1016] border border-[#252d40] rounded-lg p-4 text-right">
            <p className="text-xs text-gray-400 mb-1">المخاطرة الأصلية</p>
            <p className="text-lg font-bold text-[#ef476f] font-mono">${originalRisk.toLocaleString()}</p>
            <p className="text-xs text-gray-400">{(originalRiskPct * 100).toFixed(1)}% من المحفظة</p>
          </div>
          <div className="bg-[#0e1016] border border-[#252d40] rounded-lg p-4 text-right">
            <p className="text-xs text-gray-400 mb-1">المخاطرة الحالية</p>
            <p className={`text-lg font-bold font-mono ${currentStop >= entry ? 'text-[#06d6a0]' : 'text-[#f0b429]'}`}>
              {currentStop >= entry ? 'صفر — محمي ✅' : `$${currentRisk.toLocaleString()}`}
            </p>
            <p className="text-xs text-gray-400">
              {currentStop >= entry ? 'الوقف فوق سعر الدخول' : `${(currentRiskPct * 100).toFixed(1)}% من المحفظة`}
            </p>
          </div>
          <div className="bg-[#0e1016] border border-[#252d40] rounded-lg p-4 text-right">
            <p className="text-xs text-gray-400 mb-1">حجم المركز</p>
            <p className="text-lg font-bold text-white font-mono">${positionValue.toLocaleString()}</p>
            <p className="text-xs text-gray-400">{positionPct.toFixed(1)}% من المحفظة</p>
          </div>
        </div>

        <div className="bg-[#0e1016] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <button type="button" onClick={handleRaiseStop} className="text-sm px-4 py-2 bg-[#1a1f2e] border border-[#1e2438] rounded-lg text-white hover:border-teal-500/50 transition-colors">
              ↑ تطبيق
            </button>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.01"
                value={newStopInput}
                onChange={(e) => setNewStopInput(e.target.value)}
                className="w-28 bg-[#141720] border border-[#1e2438] rounded-lg px-3 py-2 text-white text-sm font-mono text-right focus:border-teal-500/50 outline-none"
                placeholder={String(Number(currentStop).toFixed(2))}
                dir="ltr"
              />
              <span className="text-sm text-gray-400">رفع الـ Stop إلى</span>
            </div>
          </div>
          {newStopInput && parseFloat(newStopInput) < currentStop && (
            <div className="mt-2 text-right space-y-1">
              <p className="text-xs text-red-400">⚠️ لا يمكن خفض الوقف — مينيرفيني: الوقف يرتفع فقط</p>
              <p className="text-xs text-gray-500">
                لتصحيح خطأ في الإدخال، استخدم زر{' '}
                <span className="text-[#f0b429]">✏️ تعديل</span>
                {' '}أعلى البطاقة
              </p>
            </div>
          )}
          {newStopInput && parseFloat(newStopInput) >= entry && (
            <p className="text-xs text-teal-400 text-right mt-2">✅ ستحوّل الصفقة لـ &quot;محمية&quot; — لا مخاطرة</p>
          )}
          {stopHistory.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#1e2438]">
              <p className="text-xs text-gray-500 mb-2 text-right">تاريخ تحريك الوقف:</p>
              <div className="flex gap-2 flex-wrap justify-end">
                {[...stopHistory].reverse().map((s, i) => (
                  <span key={i} className="text-xs bg-[#141720] border border-[#252d40] px-2 py-1 rounded text-gray-300 font-mono">
                    ${Number(s.to ?? s.from).toFixed(2)} · {s.date ? new Date(s.date).toLocaleDateString('ar-SA') : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ PYRAMIDING (existing logic, new style) ═══ */}
      <div className="p-5 border-b border-[#1e2438]">
        <h3 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
          <span>🔺</span> هرم المركز (Pyramiding)
        </h3>
        <p className="text-xs text-gray-500 mb-2">الحالي: <span className="font-mono text-white">{totalShares} سهم</span> @ متوسط <span className="font-mono text-[#f0b429]">${avgCost.toFixed(2)}</span></p>
        <div className="flex flex-wrap gap-4">
          <div className={`bg-[#0e1016] rounded-lg p-4 ${canAdd1 ? '' : 'opacity-60'}`}>
            <p className="text-xs text-gray-500 mb-1">إضافة 1</p>
            <p className="text-sm font-mono text-white mb-2">أضف {addShares} سهم @ ${add1Price.toFixed(2)}+</p>
            <button type="button" disabled={!canAdd1} onClick={() => setPyramidModal({ addIndex: 1, suggestedPrice: add1Price, suggestedShares: addShares })} className="px-3 py-1.5 rounded bg-[#f0b429]/20 text-[#f0b429] text-xs disabled:opacity-50">تسجيل إضافة</button>
          </div>
          <div className={`bg-[#0e1016] rounded-lg p-4 ${canAdd2 ? '' : 'opacity-60'}`}>
            <p className="text-xs text-gray-500 mb-1">إضافة 2</p>
            <p className="text-sm font-mono text-white mb-2">أضف {addShares} سهم @ ${add2Price.toFixed(2)}+</p>
            <button type="button" disabled={!canAdd2} onClick={() => setPyramidModal({ addIndex: 2, suggestedPrice: add2Price, suggestedShares: addShares })} className="px-3 py-1.5 rounded bg-[#f0b429]/20 text-[#f0b429] text-xs disabled:opacity-50">تسجيل إضافة</button>
          </div>
        </div>
      </div>

      {/* Exit plan (collapsible) */}
      {strategy && exitRules && (
        <div className="border-b border-[#1e2438]">
          <button type="button" onClick={() => setExitPlanCollapsed(!exitPlanCollapsed)} className="w-full px-6 py-3 flex items-center justify-between bg-[#0e1016] text-right text-xs font-semibold text-gray-400 hover:bg-[#141720]">
            <span>📋 خطة الخروج</span>
            <span>{exitPlanCollapsed ? '▾' : '▴'}</span>
          </button>
          {!exitPlanCollapsed && (
            <div className="p-5 bg-s1 text-sm space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-gray-500">R حالي:</span>
                <span className="font-mono font-medium text-teal">{formatR(currentR)}</span>
              </div>
              <div className="relative pt-2 pb-6">
                <div className="h-2 rounded-full overflow-hidden bg-s2 flex" style={{ maxWidth: '100%' }}>
                  {rBarTicks.slice(0, -1).map((r, i) => (
                    <div key={r} className="flex-1 min-w-0 flex items-center justify-center relative" style={{ width: `${((rBarTicks[i + 1] - r) / maxR) * 100}%` }}>
                      <div className={`h-full flex-1 ${currentR >= rBarTicks[i + 1] ? 'bg-teal/80' : currentR >= r ? 'bg-gold/60' : 'bg-s2'}`} />
                    </div>
                  ))}
                  <div className="flex-1 min-w-0 bg-s2" style={{ width: `${((maxR - 5) / maxR) * 100}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  {rBarTicks.map((r) => (
                    <span key={r}>{r === 0 ? '0R' : `+${r}R`}</span>
                  ))}
                </div>
                <div className="mt-3">
                  <p className="text-xs font-semibold text-gray-400 mb-2">🎯 أهداف الخروج الجزئي</p>
                  {partialExitsList.map((pe) => {
                    const isDone = tradePartialExits.some((x) => x.atR === pe.atR);
                    const exitPrice = entry + riskPerR * pe.atR;
                    const exitShares = Math.floor((totalShares || initialShares) * (pe.pct / 100));
                    return (
                      <div key={pe.id} className="flex flex-wrap items-center gap-2 py-1.5 border-b border-[#1e2438]/50 last:border-0">
                        <span className="text-xs text-gray-500">خروج {pe.pct}% عند +{pe.atR}R = ${exitPrice.toFixed(2)} = {exitShares} سهم</span>
                        {isDone ? <span className="text-teal text-xs">تم ✓</span> : (
                          <button type="button" onClick={() => setPartialExitModal({ atR: pe.atR, pct: pe.pct, suggestedPrice: exitPrice, suggestedShares: exitShares })} className="px-2 py-0.5 rounded bg-teal/20 text-teal text-xs">تم البيع</button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {behaviorExitsList.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-red-400/90 mb-2">راقب للخروج الكامل:</p>
                    <ul className="space-y-1">
                      {behaviorExitsList.map((be) => (
                        <li key={be.id}>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={!!behaviorExitsChecked[be.id]} onChange={(e) => setBehaviorExitChecked(be.id, e.target.checked)} className="rounded" />
                            <span className={`text-xs ${behaviorExitsChecked[be.id] ? 'text-red-400' : 'text-gray-500'}`}>{be.text}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ SECTION 4: DAILY NOTES ═══ */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <button type="button" onClick={saveDailyNote} className="text-xs px-3 py-1.5 bg-[#f0b429] text-black rounded font-semibold hover:bg-[#f0b429]/90">
            💾 حفظ ملاحظة اليوم
          </button>
          <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <span>📝</span> ملاحظات يومية
          </h3>
        </div>
        <textarea
          value={todayNote}
          onChange={(e) => setTodayNote(e.target.value)}
          onBlur={saveDailyNote}
          placeholder="ملاحظة اليوم..."
          className="w-full bg-[#0e1016] border border-[#1e2438] rounded-lg p-3 text-sm text-gray-300 placeholder-gray-600 resize-none focus:border-[#f0b429]/50 outline-none text-right"
          rows={3}
          dir="rtl"
        />
        {pastNotes.length > 0 && (
          <div className="mt-3 space-y-2">
            {pastNotes.slice(-3).reverse().map((note, i) => (
              <div key={i} className="flex gap-3 text-right">
                <div className="flex-1 bg-[#0e1016] rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-300">{note.text}</p>
                </div>
                <span className="text-xs text-gray-500 pt-2 whitespace-nowrap">{note.date}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── ملاحظة الدخول (من تعديل الصفقة) ── */}
        {trade.entryNote && (
          <div className="mt-3 pt-3 border-t border-[#1e2438]">
            <p className="text-xs font-semibold text-gray-400 mb-1 text-right">📌 ملاحظة الدخول</p>
            <div className="bg-[#0e1016] rounded-lg px-3 py-2">
              <p className="text-xs text-gray-300 text-right whitespace-pre-wrap">{trade.entryNote}</p>
            </div>
          </div>
        )}

        {/* ── ملاحظات ما قبل الدخول (من صفحة التفاصيل) ── */}
        {(() => {
          const researchNote = extractNoteText(stock.notes?.chart) || extractNoteText(stock.notes?.financial);
          if (!researchNote) return null;
          return (
            <div className="mt-3 pt-3 border-t border-[#1e2438]">
              <p className="text-xs font-semibold text-gray-400 mb-1 text-right">🔍 ملاحظات البحث</p>
              <div className="bg-[#0e1016] rounded-lg px-3 py-2">
                <p className="text-xs text-gray-300 text-right truncate">{researchNote}</p>
              </div>
            </div>
          );
        })()}
      </div>

      {pyramidModal && (
        <PyramidAddModal
          suggestedPrice={pyramidModal.suggestedPrice}
          suggestedShares={pyramidModal.suggestedShares}
          currentTotalShares={totalShares}
          portfolioSize={portfolioSize}
          maxPositionPct={maxPositionPct}
          onClose={() => setPyramidModal(null)}
          onConfirm={(price, shares, note) => savePyramidAdd(pyramidModal.addIndex, price, shares, note)}
        />
      )}
      {partialExitModal && (
        <PartialExitModal
          atR={partialExitModal.atR}
          pct={partialExitModal.pct}
          suggestedPrice={partialExitModal.suggestedPrice}
          suggestedShares={partialExitModal.suggestedShares}
          onClose={() => setPartialExitModal(null)}
          onConfirm={(price, shares) => savePartialExit(partialExitModal.atR, partialExitModal.pct, price, shares)}
        />
      )}
    </div>
  );
}

function PyramidAddModal({ suggestedPrice, suggestedShares, currentTotalShares = 0, portfolioSize = 0, maxPositionPct = 0.25, onClose, onConfirm }) {
  const [price, setPrice] = useState(suggestedPrice?.toFixed(2) ?? '');
  const [shares, setShares] = useState(String(suggestedShares ?? 0));
  const [note, setNote] = useState('');

  const priceNum = parseFloat(price) || 0;
  const sharesNum = parseInt(shares, 10) || 0;
  const newTotalShares = currentTotalShares + sharesNum;
  const newPositionValue = newTotalShares * priceNum;
  const newPositionPct = portfolioSize > 0 && priceNum > 0 ? newPositionValue / portfolioSize : 0;
  const overLimit = newPositionPct > maxPositionPct;

  const handleSubmit = (e) => {
    e.preventDefault();
    const p = parseFloat(price);
    const s = parseInt(shares, 10);
    if (p > 0 && s > 0) onConfirm(p, s, note);
  };
  return (
    <Modal open onClose={onClose} title="تسجيل إضافة للمركز" size="sm">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-muted text-sm mb-1">سعر الإضافة</label>
          <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full bg-s2 border border-border rounded px-2 py-1.5 font-mono" dir="ltr" required />
        </div>
        <div>
          <label className="block text-muted text-sm mb-1">عدد الأسهم</label>
          <input type="number" min="1" value={shares} onChange={(e) => setShares(e.target.value)} className="w-full bg-s2 border border-border rounded px-2 py-1.5 font-mono" dir="ltr" required />
          {sharesNum > 0 && priceNum > 0 && portfolioSize > 0 && (
            <p className={`text-xs mt-1 text-right ${overLimit ? 'text-red-400' : 'text-teal-400'}`}>
              {overLimit
                ? `⚠️ المركز الجديد ${(newPositionPct * 100).toFixed(1)}% — يتجاوز الحد الأقصى ${(maxPositionPct * 100).toFixed(0)}%`
                : `✅ المركز الجديد ${(newPositionPct * 100).toFixed(1)}% من المحفظة`}
            </p>
          )}
        </div>
        <div>
          <label className="block text-muted text-sm mb-1">ملاحظة (اختياري)</label>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="w-full bg-s2 border border-border rounded px-2 py-1.5" dir="rtl" />
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded border border-border text-sm">إلغاء</button>
          <button type="submit" className="px-3 py-1.5 rounded bg-gold text-black font-medium text-sm">حفظ</button>
        </div>
      </form>
    </Modal>
  );
}

function PartialExitModal({ atR, pct, suggestedPrice, suggestedShares, onClose, onConfirm }) {
  const [price, setPrice] = useState(suggestedPrice?.toFixed(2) ?? '');
  const [shares, setShares] = useState(String(suggestedShares ?? 0));
  const handleSubmit = (e) => {
    e.preventDefault();
    const p = parseFloat(price);
    const s = parseInt(shares, 10);
    if (p > 0 && s > 0) onConfirm(p, s);
  };
  return (
    <Modal open onClose={onClose} title={`تم البيع — خروج ${pct}% عند +${atR}R`} size="sm">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-muted text-sm mb-1">سعر البيع الفعلي</label>
          <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full bg-s2 border border-border rounded px-2 py-1.5 font-mono" dir="ltr" required />
        </div>
        <div>
          <label className="block text-muted text-sm mb-1">الأسهم المباعة</label>
          <input type="number" min="1" value={shares} onChange={(e) => setShares(e.target.value)} className="w-full bg-s2 border border-border rounded px-2 py-1.5 font-mono" dir="ltr" required />
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded border border-border text-sm">إلغاء</button>
          <button type="submit" className="px-3 py-1.5 rounded bg-teal text-white font-medium text-sm">حفظ</button>
        </div>
      </form>
    </Modal>
  );
}

const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

function formatMonthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_NAMES_AR[m - 1]} ${y}`;
}

function MonthlyView({ closedStocks, selectedMonth, onMonthChange, monthOptions }) {
  const closeDate = (s) => s.close?.closeDate ?? s.trade?.closeDate;
  const monthTrades = (closedStocks || []).filter(
    (s) => closeDate(s) && closeDate(s).startsWith(selectedMonth + '-')
  );

  const totalTrades = monthTrades.length;
  const getR = (s) => s.close?.finalR ?? s.trade?.finalR ?? s.trade?.rMultiple ?? 0;
  const wins = monthTrades.filter((s) => getR(s) > 0).length;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const avgR =
    totalTrades > 0
      ? monthTrades.reduce((sum, s) => sum + getR(s), 0) / totalTrades
      : null;
  const best = monthTrades.length
    ? monthTrades.reduce((a, b) => (getR(a) > getR(b) ? a : b))
    : null;
  const worst = monthTrades.length
    ? monthTrades.reduce((a, b) => (getR(a) < getR(b) ? a : b))
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <label className="text-muted text-sm">الشهر:</label>
        <select
          value={selectedMonth}
          onChange={(e) => onMonthChange(e.target.value)}
          className="bg-s2 border border-border rounded-lg px-4 py-2 text-fg font-medium min-w-[180px]"
        >
          {monthOptions.map((ym) => (
            <option key={ym} value={ym}>
              {formatMonthLabel(ym)}
            </option>
          ))}
        </select>
      </div>

      {monthTrades.length === 0 ? (
        <p className="text-muted text-center py-12 rounded-xl bg-s1 border border-border">
          لا توجد صفقات في هذا الشهر
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="bg-s1 border border-border rounded-xl p-4">
              <div className="text-muted text-sm mb-1">عدد الصفقات</div>
              <div className="font-display text-xl text-gold font-mono">{totalTrades}</div>
            </div>
            <div className="bg-s1 border border-border rounded-xl p-4">
              <div className="text-muted text-sm mb-1">نسبة الفوز</div>
              <div className="font-display text-xl text-gold font-mono">{winRate.toFixed(1)}%</div>
            </div>
            <div className="bg-s1 border border-border rounded-xl p-4">
              <div className="text-muted text-sm mb-1">متوسط R</div>
              <div className="font-display text-xl text-gold font-mono">
                {avgR != null ? formatR(avgR) : '—'}
              </div>
            </div>
            <div className="bg-s1 border border-border rounded-xl p-4">
              <div className="text-muted text-sm mb-1">أفضل صفقة</div>
              <div className="font-display text-lg text-teal font-mono">
                {best ? `${best.ticker} ${formatR(getR(best))}` : '—'}
              </div>
            </div>
            <div className="bg-s1 border border-border rounded-xl p-4">
              <div className="text-muted text-sm mb-1">أسوأ صفقة</div>
              <div className="font-display text-lg text-red font-mono">
                {worst ? `${worst.ticker} ${getR(worst).toFixed(2)}R` : '—'}
              </div>
            </div>
          </div>

          <div className="bg-s1 border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-display text-gold text-lg">صفقات الشهر</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted text-right border-b border-border">
                    <th className="px-5 py-3 font-medium">الرمز</th>
                    <th className="px-5 py-3 font-medium">تاريخ الدخول</th>
                    <th className="px-5 py-3 font-medium">تاريخ الخروج</th>
                    <th className="px-5 py-3 font-medium">R</th>
                    <th className="px-5 py-3 font-medium">الدرجة</th>
                  </tr>
                </thead>
                <tbody>
                  {monthTrades.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-border/50 hover:bg-s2/50 transition-colors text-right"
                    >
                      <td className="px-5 py-3 font-mono text-gold">{s.ticker}</td>
                      <td className="px-5 py-3 text-muted">
                        {s.trade?.entryDate ? new Date(s.trade.entryDate).toLocaleDateString('ar-SA') : '—'}
                      </td>
                      <td className="px-5 py-3 text-muted">
                        {closeDate(s) ? new Date(closeDate(s)).toLocaleDateString('ar-SA') : '—'}
                      </td>
                      <td
                        className={`px-5 py-3 font-mono ${
                          getR(s) >= 0 ? 'text-teal' : 'text-red'
                        }`}
                      >
                        {getR(s) != null ? `${getR(s).toFixed(2)}R` : '—'}
                      </td>
                      <td className="px-5 py-3 font-mono">{s.close?.grade ?? s.trade?.grade ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

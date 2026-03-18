import { useState, useEffect, useMemo } from 'react';
import { loadData, saveData, loadWatchlist } from '../utils/storage';
import { defaultSettings } from '../utils/portfolioUtils';
import { calcSystemMetrics } from '../utils/rEngine';
import { formatR } from '../utils/calculations';
import { useToast } from '../components/ui/Toast';
import Modal from '../components/ui/Modal';
import EditTradeModal from '../components/trades/EditTradeModal';
import DeleteTradeModal from '../components/trades/DeleteTradeModal';
import EditHistoryPopover from '../components/trades/EditHistoryPopover';

const R_BUCKETS = [
  { label: '-3R', min: -Infinity, max: -3 },
  { label: '-2R', min: -3, max: -2 },
  { label: '-1R', min: -2, max: -1 },
  { label: '0', min: -1, max: 0 },
  { label: '+1R', min: 0, max: 1 },
  { label: '+2R', min: 1, max: 2 },
  { label: '+3R', min: 2, max: 3 },
  { label: '+4R', min: 3, max: 4 },
  { label: '+5R+', min: 4, max: Infinity },
];

function getRJudgment(r) {
  if (r == null) return { label: '—', color: 'text-muted', icon: '' };
  if (r > 3) return { label: 'استثنائي', color: 'text-teal font-bold', icon: '🔥' };
  if (r >= 1) return { label: 'جيد', color: 'text-teal', icon: '✅' };
  if (r >= 0) return { label: 'مقبول', color: 'text-gold', icon: '🟡' };
  return { label: 'خسارة', color: 'text-red', icon: '❌' };
}

export default function Stats({ user }) {
  const username = user?.username || '';
  const settings = username
    ? loadData(username, 'settings', defaultSettings()) || defaultSettings()
    : defaultSettings();
  const portfolioSize = settings.portfolioSize ?? user?.portfolioSize ?? 0;
  const maxRiskPct = (settings.defaultRiskPct ?? 1.5) / 100;
  const { showToast } = useToast();
  const [watchlist, setWatchlist] = useState([]);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [deletedTrades, setDeletedTrades] = useState([]);
  const [deletedSectionOpen, setDeletedSectionOpen] = useState(false);
  const [restoreReason, setRestoreReason] = useState('');
  const [restoringId, setRestoringId] = useState(null);
  const [editTrade, setEditTrade] = useState(null);
  const [deleteTrade, setDeleteTrade] = useState(null);

  const [simWinRate, setSimWinRate] = useState(50);
  const [simAvgWinR, setSimAvgWinR] = useState(2.5);
  const [simAvgLossR, setSimAvgLossR] = useState(1);
  const [simTradesPerYear, setSimTradesPerYear] = useState(60);

  useEffect(() => {
    if (!username) return;
    setWatchlist(loadWatchlist(username) || []);
    setDeletedTrades(loadData(username, 'deleted_trades', []));
  }, [username]);

  const closedStocks = watchlist.filter((s) => s.status === 'closed');
  const metrics = useMemo(
    () => calcSystemMetrics(closedStocks),
    [closedStocks]
  );

  const last30 = useMemo(() => {
    const sorted = [...closedStocks].sort(
      (a, b) =>
        new Date(b.close?.closeDate ?? 0) - new Date(a.close?.closeDate ?? 0)
    );
    return sorted.slice(0, 30);
  }, [closedStocks]);

  const distribution = useMemo(() => {
    if (!metrics?.rMultiples?.length) return [];
    return R_BUCKETS.map((b) => ({
      ...b,
      count: metrics.rMultiples.filter(
        (r) => r >= b.min && r < b.max
      ).length,
    }));
  }, [metrics]);

  const maxDistCount = Math.max(1, ...distribution.map((d) => d.count));

  const simExpectancy =
    (simWinRate / 100) * simAvgWinR +
    (1 - simWinRate / 100) * -simAvgLossR;
  const simAnnualR = simExpectancy * simTradesPerYear;
  const simPf =
    simAvgLossR > 0
      ? ((simWinRate / 100) * simAvgWinR) /
        ((1 - simWinRate / 100) * simAvgLossR)
      : 0;
  const simBreakevenWR = (1 / (1 + simAvgWinR / simAvgLossR)) * 100;
  const simAnnualPct = maxRiskPct * simAnnualR * 100;
  const simPortfolio100k = 100000 * (simAnnualPct / 100);

  const handleRestore = (dt) => {
    const { deletedAt, deleteReason, ...rest } = dt;
    const stock = {
      id: rest.id,
      ticker: rest.ticker,
      company: rest.company,
      status: 'closed',
      plan: { pivot: rest.entryPrice, stop: rest.stopLoss, riskPct: 1.5 },
      trade: { ...rest, closeDate: rest.closeDate, finalR: rest.rMultiple },
      close: {
        closePrice: rest.closePrice,
        closeDate: rest.closeDate,
        closeReason: rest.closeReason ?? null,
        finalR: rest.rMultiple,
        grade: rest.grade ?? null,
        notes: rest.closeNote ?? '',
      },
    };
    const next = [...watchlist, stock];
    setWatchlist(next);
    saveData(username, 'watchlist', next);
    setDeletedTrades(deletedTrades.filter((d) => d.id !== dt.id));
    saveData(username, 'deleted_trades', deletedTrades.filter((d) => d.id !== dt.id));
    setRestoringId(null);
    setRestoreReason('');
    showToast('✅ تم استعادة الصفقة');
  };

  return (
    <div className="min-h-screen p-6" dir="rtl">
      <header className="mb-6">
        <h1 className="font-display text-2xl text-gold">◎ الإحصائيات — أداء R</h1>
        <p className="text-muted text-sm mt-1">مقاييس النظام بناءً على R-Multiples</p>
      </header>

      {/* ═══ SECTION A: SYSTEM SCORECARD ═══ */}
      {metrics ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="lg:col-span-2 bg-s1 border border-border rounded-xl p-5">
            <p className="text-xs text-gray-500 mb-1">التوقع الرياضي (Expectancy)</p>
            <p className={`text-2xl font-bold font-mono ${metrics.expectancy >= 0 ? 'text-teal' : 'text-red'}`}>
              {formatR(metrics.expectancy)}
            </p>
            <p className="text-xs text-gray-500 mt-1">كم R تكسب في المتوسط لكل صفقة</p>
          </div>
          <div className="bg-s1 border border-border rounded-xl p-5">
            <p className="text-xs text-gray-500 mb-1">عامل الربح</p>
            <p className={`text-2xl font-bold font-mono ${
              metrics.profitFactor >= 1.5 ? 'text-teal' : metrics.profitFactor >= 1 ? 'text-gold' : 'text-red'
            }`}>
              {metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-1">&gt; 1.5 = جيد | &gt; 2.0 = ممتاز</p>
          </div>
          <div className="bg-s1 border border-border rounded-xl p-5">
            <p className="text-xs text-gray-500 mb-1">جودة النظام (SQN)</p>
            <p className="text-2xl font-bold font-mono text-fg">{metrics.sqn.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">{metrics.sqnLabel}</p>
          </div>
          <div className="bg-s1 border border-border rounded-xl p-5">
            <p className="text-xs text-gray-500 mb-1">نسبة الفوز</p>
            <p className="text-2xl font-bold font-mono text-fg">{(metrics.winRate * 100).toFixed(1)}%</p>
            <p className="text-xs text-gray-500 mt-1">تعادل عند {(metrics.breakevenAt2R * 100).toFixed(0)}% (لـ 2R)</p>
          </div>
          <div className="bg-s1 border border-border rounded-xl p-5">
            <p className="text-xs text-gray-500 mb-1">متوسط الربح</p>
            <p className="text-2xl font-bold font-mono text-teal">{formatR(metrics.avgWinR)}</p>
            <p className="text-xs text-gray-500 mt-1">مقابل خسارة {formatR(metrics.avgLossR)}</p>
          </div>
          <div className="bg-s1 border border-border rounded-xl p-5">
            <p className="text-xs text-gray-500 mb-1">نسبة الكسب/الخسارة</p>
            <p className="text-2xl font-bold font-mono text-fg">{metrics.payoffRatio.toFixed(2)}:1</p>
            <p className="text-xs text-gray-500 mt-1">ربح مقابل كل وحدة خسارة</p>
          </div>
        </div>
      ) : (
        <div className="bg-s1 border border-border rounded-xl p-8 mb-8 text-center text-muted">
          <p>لا توجد صفقات مغلقة بعد — أغلِق صفقات لرؤية مقاييس النظام.</p>
        </div>
      )}

      {/* ═══ SECTION B: R DISTRIBUTION + CUMULATIVE CURVE ═══ */}
      {metrics && metrics.rMultiples?.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-s1 border border-border rounded-xl p-5">
            <h3 className="text-gold font-medium mb-4">توزيع الصفقات بوحدة R</h3>
            <div className="space-y-2">
              {distribution.map((b) => (
                <div key={b.label} className="flex items-center gap-3">
                  <span className="w-12 text-xs text-muted font-mono">{b.label}</span>
                  <div className="flex-1 h-6 bg-s2 rounded overflow-hidden">
                    <div
                      className={`h-full rounded transition-all ${
                        b.min < 0 ? 'bg-red-500/80' : 'bg-teal-500/80'
                      }`}
                      style={{ width: `${(b.count / maxDistCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-xs font-mono text-fg">{b.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-s1 border border-border rounded-xl p-5">
            <h3 className="text-gold font-medium mb-4">منحنى الأداء التراكمي (R)</h3>
            {metrics.cumulativeR?.length > 0 ? (
              <div className="h-48 flex items-end gap-0.5">
                {metrics.cumulativeR.map((r, i) => {
                  const minR = Math.min(0, ...metrics.cumulativeR);
                  const maxR = Math.max(0, ...metrics.cumulativeR);
                  const range = maxR - minR || 1;
                  const pct = ((r - minR) / range) * 100;
                  return (
                    <div
                      key={i}
                      className="flex-1 min-w-0 bg-teal-500/70 rounded-t transition-all hover:bg-teal-400"
                      style={{ height: `${pct}%`, minHeight: r >= 0 ? '2px' : '0' }}
                      title={formatR(r)}
                    />
                  );
                })}
              </div>
            ) : (
              <p className="text-muted text-sm py-8 text-center">لا بيانات</p>
            )}
          </div>
        </div>
      )}

      {/* ═══ SECTION C: PERFORMANCE TABLE + ANNUAL PROJECTION ═══ */}
      <div className="bg-s1 border border-border rounded-xl overflow-hidden mb-8">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-gold font-medium">آخر 30 صفقة</h3>
        </div>
        {last30.length === 0 ? (
          <div className="p-6 text-muted text-center">لا توجد صفقات مغلقة</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted text-right border-b border-border">
                  <th className="px-4 py-2 font-medium">#</th>
                  <th className="px-4 py-2 font-medium">التاريخ</th>
                  <th className="px-4 py-2 font-medium">الرمز</th>
                  <th className="px-4 py-2 font-medium">دخول</th>
                  <th className="px-4 py-2 font-medium">خروج</th>
                  <th className="px-4 py-2 font-medium">R الفعلي</th>
                  <th className="px-4 py-2 font-medium">الحكم</th>
                  <th className="px-4 py-2 font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {last30.map((s, idx) => {
                  const t = s.trade || {};
                  const c = s.close || {};
                  const finalR = c.finalR ?? t.finalR ?? t.rMultiple;
                  const entry = t.entryPrice ?? 0;
                  const exit = c.closePrice ?? t.closePrice ?? 0;
                  const j = getRJudgment(finalR);
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-border/50 hover:bg-s2/50 text-right"
                    >
                      <td className="px-4 py-2 text-muted">{idx + 1}</td>
                      <td className="px-4 py-2 text-muted">
                        {c.closeDate ? new Date(c.closeDate).toLocaleDateString('ar-SA') : '—'}
                      </td>
                      <td className="px-4 py-2 font-mono text-gold cursor-pointer" onClick={() => setSelectedTrade({ ...s, entryPrice: entry, closePrice: exit, rMultiple: finalR, closeReason: c.closeReason, grade: c.grade, closeNote: c.notes, company: s.company })}>
                        {s.ticker}
                      </td>
                      <td className="px-4 py-2 font-mono">${Number(entry).toFixed(2)}</td>
                      <td className="px-4 py-2 font-mono">${Number(exit).toFixed(2)}</td>
                      <td className={`px-4 py-2 font-mono font-medium ${j.color}`}>
                        {finalR != null ? `${formatR(finalR)} ${j.icon}` : '—'}
                      </td>
                      <td className={`px-4 py-2 ${j.color}`}>{j.label}</td>
                      <td className="px-4 py-2">
                        <EditHistoryPopover editHistory={t.editHistory} />
                        <button
                        type="button"
                        onClick={() =>
                          setEditTrade({
                            _stock: s,
                            id: s.id,
                            ticker: s.ticker,
                            company: s.company,
                            status: s.status,
                            entryPrice: s.trade?.entryPrice,
                            entryDate: s.trade?.entryDate,
                            stopLoss: s.trade?.currentStop ?? s.plan?.stop,
                            closePrice: s.close?.closePrice,
                            closeDate: s.close?.closeDate,
                            closeReason: s.close?.closeReason,
                            grade: s.close?.grade,
                            closeNote: s.close?.notes,
                            rMultiple: s.close?.finalR,
                            ...s.trade,
                            ...s.close,
                          })
                        }
                        className="mr-1 px-2 py-0.5 rounded border border-border text-xs hover:bg-s2"
                      >
                        ✏️
                      </button>
                        <button type="button" onClick={() => setDeleteTrade({ ...s, entryDate: s.trade?.entryDate, rMultiple: s.close?.finalR ?? s.trade?.rMultiple })} className="px-2 py-0.5 rounded border border-red/50 text-red text-xs hover:bg-red/10">🗑</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {metrics && (
          <div className="p-5 border-t border-border bg-s2/30">
            <h4 className="text-gold font-medium mb-2">التوقّع السنوي</h4>
            <p className="text-sm text-fg">
              بناءً على {metrics.n} صفقة، توقعك السنوي: <span className="font-mono font-bold text-teal">{formatR(metrics.annualRProjection)}</span> سنوياً
              {portfolioSize > 0 && (
                <> = <span className="font-mono font-bold text-teal">{(metrics.annualRProjection * maxRiskPct * 100).toFixed(1)}%</span> عائد سنوي تقريبي</>
              )}
            </p>
            <p className="text-xs text-muted mt-1">
              إذا استمررت بنفس الأداء مع ~{metrics.tradesPerYear.toFixed(0)} صفقة/سنة
            </p>
          </div>
        )}
      </div>

      {/* ═══ SECTION D: WHAT-IF SIMULATOR ═══ */}
      <div className="bg-s1 border border-border rounded-xl p-6 mb-8">
        <h3 className="text-gold font-medium mb-4">محاكي الأداء — ماذا لو؟</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div>
            <label className="block text-xs text-gray-500 mb-1">نسبة الفوز %</label>
            <input type="range" min="20" max="80" value={simWinRate} onChange={(e) => setSimWinRate(Number(e.target.value))} className="w-full" />
            <span className="text-sm font-mono text-fg">{simWinRate}%</span>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">متوسط ربح (R)</label>
            <input type="range" min="1" max="6" step="0.25" value={simAvgWinR} onChange={(e) => setSimAvgWinR(Number(e.target.value))} className="w-full" />
            <span className="text-sm font-mono text-fg">{simAvgWinR}R</span>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">متوسط خسارة (R)</label>
            <input type="range" min="0.5" max="2" step="0.1" value={simAvgLossR} onChange={(e) => setSimAvgLossR(Number(e.target.value))} className="w-full" />
            <span className="text-sm font-mono text-fg">{simAvgLossR}R</span>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">صفقات/سنة</label>
            <input type="range" min="20" max="200" value={simTradesPerYear} onChange={(e) => setSimTradesPerYear(Number(e.target.value))} className="w-full" />
            <span className="text-sm font-mono text-fg">{simTradesPerYear}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-s2 rounded-lg">
          <div>
            <p className="text-xs text-gray-500">التوقع</p>
            <p className={`font-mono font-bold ${simExpectancy >= 0 ? 'text-teal' : 'text-red'}`}>{formatR(simExpectancy)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">العائد السنوي تقريبي</p>
            <p className="font-mono font-bold text-fg">{simAnnualPct.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">عامل الربح</p>
            <p className="font-mono font-bold text-fg">{simPf.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">نسبة فوز التعادل</p>
            <p className="font-mono font-bold text-fg">{simBreakevenWR.toFixed(0)}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">بمحفظة $100,000</p>
            <p className="font-mono font-bold text-teal">${simPortfolio100k.toLocaleString(undefined, { maximumFractionDigits: 0 })} سنوياً</p>
          </div>
        </div>
      </div>

      {/* Deleted section + modals (unchanged) */}
      <div className="bg-s1 border border-border rounded-xl overflow-hidden mb-6">
        <button type="button" onClick={() => setDeletedSectionOpen((o) => !o)} className="w-full px-6 py-4 flex items-center justify-between text-right hover:bg-s2/50 transition-colors">
          <h3 className="text-gold font-medium">🗑 سجل المحذوفات</h3>
          <span className="text-muted text-sm">{deletedSectionOpen ? '▼' : '◀'}</span>
        </button>
        {deletedSectionOpen && (
          <div className="px-6 pb-6">
            {deletedTrades.length === 0 ? (
              <p className="text-muted text-center py-6">لا توجد صفقات محذوفة</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted text-right border-b border-border">
                      <th className="px-4 py-2 font-medium">السهم</th>
                      <th className="px-4 py-2 font-medium">تاريخ الدخول</th>
                      <th className="px-4 py-2 font-medium">R-Multiple</th>
                      <th className="px-4 py-2 font-medium">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deletedTrades.map((dt) => (
                      <tr key={dt.id} className="border-b border-border/50 text-right">
                        <td className="px-4 py-2 font-mono text-gold">{dt.ticker}</td>
                        <td className="px-4 py-2 text-muted">{dt.entryDate ? new Date(dt.entryDate).toLocaleDateString('ar-SA') : '—'}</td>
                        <td className={`px-4 py-2 font-mono ${dt.rMultiple != null && dt.rMultiple >= 0 ? 'text-teal' : 'text-red'}`}>{formatR(dt.rMultiple)}</td>
                        <td className="px-4 py-2">
                          {restoringId === dt.id ? (
                            <div className="flex gap-1 justify-end">
                              <button type="button" onClick={() => setRestoringId(null)} className="px-2 py-0.5 rounded border border-border text-xs">إلغاء</button>
                              <button type="button" onClick={() => handleRestore(dt)} className="px-2 py-0.5 rounded bg-teal/20 text-teal text-xs font-medium">تأكيد</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => setRestoringId(dt.id)} className="px-2 py-1 rounded bg-teal/20 text-teal text-xs hover:bg-teal/30">↩️ استعادة</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {editTrade && (
        <EditTradeModal
          trade={editTrade}
          username={username}
          onClose={() => setEditTrade(null)}
          onSave={(updated) => {
            const stock = editTrade._stock || editTrade;
            const next = watchlist.map((s) => {
              if (s.id !== stock.id) return s;
              return {
                ...s,
                ticker: updated.ticker ?? s.ticker,
                company: updated.company ?? s.company,
                trade: {
                  ...(s.trade || {}),
                  entryPrice: updated.entryPrice,
                  entryDate: updated.entryDate,
                  stopLoss: updated.stopLoss,
                  currentStop: updated.stopLoss,
                  closePrice: updated.closePrice,
                  closeDate: updated.closeDate,
                  closeReason: updated.closeReason,
                  closeNote: updated.closeNote,
                  grade: updated.grade,
                  finalR: updated.rMultiple,
                  rMultiple: updated.rMultiple,
                },
                close: {
                  ...(s.close || {}),
                  closePrice: updated.closePrice,
                  closeDate: updated.closeDate,
                  closeReason: updated.closeReason,
                  notes: updated.closeNote ?? '',
                  grade: updated.grade,
                  finalR: updated.rMultiple,
                },
              };
            });
            setWatchlist(next);
            saveData(username, 'watchlist', next);
            setEditTrade(null);
            showToast('✅ تم تعديل الصفقة');
          }}
        />
      )}
      {deleteTrade && (
        <DeleteTradeModal
          trade={deleteTrade}
          onClose={() => setDeleteTrade(null)}
          onConfirm={(reason) => {
            const t = deleteTrade.trade || {};
            const c = deleteTrade.close || {};
            const deleted = {
              id: deleteTrade.id,
              ticker: deleteTrade.ticker,
              company: deleteTrade.company,
              ...t,
              closePrice: c.closePrice ?? t.closePrice,
              closeDate: c.closeDate ?? t.closeDate,
              closeReason: c.closeReason ?? t.closeReason,
              closeNote: c.notes ?? t.closeNote,
              rMultiple: c.finalR ?? t.finalR ?? t.rMultiple,
              grade: c.grade ?? t.grade,
              deletedAt: new Date().toISOString(),
              deleteReason: reason,
            };
            const deletedList = loadData(username, 'deleted_trades', []);
            saveData(username, 'deleted_trades', [...deletedList, deleted]);
            const next = watchlist.filter((s) => s.id !== deleteTrade.id);
            setWatchlist(next);
            saveData(username, 'watchlist', next);
            setDeletedTrades([...deletedList, deleted]);
            setDeleteTrade(null);
            showToast('🗑 تم حذف الصفقة');
          }}
        />
      )}

      <Modal open={!!selectedTrade} onClose={() => setSelectedTrade(null)} title={selectedTrade ? `صفقة ${selectedTrade.ticker}` : ''} size="md">
        {selectedTrade && (
          <div className="space-y-2 text-sm text-right">
            <p><span className="text-muted">الشركة:</span> {selectedTrade.company}</p>
            <p><span className="text-muted">دخول:</span> {selectedTrade.entryPrice} — <span className="text-muted">خروج:</span> {selectedTrade.closePrice}</p>
            <p><span className="text-muted">R:</span> <span className={selectedTrade.rMultiple >= 0 ? 'text-teal' : 'text-red'}>{formatR(selectedTrade.rMultiple)}</span></p>
            <p><span className="text-muted">الدرجة:</span> {selectedTrade.grade ?? '—'}</p>
            <p><span className="text-muted">سبب الخروج:</span> {selectedTrade.closeReason ?? '—'}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

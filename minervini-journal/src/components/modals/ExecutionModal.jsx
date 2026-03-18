import { useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import { calcSlippage } from '../../utils/stockCalcs';
import { calcPosition } from '../../utils/rEngine';
import { buildChecklistFromStrategy } from '../../utils/strategyChecklist';

function StrategyPreCheck({ strategies = [], stock }) {
  const linked = useMemo(
    () => (stock?.strategies || []).map((sid) => strategies.find((s) => String(s.id) === String(sid))).filter(Boolean),
    [stock?.strategies, strategies]
  );

  // Only initialise checks for entry items
  const [checks, setChecks] = useState(() => {
    const result = {};
    linked.forEach((strategy) => {
      const cl = buildChecklistFromStrategy(strategy, stock?.phases);
      const items = cl.entry?.items || [];
      result[strategy.id] = items.map(() => false);
    });
    return result;
  });

  const [open, setOpen] = useState(linked.length > 0);

  if (linked.length === 0) return null;

  const allChecked = linked.every((strategy) => {
    const cl = buildChecklistFromStrategy(strategy, stock?.phases);
    const total = cl.entry?.items?.length ?? 0;
    if (total === 0) return true;
    const done = (checks[strategy.id] || []).filter(Boolean).length;
    return done >= total;
  });

  return (
    <div className="bg-s2 border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold ${allChecked ? 'text-teal' : 'text-gold'}`}
      >
        <span>{open ? '▼' : '▶'} شروط الدخول</span>
        <span className="text-xs font-mono">{allChecked ? '✅ جاهز للدخول' : '⏳ لم تكتمل'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-4">
          {linked.map((strategy) => {
            const cl = buildChecklistFromStrategy(strategy, stock?.phases);
            const entryItems = cl.entry?.items || [];
            const stratChecks = checks[strategy.id] || [];
            const doneCount = stratChecks.filter(Boolean).length;

            if (entryItems.length === 0) {
              return (
                <div key={strategy.id}>
                  <p className="text-xs text-muted">{strategy.name}: لا توجد شروط دخول محددة في هذه الاستراتيجية</p>
                </div>
              );
            }

            return (
              <div key={strategy.id}>
                <p className="text-xs mb-2 flex justify-between">
                  <span className="font-semibold text-fg">{strategy.name}</span>
                  <span className="text-muted">{doneCount}/{entryItems.length}</span>
                </p>
                <ul className="space-y-1.5">
                  {entryItems.map((item, i) => (
                    <label key={i} className="flex items-start gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={!!stratChecks[i]}
                        onChange={() =>
                          setChecks((prev) => {
                            const arr = [...(prev[strategy.id] || [])];
                            arr[i] = !arr[i];
                            return { ...prev, [strategy.id]: arr };
                          })
                        }
                        className="mt-0.5 rounded accent-teal"
                      />
                      <span
                        className={`text-xs leading-relaxed transition-colors ${
                          stratChecks[i] ? 'text-teal font-medium' : 'text-fg/80 group-hover:text-fg'
                        }`}
                      >
                        {stratChecks[i] ? '✓ ' : ''}{item}
                      </span>
                    </label>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ExecutionModal({ stock, strategies = [], settings, onClose, onConfirm }) {
  const plan = stock?.plan || {};
  const pivot = plan.pivot ?? 0;
  const stop = plan.stop ?? 0;
  const plannedShares = plan.shares ?? 0;
  const portfolioSize = settings?.portfolioSize ?? 0;
  const riskPct = plan.riskPctUsed ?? plan.riskPct ?? settings?.defaultRiskPct ?? 1.5;
  const riskPctDecimal = typeof riskPct === 'number' && riskPct <= 1 ? riskPct : riskPct / 100;
  const maxPositionPct = (settings?.maxPositionPct ?? 25) / 100;

  const [actualEntry, setActualEntry] = useState(pivot ? String(pivot) : '');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sharesOverride, setSharesOverride] = useState('');

  const entryNum = parseFloat(String(actualEntry).replace(/,/g, '')) || 0;
  const slippageResult = useMemo(
    () => (pivot > 0 && entryNum > 0 ? calcSlippage(entryNum, pivot) : null),
    [pivot, entryNum]
  );
  const slippage = slippageResult ? slippageResult.pct / 100 : 0;
  const slippageUSD = slippageResult?.amount ?? entryNum - pivot;

  const recalcPosition = useMemo(
    () =>
      entryNum > 0 && stop > 0 && entryNum > stop && portfolioSize > 0
        ? calcPosition({
            pivot: entryNum,
            stop,
            portfolioSize,
            riskPct: riskPctDecimal,
            maxPositionPct,
          })
        : null,
    [entryNum, stop, portfolioSize, riskPctDecimal, maxPositionPct]
  );
  const suggestedShares = recalcPosition?.shares ?? plannedShares;
  const overrideNum = parseInt(sharesOverride, 10);
  const recalcShares = sharesOverride && overrideNum > 0 ? overrideNum : suggestedShares;
  const positionPctIfOverride = entryNum > 0 && portfolioSize > 0 ? (recalcShares * entryNum) / portfolioSize : 0;
  const overLimitWarn = positionPctIfOverride > maxPositionPct;

  const handleConfirmEntry = () => {
    if (!entryNum) return;
    const riskPerShare = entryNum - stop;
    const trade = {
      entryPrice: entryNum,
      entryDate: new Date(entryDate).toISOString(),
      sharesActual: recalcShares,
      slippage: slippageUSD,
      slippagePct: slippageResult?.pct ?? (pivot > 0 ? (slippageUSD / pivot) * 100 : 0),
      slippageUSD,
      originalStop: stop,
      currentStop: stop,
      stopHistory: [],
      partialExits: [],
      remainingShares: recalcShares,
      highWaterMark: entryNum,
      lastKnownPrice: entryNum,
      pyramid: { enabled: false, stages: [] },
      dailyNotes: [],
    };
    const actualRisk = riskPerShare * recalcShares;
    trade.actualRisk = actualRisk;
    trade.actualRiskPct = portfolioSize > 0 ? actualRisk / portfolioSize : 0;
    onConfirm({ ...stock, status: 'open', trade });
    onClose();
  };

  if (!stock) return null;

  return (
    <Modal open={!!stock} onClose={onClose} title="تأكيد الدخول" size="sm">
      <div className="space-y-4" dir="rtl">
        <div className="bg-[#0e1016] rounded-lg p-4 mb-4 text-right">
          <p className="text-xs text-gray-500">الخطة كانت</p>
          <p className="text-lg font-mono font-bold text-[#f0b429]">
            ${pivot.toFixed(2)} دخول | ${stop.toFixed(2)} وقف
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {plannedShares} سهم | ${(plan.positionValue ?? 0).toLocaleString()}
          </p>
        </div>

        <StrategyPreCheck strategies={strategies} stock={stock} />

        <div>
          <label className="block text-muted text-sm mb-1">سعر الدخول الفعلي *</label>
          <input
            type="number"
            step="0.01"
            value={actualEntry}
            onChange={(e) => setActualEntry(e.target.value)}
            placeholder={pivot ? String(pivot) : ''}
            className="w-full bg-s2 border border-border rounded-lg px-3 py-2 font-mono text-xl text-fg"
            dir="ltr"
            autoFocus
          />
          {actualEntry && (
            <div
              className={`mt-2 p-2 rounded text-right text-sm ${
                slippage <= 0 ? 'text-teal-400' : slippage <= 0.01 ? 'text-teal-400' : slippage <= 0.03 ? 'text-yellow-400' : 'text-red-400'
              }`}
            >
              {slippage <= 0
                ? '✅ دخلت بسعر أفضل من الخطة!'
                : slippage <= 0.01
                  ? `✅ انزلاق ممتاز: ${(slippage * 100).toFixed(2)}%`
                  : slippage <= 0.03
                    ? `🟡 انزلاق مقبول: ${(slippage * 100).toFixed(2)}%`
                    : `🔴 دخول متأخر: ${(slippage * 100).toFixed(2)}% — فكر مرتين`}
            </div>
          )}
        </div>

        {actualEntry && (
          <div className="bg-[#0e1016] rounded p-3 text-right space-y-2">
            <p className="text-xs text-gray-500">عدد الأسهم المقترح (بناءً على نسبة المخاطرة)</p>
            <p className="text-lg font-mono font-bold text-white">{suggestedShares} سهم</p>
            <div className="border-t border-[#1e2438] pt-2">
              <label className="block text-xs text-gray-500 mb-1">
                أو أدخل عدد الأسهم الفعلي الذي اشتريته (اختياري)
              </label>
              <input
                type="number"
                min="1"
                value={sharesOverride}
                onChange={(e) => setSharesOverride(e.target.value)}
                placeholder={String(suggestedShares)}
                className="w-full bg-[#141720] border border-[#1e2438] rounded px-3 py-2 font-mono text-white focus:border-[#f0b429]/50 outline-none"
                dir="ltr"
              />
              {sharesOverride && overrideNum > 0 && (
                <p className={`text-xs mt-1 ${overLimitWarn ? 'text-red-400' : 'text-teal-400'}`}>
                  {overLimitWarn
                    ? `⚠️ المركز ${(positionPctIfOverride * 100).toFixed(1)}% — يتجاوز الحد الأقصى ${(maxPositionPct * 100).toFixed(0)}%`
                    : `✅ المركز ${(positionPctIfOverride * 100).toFixed(1)}% من المحفظة`}
                </p>
              )}
            </div>
          </div>
        )}

        <div>
          <label className="block text-muted text-sm mb-1">تاريخ الدخول</label>
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg"
            dir="ltr"
          />
        </div>

        <button
          type="button"
          onClick={handleConfirmEntry}
          disabled={!actualEntry}
          className="w-full py-3 bg-[#f0b429] text-black font-bold rounded-lg disabled:opacity-50"
        >
          تأكيد الدخول → فتح الصفقة
        </button>
      </div>
    </Modal>
  );
}

import { useState, useMemo, useEffect } from 'react';
import Modal from './ui/Modal';
import { getPortfolioIntelligence } from '../utils/portfolioIntelligence';
import { calcSmartPosition, formatR } from '../utils/calculations';
import { defaultStock, defaultPlan } from '../utils/storage';
import { calcSlippage } from '../utils/stockCalcs';
import { useStockData } from '../hooks/useStockData';
import { STATUS } from '../utils/stockSchema';
import {
  calcSystemMetrics,
  calcDynamicRisk,
  calcPosition,
  calcTargets,
} from '../utils/rEngine';

const MARKET_LABELS = { easy: '🟢 سهل', normal: '🟡 طبيعي', hard: '🔴 صعب' };

export default function SmartTradeModal({ open, onClose, username, settings, onSave }) {
  const [ticker, setTicker] = useState('');
  const [pivot, setPivot] = useState('');
  const [stop, setStop] = useState('');
  const [riskOverride, setRiskOverride] = useState(false);
  const [riskPctOverride, setRiskPctOverride] = useState(1.5);
  const [saveMode, setSaveMode] = useState(null); // 'ready' | 'open'
  const [actualEntryPrice, setActualEntryPrice] = useState('');

  const tickerClean = (ticker || '').toUpperCase().trim();
  const { data: livePriceData } = useStockData(tickerClean || null);

  const intelligence = useMemo(
    () => getPortfolioIntelligence(settings || {}),
    [settings]
  );

  const pivotNum = parseFloat(pivot) || 0;
  const stopNum = parseFloat(stop) || 0;
  const riskPct = riskOverride ? riskPctOverride / 100 : (intelligence?.adjustedRiskPct ?? 0.015);
  const intelWithRisk = useMemo(
    () => (intelligence ? { ...intelligence, adjustedRiskPct: riskPct } : null),
    [intelligence, riskPct]
  );

  const systemMetrics = useMemo(
    () => calcSystemMetrics(intelligence?.closedTrades ?? []),
    [intelligence?.closedTrades]
  );
  const dynamicRisk = useMemo(
    () =>
      calcDynamicRisk(
        systemMetrics
          ? {
              winRate: systemMetrics.winRate,
              payoffRatio: systemMetrics.payoffRatio,
              expectancy: systemMetrics.expectancy,
              consecutiveLosses: systemMetrics.consecutiveLosses,
              last10WinRate: systemMetrics.last10WinRate,
              sqn: systemMetrics.sqn,
            }
          : null,
        { maxRiskPct: (settings?.defaultRiskPct ?? 1.5) / 100 }
      ),
    [systemMetrics, settings?.defaultRiskPct]
  );
  const riskPctForPosition = riskOverride ? riskPctOverride / 100 : (dynamicRisk?.riskPct ?? 0.015);
  const rPosition = useMemo(() => {
    if (!pivotNum || !stopNum || pivotNum <= stopNum || !settings?.portfolioSize) return null;
    return calcPosition({
      pivot: pivotNum,
      stop: stopNum,
      portfolioSize: settings.portfolioSize,
      riskPct: riskPctForPosition,
      maxPositionPct: (settings?.maxPositionPct ?? 25) > 1 ? (settings.maxPositionPct ?? 25) / 100 : (settings?.maxPositionPct ?? 0.25),
    });
  }, [pivotNum, stopNum, settings?.portfolioSize, riskPctForPosition, settings?.maxPositionPct]);
  const targets = useMemo(() => {
    if (!pivotNum || !stopNum || pivotNum <= stopNum) return null;
    return calcTargets(pivotNum, stopNum, systemMetrics ?? {});
  }, [pivotNum, stopNum, systemMetrics]);
  const breakevenWR = targets ? 1 / (1 + 2) * 100 : null;
  const userAboveBreakeven = systemMetrics && breakevenWR != null && systemMetrics.winRate * 100 >= breakevenWR;
  const hasEdge = systemMetrics && systemMetrics.expectancy > 0 && userAboveBreakeven;

  const smartPosition = useMemo(() => {
    if (!pivotNum || !stopNum || pivotNum <= stopNum) return null;
    return calcSmartPosition({
      pivot: pivotNum,
      stop: stopNum,
      settings: settings || {},
      intelligence: intelWithRisk || intelligence,
    });
  }, [pivotNum, stopNum, settings, intelWithRisk, intelligence]);

  const actualEntryNum = parseFloat(actualEntryPrice) || 0;
  const slippage = useMemo(() => {
    if (!actualEntryNum || !pivotNum) return null;
    return calcSlippage(actualEntryNum, pivotNum);
  }, [actualEntryNum, pivotNum]);

  useEffect(() => {
    if (!open) {
      setTicker('');
      setPivot('');
      setStop('');
      setRiskOverride(false);
      setRiskPctOverride(1.5);
      setSaveMode(null);
      setActualEntryPrice('');
    }
  }, [open]);

  const handleSave = () => {
    if (!tickerClean || !pivotNum || !stopNum) return;
    const base = defaultStock();
    base.ticker = tickerClean;
    base.company = livePriceData?.name || tickerClean;
    base.addedDate = new Date().toISOString();

    if (saveMode === 'ready') {
      base.status = STATUS.READY;
      base.plan = {
        ...defaultPlan(),
        pivot: pivotNum,
        stop: stopNum,
        riskPct: riskPct * 100,
      };
      onSave?.(base);
      onClose?.();
      return;
    }

    if (saveMode === 'open') {
      const entry = actualEntryNum || pivotNum;
      const shares = smartPosition?.shares ?? 0;
      const stopVal = stopNum;
      const slippageResult = calcSlippage(entry, pivotNum);
      const actualRisk = (entry - stopVal) * shares;
      const portfolioSize = settings?.portfolioSize ?? 1;
      base.status = STATUS.OPEN;
      base.plan = { ...defaultPlan(), pivot: pivotNum, stop: stopVal };
      base.trade = {
        entryPrice: entry,
        entryDate: new Date().toISOString(),
        sharesActual: shares,
        slippage: slippageResult?.amount ?? entry - pivotNum,
        slippagePct: slippageResult?.pct ?? (pivotNum ? ((entry - pivotNum) / pivotNum) * 100 : 0),
        actualRisk,
        actualRiskPct: (actualRisk / portfolioSize) * 100,
        currentStop: stopVal,
        stopHistory: [],
        partialExits: [],
        remainingShares: shares,
      };
      onSave?.(base);
      onClose?.();
    }
  };

  const canSaveReady = tickerClean && pivotNum > 0 && stopNum > 0 && pivotNum > stopNum;
  const canSaveOpen =
    canSaveReady &&
    (saveMode === 'open' ? (actualEntryNum > 0 || pivotNum) : false);

  return (
    <Modal open={open} onClose={onClose} title="إضافة صفقة ذكية" size="lg">
      <div className="space-y-5 text-right" dir="rtl">
        {/* ── PHASE A: INPUTS ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-muted text-sm mb-1">الرمز</label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="NVDA"
              className="w-full bg-s2 border border-border rounded-lg px-3 py-2 font-mono"
              dir="ltr"
            />
            {livePriceData?.currentPrice != null && (
              <p className="text-xs text-teal mt-1 font-mono">
                السعر الحالي: ${livePriceData.currentPrice}
              </p>
            )}
          </div>
          <div>
            <label className="block text-muted text-sm mb-1">سعر الدخول (Pivot)</label>
            <input
              type="number"
              step="0.01"
              value={pivot}
              onChange={(e) => setPivot(e.target.value)}
              className="w-full bg-s2 border border-border rounded-lg px-3 py-2 font-mono"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-muted text-sm mb-1">وقف الخسارة</label>
            <input
              type="number"
              step="0.01"
              value={stop}
              onChange={(e) => setStop(e.target.value)}
              className="w-full bg-s2 border border-border rounded-lg px-3 py-2 font-mono"
              dir="ltr"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="riskOverride"
            checked={riskOverride}
            onChange={(e) => setRiskOverride(e.target.checked)}
            className="rounded border-border"
          />
          <label htmlFor="riskOverride" className="text-sm text-muted">
            تخصيص نسبة المخاطرة
          </label>
          {riskOverride && (
            <input
              type="number"
              min="0.25"
              max="3"
              step="0.25"
              value={riskPctOverride}
              onChange={(e) => setRiskPctOverride(parseFloat(e.target.value) || 1.5)}
              className="w-20 bg-s2 border border-border rounded px-2 py-1 font-mono text-sm"
              dir="ltr"
            />
          )}
        </div>

        {/* ── PHASE B: SMART DISPLAY ── */}
        {smartPosition && (
          <div className="rounded-xl border border-border bg-s2/50 p-4 space-y-3">
            <h3 className="text-gold font-medium text-sm">📊 تحليل المحفظة الذكي</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">حالة السوق</span>
                <span>
                  {MARKET_LABELS[intelligence?.marketCondition] ?? '—'}{' '}
                  (آخر 10: {((intelligence?.last10WinRate ?? 0) * 100).toFixed(0)}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">مخاطرة الصفقة</span>
                <span className="font-mono">{(smartPosition.riskPct * 100).toFixed(2)}% من المحفظة</span>
              </div>
              {dynamicRisk && !riskOverride && (
                <div className="flex justify-between col-span-2 text-xs">
                  <span className="text-muted">الديناميكية (R)</span>
                  <span>{dynamicRisk.reasoning}</span>
                </div>
              )}
              <div className="flex justify-between col-span-2">
                <span className="text-muted">بسبب</span>
                <span>
                  آخر 10 صفقات:{' '}
                  {(intelligence?.closedTrades || []).slice(-10).filter((t) => (t.close?.finalR ?? 0) > 0).length} ربح{' '}
                  {(intelligence?.closedTrades || []).slice(-10).filter((t) => (t.close?.finalR ?? 0) <= 0).length} خسارة
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">عدد الأسهم</span>
                <span className="font-mono">{rPosition ? rPosition.shares : smartPosition.shares} سهم</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">حجم المركز</span>
                <span className="font-mono">
                  ${Number((rPosition ? rPosition.positionValue : smartPosition.positionValue) ?? 0).toLocaleString()} (
                  {((rPosition ? rPosition.positionPct : smartPosition.positionPct) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">المخاطرة $</span>
                <span className="font-mono">${smartPosition.riskAmount?.toFixed(0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">الهدف المقترح</span>
                <span className="font-mono">${smartPosition.historicalTarget?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">بناءً على</span>
                <span>متوسط R:R تاريخي: {formatR(intelligence?.avgRR ?? 2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">R:R مع الهدف</span>
                <span
                  className={
                    smartPosition.rrWithTarget >= 2 ? 'text-teal font-mono' : 'text-red font-mono'
                  }
                >
                  {smartPosition.rrWithTarget?.toFixed(1)}:1{' '}
                  {smartPosition.rrWithTarget >= 2 ? '✅' : '⚠️'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">خطر المحفظة الآن</span>
                <span className="font-mono">
                  {((intelligence?.committedRiskPct ?? 0) * 100).toFixed(1)}%{' '}
                  {(intelligence?.committedRiskPct ?? 0) <= 0.06 ? '🟡' : '🔴'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">بعد هذه الصفقة</span>
                <span className="font-mono">
                  {(smartPosition.portfolioRiskAfter * 100).toFixed(1)}%{' '}
                  {smartPosition.portfolioRiskAfter <= 0.06 ? '(ضمن الحد)' : '⚠️'}
                </span>
              </div>
            </div>

            {/* R targets + breakeven + edge */}
            {targets && (
              <div className="mt-3 pt-3 border-t border-border space-y-2">
                <h4 className="text-xs font-semibold text-gray-400">أهداف R</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                  <div className="bg-s1 rounded-lg p-2">
                    <p className="text-xs text-gray-500">الهدف الأدنى (2R)</p>
                    <p className="font-mono text-gold">${targets.target2R?.toFixed(2)}</p>
                  </div>
                  <div className="bg-s1 rounded-lg p-2">
                    <p className="text-xs text-gray-500">الهدف التاريخي (avg)</p>
                    <p className="font-mono text-fg">${targets.targetAvg?.toFixed(2)}</p>
                  </div>
                  <div className="bg-s1 rounded-lg p-2">
                    <p className="text-xs text-gray-500">الهدف المثالي (3R)</p>
                    <p className="font-mono text-teal">${targets.target3R?.toFixed(2)}</p>
                  </div>
                </div>
                {breakevenWR != null && (
                  <p className={`text-xs ${userAboveBreakeven ? 'text-teal' : 'text-red'}`}>
                    لربح هذا التوقع تحتاج نسبة فوز ≥ {(breakevenWR).toFixed(0)}% — لديك {(systemMetrics?.winRate ?? 0) * 100}%
                  </p>
                )}
                <div className={`text-sm font-medium px-3 py-2 rounded-lg ${hasEdge ? 'bg-teal/20 text-teal border border-teal/40' : 'bg-red/20 text-red border border-red/40'}`}>
                  {hasEdge ? '🟢 الصفقة متوافقة مع نظامك' : '🔴 تحذير: هذا الإعداد أضعف من نظامك الحالي'}
                </div>
              </div>
            )}

            {smartPosition.warnings?.length > 0 && (
              <div className="space-y-1 mt-2">
                {smartPosition.warnings.map((w, i) => (
                  <p
                    key={i}
                    className={`text-xs ${
                      w.type === 'error' ? 'text-red' : 'text-amber-200'
                    }`}
                  >
                    {w.msg}
                  </p>
                ))}
              </div>
            )}

            {/* Portfolio health mini */}
            <div className="mt-3 pt-3 border-t border-border rounded-lg bg-s1 p-3 text-xs">
              <p className="text-muted mb-1">المحفظة الآن</p>
              <p>
                مراكز مفتوحة: {intelligence?.openCount ?? 0} — تعرض:{' '}
                {((intelligence?.exposurePct ?? 0) * 100).toFixed(2)}%
              </p>
              <p>خسائر متتالية: {intelligence?.consecutiveLosses ?? 0}</p>
              <p>نسبة الفوز (آخر 10): {((intelligence?.last10WinRate ?? 0) * 100).toFixed(0)}%</p>
            </div>
          </div>
        )}

        {/* ── PHASE C: CONFIRM ── */}
        <div className="border-t border-border pt-4">
          <p className="text-muted text-sm mb-3">
            هل هذه الصفقة في مرحلة التخطيط أم الدخول الفعلي؟
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={() => setSaveMode('ready')}
              className={`px-4 py-2 rounded-lg border text-sm font-medium ${
                saveMode === 'ready' ? 'bg-gold/20 border-gold text-gold' : 'border-border text-muted'
              }`}
            >
              تخطيط — ready
            </button>
            <button
              type="button"
              onClick={() => setSaveMode('open')}
              className={`px-4 py-2 rounded-lg border text-sm font-medium ${
                saveMode === 'open' ? 'bg-teal/20 border-teal text-teal' : 'border-border text-muted'
              }`}
            >
              دخلت فعلاً — open
            </button>
          </div>

          {saveMode === 'open' && (
            <div className="mb-4">
              <label className="block text-muted text-sm mb-1">سعر الدخول الفعلي</label>
              <input
                type="number"
                step="0.01"
                value={actualEntryPrice}
                onChange={(e) => setActualEntryPrice(e.target.value)}
                placeholder={String(pivotNum)}
                className="w-full max-w-xs bg-s2 border border-border rounded-lg px-3 py-2 font-mono"
                dir="ltr"
              />
              {slippage != null && actualEntryNum > 0 && (
                <p
                  className={`text-sm mt-1 ${
                    slippage.pct <= 1 ? 'text-teal' : slippage.pct <= 3 ? 'text-amber-200' : 'text-red'
                  }`}
                >
                  انزلاق: {slippage.pct?.toFixed(2)}% من Pivot
                  {slippage.pct > 3 && ' — دخول متأخر'}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-muted hover:bg-s2"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saveMode === 'ready' ? !canSaveReady : !canSaveOpen}
              className="px-4 py-2 rounded-lg bg-gold text-black font-bold disabled:opacity-50"
            >
              حفظ الصفقة
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

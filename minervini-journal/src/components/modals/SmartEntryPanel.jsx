import { useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import { getPortfolioIntelligence } from '../../utils/portfolioIntelligence';
import { calcSmartPosition } from '../../utils/calculations';
import { calcSystemMetrics, calcDynamicRisk, calcTargets, calcPortfolioHeat } from '../../utils/rEngine';
import { defaultPlan, defaultExitConditions } from '../../utils/storage';

function MetricCard({ label, value, unit, color }) {
  const colorClass = color === 'gold' ? 'text-[#f0b429]' : color === 'red' ? 'text-[#ef476f]' : 'text-fg';
  return (
    <div className="bg-[#0e1016] rounded-lg p-3 text-right">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-lg font-mono font-bold ${colorClass}`}>
        {value != null ? (typeof value === 'number' && value % 1 !== 0 ? value.toFixed(2) : value) : '—'}
        {unit && <span className="text-sm mr-0.5">{unit}</span>}
      </p>
    </div>
  );
}

export default function SmartEntryPanel({ open, stock, settings, onClose, onConfirm }) {
  const [pivot, setPivot] = useState(stock?.plan?.pivot ?? '');
  const [stop, setStop] = useState(stock?.plan?.stop ?? '');
  const [resistance, setResistance] = useState(stock?.plan?.resistance ?? '');
  const rawRisk = stock?.plan?.riskPctUsed ?? stock?.plan?.riskPct ?? settings?.defaultRiskPct ?? 1.5;
  const [riskOverride, setRiskOverride] = useState(typeof rawRisk === 'number' && rawRisk <= 1 ? rawRisk * 100 : rawRisk);
  const [style, setStyle] = useState(stock?.style ?? 'both');
  const [exitConditions, setExitConditions] = useState(() => ({
    ...defaultExitConditions(),
    ...stock?.plan?.exitConditions,
  }));
  const [customCondition, setCustomCondition] = useState(stock?.plan?.exitConditions?.customCondition ?? '');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const pivotNum = parseFloat(String(pivot).replace(/,/g, '')) || 0;
  const stopNum = parseFloat(String(stop).replace(/,/g, '')) || 0;
  const resistanceNum = parseFloat(String(resistance).replace(/,/g, '')) || 0;
  const portfolioSize = settings?.portfolioSize ?? 0;

  const intelligence = useMemo(() => getPortfolioIntelligence(settings || {}), [settings]);
  const systemMetrics = useMemo(() => calcSystemMetrics(intelligence?.closedTrades ?? []), [intelligence?.closedTrades]);
  const dynamicRisk = useMemo(
    () =>
      calcDynamicRisk(
        systemMetrics ? { winRate: systemMetrics.winRate, payoffRatio: systemMetrics.payoffRatio ?? 2, consecutiveLosses: systemMetrics.consecutiveLosses, last10WinRate: systemMetrics.last10WinRate } : null,
        { maxRiskPct: (settings?.defaultRiskPct ?? 1.5) / 100 }
      ),
    [systemMetrics, settings?.defaultRiskPct]
  );
  const riskPctUsed = riskOverride ? riskOverride / 100 : dynamicRisk?.riskPct ?? 0.015;
  const smart = useMemo(
    () =>
      pivotNum > 0 && stopNum > 0 && pivotNum > stopNum && portfolioSize > 0
        ? calcSmartPosition({
            pivot: pivotNum,
            stop: stopNum,
            settings: { portfolioSize, maxPositionPct: (settings?.maxPositionPct ?? 25) / 100 },
            intelligence,
          })
        : null,
    [pivotNum, stopNum, portfolioSize, intelligence, settings?.maxPositionPct]
  );

  const targets = useMemo(
    () => (pivotNum > stopNum ? calcTargets(pivotNum, stopNum, { avgWinR: systemMetrics?.avgWinR ?? 2 }) : null),
    [pivotNum, stopNum, systemMetrics?.avgWinR]
  );
  const heat = useMemo(() => calcPortfolioHeat(intelligence?.openTrades ?? [], portfolioSize || 1), [intelligence?.openTrades, portfolioSize]);
  const portfolioHeatAfter = smart ? heat.heatPct + (smart.riskPct ?? 0) : heat.heatPct;
  const avgR = systemMetrics?.avgWinR ?? 2;
  const winRate = systemMetrics?.winRate ?? 0.5;
  const rrWithResistance =
    resistanceNum > pivotNum && pivotNum > stopNum
      ? (resistanceNum - pivotNum) / (pivotNum - stopNum)
      : 0;
  const breakevenWR = targets ? (1 / (1 + avgR)) * 100 : 50;
  const isEdgePositive = systemMetrics && systemMetrics.expectancy > 0 && winRate * 100 >= breakevenWR;

  const marketCondition = smart?.marketCondition ?? dynamicRisk?.marketCondition ?? 'normal';
  const marketLabel =
    marketCondition === 'easy' ? 'سوق سهل 🟢' : marketCondition === 'normal' ? 'طبيعي 🟡' : 'سوق صعب 🔴';
  const marketReason = dynamicRisk?.reasoning ?? '';

  const handleConfirm = () => {
    const plan = {
      ...defaultPlan(),
      pivot: pivotNum,
      stop: stopNum,
      resistance: resistanceNum || null,
      riskPerShare: smart?.riskPerShare ?? pivotNum - stopNum,
      shares: smart?.shares ?? 0,
      positionValue: smart?.positionValue ?? 0,
      positionPct: smart?.positionPct ?? 0,
      riskUSD: smart?.riskAmount ?? 0,
      riskPct: smart?.riskPct ?? 0,
      riskPctUsed,
      marketCondition,
      target2R: targets?.target2R ?? null,
      targetAvgR: targets?.targetAvg ?? null,
      target3R: targets?.target3R ?? null,
      rrRatio: rrWithResistance || null,
      exitConditions: { ...exitConditions, customCondition: customCondition.trim() || null },
      plannedDate: new Date().toISOString(),
    };
    onConfirm({ ...stock, status: 'ready', style, plan });
    onClose();
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="جاهز للدخول — خطة الدخول" size="lg">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" dir="rtl">
        {/* Right column: inputs */}
        <div className="space-y-4">
          <div>
            <label className="block text-muted text-sm mb-1">الأسعار</label>
            <div className="space-y-3 bg-s2 rounded-lg p-4 border border-border">
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">سعر الدخول (Pivot) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={pivot}
                  onChange={(e) => setPivot(e.target.value)}
                  placeholder="500.00"
                  className="w-full bg-s3 border border-border rounded-lg px-3 py-2 font-mono text-fg"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">وقف الخسارة *</label>
                <input
                  type="number"
                  step="0.01"
                  value={stop}
                  onChange={(e) => setStop(e.target.value)}
                  placeholder="480.00"
                  className="w-full bg-s3 border border-border rounded-lg px-3 py-2 font-mono text-fg"
                  dir="ltr"
                />
                <p className="text-xs text-gray-500 mt-0.5">يجب أن يكون أقل من سعر الدخول</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">أقرب مقاومة (اختياري)</label>
                <input
                  type="number"
                  step="0.01"
                  value={resistance}
                  onChange={(e) => setResistance(e.target.value)}
                  placeholder="560.00"
                  className="w-full bg-s3 border border-border rounded-lg px-3 py-2 font-mono text-fg"
                  dir="ltr"
                />
                <p className="text-xs text-gray-500 mt-0.5">لحساب R:R المرجعي فقط</p>
              </div>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setAdvancedOpen((o) => !o)}
              className="text-sm text-muted hover:text-gold"
            >
              {advancedOpen ? '▼' : '▶'} تخصيص الخطة
            </button>
            {advancedOpen && (
              <div className="mt-2 space-y-2 bg-s2 rounded-lg p-3 border border-border">
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">تجاوز نسبة المخاطرة %</label>
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.1"
                    value={riskOverride}
                    onChange={(e) => setRiskOverride(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <span className="text-sm font-mono text-gold">{riskOverride}%</span>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">أسلوب الصفقة</label>
                  <div className="flex gap-2">
                    {['swing', 'position', 'both'].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStyle(s)}
                        className={`px-2 py-1 rounded text-xs border ${style === s ? 'border-[#f0b429] bg-[#f0b429]/10 text-[#f0b429]' : 'border-border text-muted'}`}
                      >
                        {s === 'swing' ? 'سوينج' : s === 'position' ? 'بوزيشن' : 'كلاهما'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-muted text-sm mb-2">شروط الخروج السلوكي</label>
            <div className="space-y-2 bg-s2 rounded-lg p-4 border border-border">
              {[
                { key: 'ema21Break', label: 'كسر EMA21 بحجم عالٍ' },
                { key: 'volumeSell', label: 'بيع مؤسسي (حجم > 2x)' },
                { key: 'stopHit', label: 'وقف الخسارة دائماً' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!exitConditions[key]}
                    onChange={(e) => setExitConditions((c) => ({ ...c, [key]: e.target.checked }))}
                    className="rounded"
                  />
                  ✓ {label}
                </label>
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={exitConditions.pctFromPeak != null}
                  onChange={(e) =>
                    setExitConditions((c) => ({ ...c, pctFromPeak: e.target.checked ? 10 : null }))
                  }
                />
                <span className="text-sm">انخفاض</span>
                <input
                  type="number"
                  min="5"
                  max="20"
                  value={exitConditions.pctFromPeak ?? 10}
                  onChange={(e) => setExitConditions((c) => ({ ...c, pctFromPeak: parseFloat(e.target.value) || 10 }))}
                  className="w-14 bg-s3 border border-border rounded px-2 py-0.5 text-sm font-mono"
                  dir="ltr"
                />
                <span className="text-sm">% من القمة</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={exitConditions.earningsGuard != null}
                  onChange={(e) =>
                    setExitConditions((c) => ({ ...c, earningsGuard: e.target.checked ? 14 : null }))
                  }
                />
                <span className="text-sm">قبل الأرباح بـ</span>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={exitConditions.earningsGuard ?? 14}
                  onChange={(e) =>
                    setExitConditions((c) => ({ ...c, earningsGuard: parseInt(e.target.value, 10) || 14 }))
                  }
                  className="w-14 bg-s3 border border-border rounded px-2 py-0.5 text-sm font-mono"
                  dir="ltr"
                />
                <span className="text-sm">يوم</span>
              </div>
              <div>
                <label className="text-xs text-gray-500">➕ شرط خاص</label>
                <input
                  type="text"
                  value={customCondition}
                  onChange={(e) => setCustomCondition(e.target.value)}
                  placeholder="نص إضافي..."
                  className="w-full mt-0.5 bg-s3 border border-border rounded px-2 py-1 text-sm"
                  dir="rtl"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Left column: live results */}
        <div className="space-y-4">
          {pivotNum > 0 && stopNum > 0 && pivotNum > stopNum ? (
            <>
              <div
                className={`p-3 rounded-lg border text-right ${
                  marketCondition === 'easy'
                    ? 'bg-teal-500/10 border-teal-500/30'
                    : marketCondition === 'normal'
                      ? 'bg-yellow-500/10 border-yellow-500/30'
                      : 'bg-red-500/10 border-red-500/30'
                }`}
              >
                <p className="text-sm font-semibold">{marketLabel}</p>
                <p className="text-xs text-gray-400">{marketReason}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="عدد الأسهم" value={smart?.shares} unit="سهم" />
                <MetricCard label="حجم المركز" value={smart?.positionValue} unit="$" color="gold" />
                <MetricCard label="المخاطرة $" value={smart?.riskAmount} unit="$" color="red" />
                <MetricCard label="% من المحفظة" value={smart?.positionPct != null ? smart.positionPct * 100 : null} unit="%" />
              </div>

              <div className="bg-[#0e1016] rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-3 text-right">الأهداف المرجعية (للتخطيط — الخروج سلوكي)</p>
                <div className="space-y-2">
                  {[
                    { label: 'الحد الأدنى 2R', price: targets?.target2R, color: 'text-gray-400' },
                    { label: `متوسطك ${avgR.toFixed(1)}R`, price: targets?.targetAvg, color: 'text-[#f0b429]' },
                    { label: 'مثالي 3R', price: targets?.target3R, color: 'text-[#06d6a0]' },
                  ].map((t, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className={`text-sm font-mono font-bold ${t.color}`}>
                        ${t.price != null ? t.price.toFixed(2) : '—'}
                      </span>
                      <span className="text-xs text-gray-400">{t.label}</span>
                    </div>
                  ))}
                  {resistanceNum > 0 && (
                    <div className="border-t border-[#1e2438] pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-mono text-blue-400">{rrWithResistance.toFixed(1)}:1 R:R</span>
                        <span className="text-xs text-gray-400">مقاومة: ${resistanceNum.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-[#0e1016] rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-2 text-right">تأثير على المحفظة</p>
                <div className="flex justify-between text-sm">
                  <span className={portfolioHeatAfter > 0.06 ? 'text-red-400' : 'text-[#f0b429]'}>
                    {(portfolioHeatAfter * 100).toFixed(1)}%
                  </span>
                  <span className="text-gray-400">الخطر الكلي بعد الصفقة</span>
                </div>
                {portfolioHeatAfter > 0.06 && (
                  <p className="text-xs text-red-400 mt-1 text-right">⚠️ تجاوز 6% — فكر في تقليل الحجم</p>
                )}
              </div>

              <div
                className={`p-3 rounded-lg text-right border ${
                  isEdgePositive ? 'bg-teal-500/10 border-teal-500/30' : 'bg-red-500/10 border-red-500/30'
                }`}
              >
                <p className="text-sm font-semibold">
                  {isEdgePositive ? '✅ الصفقة متوافقة مع نظامك' : '⚠️ ضعيفة مقارنة بنظامك'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Breakeven: {breakevenWR.toFixed(0)}% | نسبة فوزك: {(winRate * 100).toFixed(0)}%
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center min-h-[200px] text-gray-500 text-sm">
              أدخل سعر الدخول والوقف لرؤية الحسابات
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-border">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-fg hover:bg-s2">
          إلغاء
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!pivotNum || !stopNum || pivotNum <= stopNum}
          className="px-4 py-2 rounded-lg bg-[#f0b429] text-black font-bold disabled:opacity-50"
        >
          تأكيد الخطة ←
        </button>
      </div>
    </Modal>
  );
}

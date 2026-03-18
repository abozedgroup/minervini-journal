import { useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import { autoGrade } from '../../utils/storage';
import { formatR } from '../../utils/calculations';

const EXIT_REASONS = [
  { id: 'ema21_break', icon: '📉', label: 'كسر EMA21 بحجم' },
  { id: 'volume_sell', icon: '📊', label: 'بيع مؤسسي (حجم ضخم)' },
  { id: 'pct_from_peak', icon: '🏔️', label: '10%- من القمة' },
  { id: 'earnings_guard', icon: '📅', label: 'قبل الأرباح' },
  { id: 'stop_hit', icon: '🛑', label: 'وقف الخسارة' },
  { id: 'target_reached', icon: '🎯', label: 'وصل الهدف المرجعي' },
  { id: 'manual', icon: '✋', label: 'قرار يدوي' },
  { id: 'other', icon: '📝', label: 'سبب آخر' },
];

export default function CloseTradeModal({ stock, onClose, onConfirm }) {
  const trade = stock?.trade || {};
  const entry = trade.entryPrice ?? 0;
  // currentStop أولاً — يحترم أي تصحيح تم عبر "تعديل الصفقة"
  const stop = trade.currentStop ?? trade.originalStop ?? 0;
  const totalShares = trade.remainingShares ?? trade.sharesActual ?? trade.shares ?? 0;
  const currentPrice = stock?.live?.currentPrice ?? entry;

  const [closePrice, setClosePrice]   = useState(currentPrice ? String(currentPrice) : '');
  const [exitReason, setExitReason]   = useState('');
  const [exitDetail, setExitDetail]   = useState('');
  const [closeDate, setCloseDate]     = useState(() => new Date().toISOString().slice(0, 10));
  const [lessons, setLessons]         = useState('');

  // إغلاق جزئي
  const [isPartial, setIsPartial]         = useState(false);
  // تهيئة الأسهم الجزئية بنصف الأسهم الكلية (50%) كقيمة افتراضية مرئية
  const [partialShares, setPartialShares] = useState(String(Math.floor(totalShares / 2) || 1));

  const closeNum        = parseFloat(String(closePrice).replace(/,/g, '')) || 0;
  const riskPerShare    = entry - stop;
  const finalR          = riskPerShare > 0 && closeNum > 0 ? (closeNum - entry) / riskPerShare : 0;

  // الأسهم الفعلية للإغلاق (كامل أو جزئي)
  const sharesNum       = isPartial
    ? Math.min(Math.max(parseFloat(partialShares) || 0, 0), totalShares)
    : totalShares;
  const pnlUSD          = (closeNum - entry) * sharesNum;
  const pnlPct          = entry > 0 ? ((closeNum - entry) / entry) * 100 : 0;

  const gradeResult = useMemo(() => {
    if (!closeNum || !exitReason) return null;
    const mockClose = { finalR, exitReason };
    const mockTrade = { slippage: 0 };
    return autoGrade({ close: mockClose, trade: mockTrade });
  }, [closeNum, exitReason, finalR]);

  const grade        = gradeResult?.grade ?? 'C';
  const gradeReasons = gradeResult?.gradeReasons ?? [];

  const partialValid = !isPartial || (sharesNum > 0 && sharesNum < totalShares);
  const canConfirm   = !!(closeNum && exitReason && partialValid);

  const handleConfirm = () => {
    if (!canConfirm) return;
    const closeData = {
      closePrice:        closeNum,
      closeDate:         new Date(closeDate).toISOString(),
      sharesExited:      sharesNum,
      isPartial,
      exitReason,
      exitTriggerDetail: exitDetail.trim() || null,
      finalR,
      pnlUSD,
      pnlPct,
      grade,
      gradeReasons,
      lessons: lessons.trim() || null,
    };
    onConfirm(closeData);
    onClose();
  };

  if (!stock) return null;

  return (
    <Modal open={!!stock} onClose={onClose} title="إغلاق الصفقة" size="md">
      <div className="space-y-4" dir="rtl">

        {/* ── Header stats ── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#0e1016] rounded p-3 text-right">
            <p className="text-xs text-gray-500">دخلت بـ</p>
            <p className="font-mono font-bold text-[#f0b429]">${Number(entry).toFixed(2)}</p>
          </div>
          <div className="bg-[#0e1016] rounded p-3 text-right">
            <p className="text-xs text-gray-500">الوقف الحالي</p>
            <p className="font-mono font-bold text-[#ef476f]">${Number(stop).toFixed(2)}</p>
          </div>
          <div className="bg-[#0e1016] rounded p-3 text-right">
            <p className="text-xs text-gray-500">R الحالي</p>
            <p className={`font-mono font-bold ${(stock.live?.currentR ?? 0) >= 0 ? 'text-[#06d6a0]' : 'text-[#ef476f]'}`}>
              {stock.live?.currentR != null
                ? `${stock.live.currentR >= 0 ? '+' : ''}${Number(stock.live.currentR).toFixed(2)}R`
                : '—'}
            </p>
          </div>
        </div>

        {/* ── نوع الإغلاق: كامل / جزئي ── */}
        <div className="flex rounded-lg overflow-hidden border border-[#1e2438]">
          <button
            type="button"
            onClick={() => setIsPartial(false)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              !isPartial ? 'bg-[#f0b429] text-black' : 'bg-[#0e1016] text-gray-400 hover:text-white'
            }`}
          >
            إغلاق كامل
          </button>
          <button
            type="button"
            onClick={() => setIsPartial(true)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              isPartial ? 'bg-[#f0b429] text-black' : 'bg-[#0e1016] text-gray-400 hover:text-white'
            }`}
          >
            خروج جزئي ✂️
          </button>
        </div>

        {/* ── عدد الأسهم عند الإغلاق الجزئي ── */}
        {isPartial && (
          <div className="bg-[#0e1016] rounded-lg p-3 border border-[#1e2438]">
            <div className="flex items-center justify-between gap-3">
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-1">الأسهم الكلية</p>
                <p className="font-mono text-white font-bold">{totalShares}</p>
              </div>
              <div className="flex-1 max-w-[140px]">
                <label className="block text-xs text-gray-500 mb-1 text-right">أسهم تبيع الآن *</label>
                <input
                  type="number"
                  min="1"
                  max={totalShares - 1}
                  value={partialShares}
                  onChange={(e) => setPartialShares(e.target.value)}
                  placeholder={String(Math.floor(totalShares / 2))}
                  className="w-full bg-[#141720] border border-[#1e2438] rounded-lg px-3 py-2 text-white font-mono text-sm focus:border-[#f0b429]/50 outline-none"
                  dir="ltr"
                  autoFocus
                />
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-1">تبقّى</p>
                <p className="font-mono text-teal-400 font-bold">
                  {Math.max(0, totalShares - (parseFloat(partialShares) || 0))}
                </p>
              </div>
            </div>
            {parseFloat(partialShares) >= totalShares && (
              <p className="text-xs text-red-400 mt-2 text-right">
                ⚠️ لا يمكن بيع كل الأسهم في الإغلاق الجزئي — استخدم &quot;إغلاق كامل&quot;
              </p>
            )}
          </div>
        )}

        {/* ── سعر الخروج ── */}
        <div>
          <label className="block text-muted text-sm mb-1">سعر الخروج *</label>
          <input
            type="number"
            step="0.01"
            value={closePrice}
            onChange={(e) => setClosePrice(e.target.value)}
            placeholder={currentPrice ? String(currentPrice) : String(entry)}
            className="w-full bg-s2 border border-border rounded-lg px-3 py-2 font-mono text-xl text-fg"
            dir="ltr"
            autoFocus={!isPartial}
          />
          {closePrice && (
            <div className={`mt-2 p-3 rounded-lg text-right border ${
              finalR >= 2 ? 'bg-teal-500/10 border-teal-500/30'
                : finalR >= 0 ? 'bg-yellow-500/10 border-yellow-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              <p className="text-lg font-bold font-mono">
                {formatR(finalR)}
              </p>
              <p className="text-sm">
                {finalR >= 3 ? '🔥 صفقة استثنائية'
                  : finalR >= 2 ? '✅ صفقة ممتازة'
                  : finalR >= 1 ? '🟡 صفقة جيدة'
                  : finalR >= 0 ? '⚪ ربح بسيط'
                  : finalR >= -1 ? '🔴 خسارة — درّس الصفقة'
                  : '💀 خسارة كاملة — ماذا حدث؟'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                ربح/خسارة ({sharesNum} سهم): {pnlUSD >= 0 ? '+' : ''}${pnlUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          )}
        </div>

        {/* ── سبب الخروج ── */}
        <div>
          <label className="block text-muted text-sm mb-2">سبب الخروج *</label>
          <div className="grid grid-cols-2 gap-2">
            {EXIT_REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setExitReason(r.id)}
                className={`p-3 rounded-lg text-right border text-sm transition-all ${
                  exitReason === r.id
                    ? 'border-[#f0b429] bg-[#f0b429]/10 text-white'
                    : 'border-[#1e2438] text-gray-400 hover:border-gray-600'
                }`}
              >
                <span className="mr-2">{r.icon}</span>
                {r.label}
              </button>
            ))}
          </div>
          {['ema21_break', 'volume_sell', 'manual', 'other'].includes(exitReason) && (
            <input
              type="text"
              value={exitDetail}
              onChange={(e) => setExitDetail(e.target.value)}
              placeholder="تفاصيل إضافية..."
              className="mt-2 w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg"
              dir="rtl"
            />
          )}
        </div>

        {/* ── تاريخ الخروج ── */}
        <div>
          <label className="block text-muted text-sm mb-1">تاريخ الخروج</label>
          <input
            type="date"
            value={closeDate}
            onChange={(e) => setCloseDate(e.target.value)}
            className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg"
            dir="ltr"
          />
        </div>

        {/* ── ماذا تعلمت ── */}
        <div>
          <label className="block text-muted text-sm mb-1">
            ماذا تعلمت؟ <span className="text-gray-500 text-xs mr-1">(اختياري)</span>
          </label>
          <textarea
            value={lessons}
            onChange={(e) => setLessons(e.target.value)}
            placeholder="ما الذي سأفعله بشكل مختلف في الصفقة القادمة؟"
            rows={2}
            className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg"
            dir="rtl"
          />
        </div>

        {/* ── الدرجة التلقائية ── */}
        {closePrice && exitReason && (
          <div className="bg-[#0e1016] rounded-lg p-3 text-right border border-[#1e2438]">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div className="flex gap-1 flex-wrap">
                {gradeReasons.map((r, i) => (
                  <span key={i} className="text-xs text-gray-400">{r}</span>
                ))}
              </div>
              <div>
                <span className="text-xs text-gray-500 ml-2">الدرجة التلقائية:</span>
                <span className={`text-2xl font-bold font-mono ${
                  grade === 'A' ? 'text-[#06d6a0]'
                    : grade === 'B' ? 'text-[#f0b429]'
                    : grade === 'C' ? 'text-gray-400'
                    : 'text-[#ef476f]'
                }`}>
                  {grade}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── أزرار الإجراء ── */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="py-3 rounded-lg border border-[#1e2438] text-gray-400 hover:text-white hover:border-gray-500 transition-colors font-medium"
          >
            ← إلغاء
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="py-3 bg-[#f0b429] text-black font-bold rounded-lg disabled:opacity-50 transition-opacity"
          >
            {isPartial ? `✂️ بيع ${sharesNum || '?'} سهم` : 'إغلاق الصفقة نهائياً'}
          </button>
        </div>

      </div>
    </Modal>
  );
}

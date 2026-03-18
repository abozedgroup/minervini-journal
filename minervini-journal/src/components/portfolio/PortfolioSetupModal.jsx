import { useState } from 'react';
import Modal from '../ui/Modal';

export default function PortfolioSetupModal({ onSave }) {
  const [portfolioSize, setPortfolioSize] = useState('');
  const [defaultRiskPct, setDefaultRiskPct] = useState('1.5');
  const [maxPositionPct, setMaxPositionPct] = useState('25');

  const handleSubmit = (e) => {
    e.preventDefault();
    const size = parseFloat(String(portfolioSize).replace(/,/g, ''));
    if (!size || size <= 0) return;
    const risk = Math.min(2.5, Math.max(0.5, parseFloat(defaultRiskPct) || 1.5));
    const maxPos = Math.min(50, Math.max(5, parseInt(maxPositionPct, 10) || 25));
    onSave({
      portfolioSize: size,
      defaultRiskPct: risk,
      maxPositionPct: maxPos,
      maxTotalRiskPct: 6,
      updatedAt: new Date().toISOString(),
    });
  };

  const sizeNum = parseFloat(String(portfolioSize).replace(/,/g, ''));
  const canSubmit = sizeNum > 0;

  return (
    <Modal open title="إعداد المحفظة" size="md" hideClose>
      <p className="text-muted text-sm mb-4">مطلوب لحساب أحجام المراكز</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-fg text-sm font-medium mb-1">حجم المحفظة الكلي ($)</label>
          <input
            type="number"
            inputMode="decimal"
            required
            value={portfolioSize}
            onChange={(e) => setPortfolioSize(e.target.value)}
            placeholder="100000"
            className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg font-mono"
            dir="ltr"
          />
        </div>
        <div>
          <label className="block text-fg text-sm font-medium mb-1">نسبة المخاطرة الافتراضية لكل صفقة (%)</label>
          <input
            type="number"
            step="0.25"
            min="0.5"
            max="2.5"
            value={defaultRiskPct}
            onChange={(e) => setDefaultRiskPct(e.target.value)}
            className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg font-mono"
            dir="ltr"
          />
          <p className="text-muted text-xs mt-1">مينيرفيني يستخدم 1–2%</p>
        </div>
        <div>
          <label className="block text-fg text-sm font-medium mb-1">الحد الأقصى للمركز الواحد (%)</label>
          <input
            type="number"
            min="5"
            max="50"
            value={maxPositionPct}
            onChange={(e) => setMaxPositionPct(e.target.value)}
            className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg font-mono"
            dir="ltr"
          />
          <p className="text-muted text-xs mt-1">مينيرفيني: عادةً 25% كحد أقصى</p>
        </div>
        <div className="pt-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full px-4 py-2 rounded-lg bg-gold text-black font-bold disabled:opacity-50"
          >
            بدء التداول
          </button>
        </div>
      </form>
    </Modal>
  );
}

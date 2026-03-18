import { useState, useCallback } from 'react';
import Modal from '../ui/Modal';
import { api } from '../../services/api';
import { defaultStock, defaultWatch, defaultNotes, defaultPhases } from '../../utils/storage';

const STYLE_LABELS = { swing: 'سوينج', position: 'بوزيشن', both: 'كلاهما' };

export default function AddStockModal({ open, onClose, onSave }) {
  const [ticker, setTicker] = useState('');
  const [stockName, setStockName] = useState('');
  const [tickerError, setTickerError] = useState(false);
  const [style, setStyle] = useState('both');
  const [stars, setStars] = useState(2);
  const [reason, setReason] = useState('');
  const [sector, setSector] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchStockName = useCallback(async () => {
    const t = (ticker || '').trim().toUpperCase();
    if (!t) return;
    setLoading(true);
    setTickerError(false);
    setStockName('');
    try {
      const data = await api.price(t);
      setStockName(data.name || data.longName || t);
      setTickerError(false);
      if (data.sector) setSector(data.sector);
    } catch {
      setTickerError(true);
      setStockName('');
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  const handleSave = () => {
    const t = (ticker || '').trim().toUpperCase();
    if (!t) return;
    const stock = {
      ...defaultStock(),
      ticker: t,
      name: stockName || t,
      company: stockName || t,
      sector: sector || '',
      addedDate: new Date().toISOString(),
      status: 'watching',
      style,
      stars,
      watch: { ...defaultWatch(), reason: reason.trim() || null },
    };
    onSave(stock);
    setTicker('');
    setStockName('');
    setSector('');
    setTickerError(false);
    setReason('');
    onClose();
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="إضافة سهم للمراقبة" size="sm">
      <div className="space-y-4" dir="rtl">
        <div>
          <label className="block text-muted text-sm mb-1">الرمز *</label>
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onBlur={fetchStockName}
            placeholder="NVDA"
            className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg font-mono uppercase"
            dir="ltr"
            autoFocus
          />
          {loading && <p className="text-xs text-gray-500 mt-1">جاري التحقق...</p>}
          {stockName && !tickerError && <p className="text-xs text-teal-400 mt-1">✓ {stockName}</p>}
          {tickerError && <p className="text-xs text-red-400 mt-1">⚠️ رمز غير موجود</p>}
        </div>

        <div>
          <label className="block text-muted text-sm mb-1">أسلوب التداول</label>
          <div className="flex gap-2">
            {['swing', 'position', 'both'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStyle(s)}
                className={`px-3 py-1.5 rounded text-xs border ${
                  style === s ? 'border-[#f0b429] bg-[#f0b429]/10 text-[#f0b429]' : 'border-[#1e2438] text-gray-400'
                }`}
              >
                {STYLE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-muted text-sm mb-1">مستوى الاهتمام</label>
          <div className="flex gap-1">
            {[1, 2, 3].map((s) => (
              <button key={s} type="button" onClick={() => setStars(s)} className="p-0.5 focus:outline-none">
                <span className={s <= stars ? 'text-[#f0b429]' : 'text-gray-600'}>★</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-muted text-sm mb-1">سبب الاهتمام <span className="text-gray-500">(اختياري)</span></label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="اختراق قاعدة، RS قوي، نمط كوب..."
            rows={2}
            className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg placeholder-gray-500"
            dir="rtl"
          />
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!ticker.trim() || tickerError}
          className="w-full py-2.5 bg-[#f0b429] text-black font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          إضافة للمراقبة
        </button>
      </div>
    </Modal>
  );
}

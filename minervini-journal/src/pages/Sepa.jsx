import { useState, useEffect } from 'react';
import { loadData, saveData } from '../utils/storage';
import { useToast } from '../components/ui/Toast';

const SEPA_CRITERIA = [
  'السعر فوق المتوسط 200',
  'المتوسط 200 في اتجاه صاعد',
  'المتوسط 50 فوق 150 و 200',
  'السعر فوق المتوسط 50',
  'السعر في نطاق 30% من أعلى 52 أسبوع',
  'RS Rating ≥ 70',
  'Volume Dry-Up قبل الاختراق',
];

export default function Sepa({ user }) {
  const username = user?.username || '';
  const { showToast } = useToast();
  const [ticker, setTicker] = useState('');
  const [checks, setChecks] = useState(SEPA_CRITERIA.map(() => false));
  const [hasSearched, setHasSearched] = useState(false);

  const score = checks.filter(Boolean).length;
  const scoreColor = score >= 5 ? 'text-teal' : score >= 3 ? 'text-gold' : 'text-red';
  const canAddToWatchlist = score >= 5;

  const handleCheck = (i) => {
    setChecks((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const t = (ticker || '').trim().toUpperCase();
    if (!t) {
      showToast('أدخل رمز السهم', 'error');
      return;
    }
    setTicker(t);
    setHasSearched(true);
    setChecks(SEPA_CRITERIA.map(() => false));
  };

  const addToWatchlist = () => {
    if (!username) return;
    const t = (ticker || '').trim().toUpperCase();
    if (!t) {
      showToast('أدخل رمز السهم أولاً', 'error');
      return;
    }
    const watchlist = loadData(username, 'watchlist', []);
    const exists = watchlist.some((w) => (w.ticker || '').toUpperCase() === t);
    if (exists) {
      showToast('السهم موجود مسبقاً في قائمة المراقبة', 'info');
      return;
    }
    const newItem = {
      id: Date.now(),
      ticker: t,
      company: t,
      setup: 'SEPA',
      trigger: 0,
      stop: 0,
      target: 0,
      riskPct: 2,
      technicalNotes: '',
      entryNote: '',
      checks: { above200: false, above50: false, dryUp: false, rsRating: false, patternComplete: false },
      readinessScore: score >= 5 ? 70 : 50,
    };
    saveData(username, 'watchlist', [...watchlist, newItem]);
    showToast(`تمت إضافة ${t} إلى قائمة المراقبة`, 'success');
  };

  return (
    <div className="min-h-screen p-6">
      <header className="mb-6">
        <h1 className="font-display text-2xl text-gold">✦ SEPA Checker</h1>
        <p className="text-muted text-sm mt-1">تحقق من معايير SEPA يدوياً (بدون بيانات حية)</p>
      </header>

      <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3 mb-8">
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="رمز السهم"
          className="bg-s2 border border-border rounded-lg px-4 py-2 text-fg font-mono min-w-[120px]"
          dir="ltr"
        />
        <button type="submit" className="px-4 py-2 rounded-lg bg-gold text-black font-bold hover:bg-gold/90">
          فحص ✦
        </button>
      </form>

      {hasSearched && (
        <>
          <div className="mb-6 p-4 bg-s1 border border-border rounded-xl">
            <h3 className="text-gold font-medium mb-2">معايير SEPA — حدد ما ينطبق</h3>
            <p className="text-muted text-sm mb-4">قم بتحديد الشروط التي يلبيها السهم {ticker} (يدوياً حتى ربط مصدر بيانات).</p>
            <div className="space-y-3">
              {SEPA_CRITERIA.map((label, i) => (
                <label key={i} className="flex items-center gap-3 cursor-pointer group" onClick={() => handleCheck(i)}>
                  <input type="checkbox" checked={checks[i]} onChange={() => handleCheck(i)} className="sr-only" />
                  <span className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center text-sm font-bold transition-colors ${checks[i] ? 'border-teal bg-teal/20 text-teal' : 'border-border text-muted group-hover:border-gold/50'}`}>
                    {checks[i] ? '✓' : '○'}
                  </span>
                  <span className="text-fg">{label}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center gap-4">
              <span className={`font-display text-2xl font-mono ${scoreColor}`}>
                النتيجة: {score} / 7
              </span>
              {canAddToWatchlist && (
                <button
                  type="button"
                  onClick={addToWatchlist}
                  className="px-4 py-2 rounded-lg bg-teal text-black font-bold hover:bg-teal/90"
                >
                  إضافة للـ Watchlist
                </button>
              )}
            </div>
          </div>

          {!canAddToWatchlist && score > 0 && (
            <p className="text-muted text-sm">تحتاج 5 معايير على الأقل لإضافة السهم إلى قائمة المراقبة.</p>
          )}
        </>
      )}

      {!hasSearched && (
        <p className="text-muted">أدخل رمز السهم ثم اضغط «فحص ✦» لبدء التحقق من معايير SEPA.</p>
      )}
    </div>
  );
}

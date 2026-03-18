import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadWatchlist, loadData, saveData, migrateStock, defaultNotes, defaultPhases } from '../utils/storage';
import { calcShares } from '../utils/calculations';
import { calcPhaseReadiness } from '../utils/watchlistModel';
import { buildChecklistFromStrategy, buildGroupedChecklist, getStrategySummary } from '../utils/strategyChecklist';
import { defaultSettings } from '../utils/portfolioUtils';
import RichEditor from '../components/editor/RichEditor';
import { useToast } from '../components/ui/Toast';
import { useStockData } from '../hooks/useStockData';
import { generateStockReport } from '../utils/reportGenerator';

const NOTE_TABS = [
  { key: 'chart', label: '📊 تحليل الشارت', placeholder: 'سجّل تحليلك الفني... الاتجاه، النموذج، مستويات الدعم والمقاومة، الملاحظات على الحجم...' },
  { key: 'financial', label: '💰 التحليل المالي', placeholder: 'EPS نمو، الإيرادات، الهامش، المؤسسيون، الديون...' },
  { key: 'daily', label: '📅 يوميات السهم', placeholder: 'اليوم رأيت السهم...' },
  { key: 'sources', label: '🔗 مصادر', placeholder: 'روابط مقالات، تغريدات، تقارير...' },
];

const SENTIMENTS = [
  { key: 'very_bullish', emoji: '🔥', label: 'متفائل جداً' },
  { key: 'bullish', emoji: '👍', label: 'إيجابي' },
  { key: 'neutral', emoji: '😐', label: 'محايد' },
  { key: 'cautious', emoji: '😟', label: 'متردد' },
  { key: 'bearish', emoji: '🚫', label: 'لا أدخل' },
];

const DISCOVERED_FROM_OPTIONS = [
  'سكرينر تقني',
  'توصية / رأي شخص آخر',
  'مسح يدوي للأسهم',
  'أخبار مالية',
  'قراءة تقرير / تحليل',
  'شبكات اجتماعية / تويتر',
  'أخرى',
];

function getNoteContent(notes, key) {
  const v = notes?.[key];
  if (v && typeof v === 'object' && v.type === 'doc') return v;
  if (typeof v === 'string' && v.trim()) return v;
  return null;
}

function DiaryTab({ diary = [], onSave }) {
  const [text, setText] = useState('');
  const [tagFilter, setTagFilter] = useState(null);

  const extractTags = (txt) => {
    const matches = txt.match(/#[\u0600-\u06FFa-zA-Z0-9_]+/g) || [];
    return [...new Set(matches.map((t) => t.slice(1)))];
  };

  const addEntry = () => {
    if (!text.trim()) return;
    const tags = extractTags(text);
    const entry = {
      id: 'de_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      date: new Date().toISOString(),
      text: text.trim(),
      tags,
    };
    onSave([entry, ...diary]);
    setText('');
  };

  const deleteEntry = (entryId) => onSave(diary.filter((e) => e.id !== entryId));

  const allTags = [...new Set(diary.flatMap((e) => e.tags || []))];
  const filtered = tagFilter ? diary.filter((e) => (e.tags || []).includes(tagFilter)) : diary;

  const renderText = (txt) =>
    txt.split(/(#[\u0600-\u06FFa-zA-Z0-9_]+)/g).map((part, i) =>
      part.startsWith('#') ? (
        <span
          key={i}
          className="text-gold cursor-pointer hover:underline"
          onClick={() => setTagFilter(part.slice(1) === tagFilter ? null : part.slice(1))}
        >
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      )
    );

  return (
    <div className="space-y-3">
      <div className="bg-s2 border border-border rounded-xl p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="سجّل ملاحظتك اليومية... استخدم #هاشتاق للتصنيف"
          className="w-full bg-transparent border-none outline-none text-fg text-sm resize-none min-h-[80px]"
          dir="rtl"
          onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) addEntry(); }}
        />
        <div className="flex items-center justify-between mt-2 border-t border-border pt-2">
          <span className="text-muted text-xs">Ctrl+Enter للحفظ</span>
          <button type="button" onClick={addEntry} className="px-3 py-1 rounded-lg bg-gold/20 text-gold border border-gold/50 text-sm hover:bg-gold/30">
            + إضافة
          </button>
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-muted text-xs">فلتر:</span>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
              className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${tagFilter === tag ? 'bg-gold/20 text-gold border-gold/50' : 'bg-s2 text-muted border-border hover:border-gold/40'}`}
            >
              #{tag}
            </button>
          ))}
          {tagFilter && (
            <button type="button" onClick={() => setTagFilter(null)} className="text-muted text-xs hover:text-fg">✕ مسح</button>
          )}
        </div>
      )}

      {filtered.length === 0 && (
        <p className="text-muted text-sm text-center py-6">لا توجد يوميات بعد</p>
      )}

      {filtered.map((entry) => (
        <div key={entry.id} className="bg-s2 border border-border rounded-xl p-3 group">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-muted text-xs font-mono">
              {new Date(entry.date).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
            <button
              type="button"
              onClick={() => deleteEntry(entry.id)}
              className="text-muted text-xs opacity-0 group-hover:opacity-100 hover:text-red transition-opacity"
            >
              ✕
            </button>
          </div>
          <p className="text-fg text-sm leading-relaxed whitespace-pre-wrap" dir="rtl">{renderText(entry.text)}</p>
          {(entry.tags?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {entry.tags.map((tag) => (
                <span key={tag} className="text-gold/60 text-xs">#{tag}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function StockDetail({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const username = user?.username || '';
  const settings = username ? (loadData(username, 'settings', defaultSettings()) || defaultSettings()) : defaultSettings();
  const portfolioSize = settings?.portfolioSize ?? user?.portfolioSize ?? 0;
  const { showToast } = useToast();

  const [watchlist, setWatchlist] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [stock, setStock] = useState(null);
  const [noteTab, setNoteTab] = useState('chart');
  const [showReadyBanner, setShowReadyBanner] = useState(false);
  const [discoveredFromInput, setDiscoveredFromInput] = useState('');
  const sepaFilledRef = useRef(false);
  const fileInputRef = useRef(null);

  const { data: stockApiData, loading: stockDataLoading } = useStockData(stock?.ticker);

  const saveStock = useCallback(
    (updated) => {
      const next = watchlist.map((s) => (String(s.id) === String(id) ? { ...s, ...updated, lastUpdated: new Date().toISOString() } : s));
      setWatchlist(next);
      saveData(username, 'watchlist', next);
      setStock((prev) => (prev ? { ...prev, ...updated, lastUpdated: new Date().toISOString() } : null));
    },
    [username, watchlist, id]
  );

  const updateNote = useCallback(
    (tabKey, json) => {
      const notes = { ...(stock?.notes || defaultNotes()), [tabKey]: json };
      saveStock({ notes });
    },
    [stock, saveStock]
  );

  const updatePlan = useCallback(
    (updates) => saveStock({ plan: { ...(stock?.plan || {}), ...updates } }),
    [stock?.plan, saveStock]
  );

  const handleFileUpload = useCallback(
    (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
      const maxSize = 5 * 1024 * 1024;
      const valid = files.filter((f) => {
        if (!allowed.includes(f.type)) { showToast(`⚠️ نوع غير مدعوم: ${f.name}`); return false; }
        if (f.size > maxSize) { showToast(`⚠️ الملف كبير جداً (الحد 5MB): ${f.name}`); return false; }
        return true;
      });
      if (!valid.length) return;
      Promise.all(valid.map((file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve({
            id: 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            name: file.name,
            type: file.type,
            size: file.size,
            data: ev.target.result,
            date: new Date().toISOString(),
          });
          reader.readAsDataURL(file);
        })
      )).then((newAttachments) => {
        const next = [...(stock?.attachments || []), ...newAttachments];
        saveStock({ attachments: next });
        showToast(`✅ تم رفع ${newAttachments.length} ملف`);
        if (fileInputRef.current) fileInputRef.current.value = '';
      });
    },
    [stock, saveStock, showToast]
  );

  const removeAttachment = useCallback(
    (attachId) => {
      const next = (stock?.attachments || []).filter((a) => a.id !== attachId);
      saveStock({ attachments: next });
    },
    [stock, saveStock]
  );

  const togglePhaseCheck = useCallback(
    (phase, index) => {
      if (!stock?.phases) return;
      const phases = JSON.parse(JSON.stringify(stock.phases));
      if (phases[phase]?.checks && Array.isArray(phases[phase].checks)) {
        phases[phase].checks[index] = !phases[phase].checks[index];
        const { readiness } = calcPhaseReadiness(phases);
        saveStock({ phases, readiness });
      }
    },
    [stock, saveStock]
  );

  const moveToReady = useCallback(() => {
    saveStock({ status: 'ready' });
    setShowReadyBanner(false);
    showToast(`✅ تم نقل ${stock?.ticker || ''} إلى قائمة جاهز للدخول`);
    navigate('/watchlist', { state: { tab: 'ready' } });
  }, [saveStock, navigate, stock?.ticker, showToast]);

  const moveToWatching = useCallback(() => {
    saveStock({ status: 'watching' });
    showToast('تم إرجاع السهم إلى المراقبة');
  }, [saveStock, showToast]);

  const handleExecute = useCallback(() => {
    navigate('/watchlist', { state: { executeStockId: id, tab: 'open' } });
  }, [navigate, id]);

  const handleDelete = useCallback(() => {
    if (!window.confirm('حذف هذا السهم من القائمة؟')) return;
    const next = watchlist.filter((w) => String(w.id) !== String(id));
    saveData(username, 'watchlist', next);
    setWatchlist(next);
    navigate('/watchlist');
    showToast('تم حذف السهم من القائمة');
  }, [watchlist, id, username, navigate, showToast]);

  const addStrategy = useCallback(
    (strategyId) => {
      const strategy = strategies.find((s) => String(s.id) === String(strategyId));
      if (!strategy) return;
      const nextIds = [...(stock?.strategies || []), strategyId].filter((id, i, a) => a.indexOf(id) === i);
      const newPhases = buildChecklistFromStrategy(strategy, stock?.phases);
      const { readiness } = calcPhaseReadiness(newPhases);
      saveStock({ strategies: nextIds, phases: newPhases, readiness });
      showToast(`✅ تم ربط ${strategy.name}`);
    },
    [strategies, stock, saveStock, showToast]
  );

  const removeStrategy = useCallback(
    (strategyId) => {
      const nextIds = (stock?.strategies || []).filter((sid) => String(sid) !== String(strategyId));
      let newPhases;
      if (nextIds.length === 0) {
        newPhases = JSON.parse(JSON.stringify(defaultPhases));
      } else {
        const nextStrategy = strategies.find((s) => String(s.id) === String(nextIds[0]));
        newPhases = nextStrategy ? buildChecklistFromStrategy(nextStrategy, stock?.phases) : JSON.parse(JSON.stringify(defaultPhases));
      }
      const { readiness } = calcPhaseReadiness(newPhases);
      saveStock({ strategies: nextIds, phases: newPhases, readiness });
      showToast('تم إزالة الاستراتيجية');
    },
    [strategies, stock, saveStock, showToast]
  );


  const toggleFundamentalCheck = useCallback(
    (strategyId, index) => {
      const key = String(strategyId);
      const current = stock?.fundamentalChecks?.[key] || [];
      const updated = [...current];
      updated[index] = !updated[index];
      saveStock({ fundamentalChecks: { ...(stock?.fundamentalChecks || {}), [key]: updated } });
    },
    [stock, saveStock]
  );

  const toggleStrategyPhaseCheck = useCallback(
    (strategyId, phase, index) => {
      const key = String(strategyId);
      const current = stock?.strategyChecks?.[key]?.[phase] || [];
      const updated = [...current];
      updated[index] = !updated[index];
      saveStock({
        strategyChecks: {
          ...(stock?.strategyChecks || {}),
          [key]: { ...(stock?.strategyChecks?.[key] || {}), [phase]: updated },
        },
      });
    },
    [stock, saveStock]
  );

  useEffect(() => {
    sepaFilledRef.current = false;
    setDiscoveredFromInput('');
  }, [id]);

  useEffect(() => {
    if (stock?.discoveredFrom != null) setDiscoveredFromInput(stock.discoveredFrom);
  }, [stock?.id]);

  useEffect(() => {
    if (!username) return;
    setWatchlist(loadWatchlist(username));
    setStrategies(loadData(username, 'strategies', []) || []);
  }, [username]);

  useEffect(() => {
    if (!id || !watchlist.length) {
      setStock(null);
      return;
    }
    const found = watchlist.find((s) => String(s.id) === String(id));
    setStock(found ? migrateStock(found) : null);
  }, [id, watchlist]);

  useEffect(() => {
    if (!stock?.phases) return;
    const { trendScore, patternScore } = calcPhaseReadiness(stock.phases);
    const shouldShow = trendScore >= 0.8 && patternScore >= 0.8 && stock.status !== 'ready';
    setShowReadyBanner(shouldShow);
  }, [stock?.phases, stock?.status]);

  useEffect(() => {
    if (!stockApiData?.sepa || !stock?.phases?.trend?.checks || sepaFilledRef.current) return;
    const s = stockApiData.sepa;
    const map = [
      s.price_above_ema200,
      s.ema200_trending_up,
      s.ema50_above_ema200,
      s.price_above_ema50,
      s.near_52w_high,
    ];
    const currentChecks = Array.isArray(stock.phases?.trend?.checks) ? stock.phases.trend.checks : [];
    const newChecks = currentChecks.map((c, i) => (map[i] !== undefined ? map[i] : c));
    if (JSON.stringify(newChecks) !== JSON.stringify(currentChecks)) {
      saveStock({ phases: { ...stock.phases, trend: { ...stock.phases.trend, checks: newChecks } } });
      sepaFilledRef.current = true;
    }
  }, [stockApiData, stock?.phases, saveStock]);

  if (!username) return null;
  if (watchlist.length > 0 && !stock) {
    return (
      <div className="p-6">
        <button type="button" onClick={() => navigate('/watchlist')} className="text-gold mb-4">← رجوع</button>
        <p className="text-muted">السهم غير موجود.</p>
      </div>
    );
  }
  if (!stock) {
    return (
      <div className="p-6">
        <p className="text-muted">جاري التحميل...</p>
      </div>
    );
  }

  const notes = stock.notes || defaultNotes();
  const phases = stock.phases || defaultPhases;
  const { trendScore, patternScore, readiness, trendDone, trendTotal, patternDone, patternTotal } = calcPhaseReadiness(phases);
  const plan = stock.plan || {};
  const trigger = plan.pivot ?? stock.trigger ?? 0;
  const stop = plan.stop ?? stock.stop ?? 0;
  const riskPerShare = trigger > 0 && stop < trigger ? trigger - stop : 0;
  const riskPct = Math.min(5, plan.riskPct ?? stock.riskPct ?? 2);
  const entryPlanMethod = (plan.rrMode ?? stock.entryPlanMethod) || 'resistance';
  const resistancePriceNum = typeof plan.resistance === 'number' && plan.resistance > 0 ? plan.resistance : (typeof stock.resistancePrice === 'number' && stock.resistancePrice > 0 ? stock.resistancePrice : null);
  const rrManual = typeof plan.rrManual === 'number' && plan.rrManual > 0 ? plan.rrManual : (typeof stock.rrManual === 'number' && stock.rrManual > 0 ? stock.rrManual : null);
  let rr = null;
  let targetPrice = null;
  if (entryPlanMethod === 'resistance' && resistancePriceNum != null && riskPerShare > 0) {
    rr = parseFloat(((resistancePriceNum - trigger) / riskPerShare).toFixed(1));
    targetPrice = resistancePriceNum;
  } else if (entryPlanMethod === 'manual' && rrManual != null && riskPerShare > 0) {
    rr = rrManual;
    targetPrice = parseFloat((trigger + rrManual * riskPerShare).toFixed(2));
  } else if (rrManual != null && riskPerShare > 0) {
    rr = rrManual;
    targetPrice = parseFloat((trigger + rrManual * riskPerShare).toFixed(2));
  }
  const distancePct = trigger > 0 && targetPrice != null ? parseFloat((((targetPrice - trigger) / trigger) * 100).toFixed(1)) : null;
  const shares = calcShares(portfolioSize, riskPct, trigger, stop);
  const riskAmount = riskPerShare * shares;
  const positionValue = shares * trigger;
  const positionPct = portfolioSize > 0 ? (positionValue / portfolioSize) * 100 : 0;
  const linkedStrategies = (stock.strategies || []).map((sid) => strategies.find((s) => String(s.id) === String(sid))).filter(Boolean);
  const linkedStrategy = linkedStrategies[0];
  const rrDisplay = rr != null ? `${rr}:1` : null;
  const rrClass = rr == null ? 'text-muted' : rr >= 3 ? 'text-teal' : rr >= 2 ? 'text-gold' : 'text-red';
  const rrMsg = rr == null ? 'أدخل القيم أعلاه' : rr >= 3 ? '✓ ممتاز' : rr >= 2 ? '✓ مقبول — الحد الأدنى لمينيرفيني' : '⚠️ ضعيف — مينيرفيني لا يدخل';

  const circleColor = readiness >= 80 ? '#10b981' : readiness >= 50 ? '#f0b429' : '#ef4444';
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (readiness / 100) * circumference;

  const statusLabel = stock.status === 'open' ? 'مفتوحة' : stock.status === 'closed' ? 'مغلقة' : stock.status === 'ready' ? 'جاهز للدخول' : 'قيد المراقبة';

  return (
    <div className="min-h-screen p-4 md:p-6">
      {/* Topbar */}
      <header className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <button type="button" onClick={() => navigate('/watchlist')} className="text-gold hover:underline shrink-0">
          ← رجوع
        </button>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="bg-gold/20 text-gold px-2 py-1 rounded font-mono text-sm">{stock.ticker}</span>
          <span className="text-fg font-medium">{stock.company}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${stock.status === 'ready' ? 'bg-teal/20 text-teal' : stock.status === 'open' ? 'bg-teal/20 text-teal' : stock.status === 'closed' ? 'bg-s2 text-muted' : 'bg-s2 text-muted'}`}>
            {statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              const html = generateStockReport(stock, strategies, stockApiData?.currentPrice ?? null);
              const win = window.open('', '_blank');
              if (win) { win.document.write(html); win.document.close(); }
            }}
            className="px-3 py-1.5 rounded-lg border border-border text-muted text-xs hover:text-fg hover:border-gold/40 transition-colors"
            title="تصدير تقرير PDF"
          >
            🖨 PDF
          </button>
          <span className="text-muted text-xs">الجاهزية</span>
          <svg width="60" height="60" className="rotate-[-90deg]">
            <circle cx="30" cy="30" r={radius} fill="none" stroke="#1e2438" strokeWidth="4" />
            <circle cx="30" cy="30" r={radius} fill="none" stroke={circleColor} strokeWidth="4" strokeDasharray={circumference} strokeDashoffset={circumference - strokeDash} strokeLinecap="round" />
          </svg>
          <span className="text-lg font-bold text-fg w-10 text-center">{readiness}%</span>
        </div>
      </header>

      {/* Phase transition buttons */}
      <div className="flex flex-wrap items-center gap-2 mb-4" dir="rtl">
        {stock.status === 'watching' && (
          <button
            type="button"
            onClick={() => navigate('/watchlist', { state: { openSmartEntryId: stock.id, tab: 'watching' } })}
            className="px-4 py-2 rounded-lg bg-gold text-black font-bold text-sm hover:bg-gold/90"
          >
            جاهز للدخول 🎯
          </button>
        )}
        {stock.status === 'ready' && (
          <>
            <button
              type="button"
              onClick={() => navigate('/watchlist', { state: { executeStockId: stock.id, tab: 'open' } })}
              className="px-4 py-2 rounded-lg bg-teal text-black font-bold text-sm hover:bg-teal/90"
            >
              دخلت الصفقة 📈
            </button>
            <button
              type="button"
              onClick={() => navigate('/watchlist', { state: { openSmartEntryId: stock.id, tab: 'ready' } })}
              className="px-4 py-2 rounded-lg border border-border text-muted text-sm hover:bg-s2"
            >
              ← تعديل الخطة
            </button>
          </>
        )}
        {stock.status === 'open' && (
          <button
            type="button"
            onClick={() => navigate('/watchlist', { state: { closeTradeId: stock.id, tab: 'open' } })}
            className="px-4 py-2 rounded-lg border border-red-500/50 text-red-400 text-sm hover:bg-red-500/10"
          >
            إغلاق الصفقة ✋
          </button>
        )}
        {stock.status === 'closed' && (
          <button
            type="button"
            onClick={() => navigate('/stats')}
            className="px-4 py-2 rounded-lg border border-border text-muted text-sm hover:bg-s2"
          >
            عرض التقرير 📊
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5">
        {/* LEFT — Notes + Attachments */}
        <div>
          <div className="flex gap-2 border-b border-border pb-2 mb-2 flex-wrap">
            {NOTE_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setNoteTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-sm ${noteTab === t.key ? 'bg-gold/20 text-gold border border-gold/50' : 'text-muted hover:text-fg border border-transparent'}`}
              >
                {t.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setNoteTab('attachments')}
              className={`px-3 py-1.5 rounded-lg text-sm ${noteTab === 'attachments' ? 'bg-gold/20 text-gold border border-gold/50' : 'text-muted hover:text-fg border border-transparent'}`}
            >
              📎 المرفقات {(stock?.attachments?.length ?? 0) > 0 ? `(${stock.attachments.length})` : ''}
            </button>
          </div>
          <div className="min-h-[350px]">
            {NOTE_TABS.filter((t) => t.key !== 'daily').map((t) => (
              <div key={t.key} className={noteTab === t.key ? '' : 'hidden'}>
                <RichEditor
                  content={getNoteContent(notes, t.key)}
                  onChange={(json) => updateNote(t.key, json)}
                  placeholder={t.placeholder}
                />
              </div>
            ))}
            <div className={noteTab === 'daily' ? '' : 'hidden'}>
              <DiaryTab
                diary={stock.diary || []}
                onSave={(d) => saveStock({ diary: d })}
              />
            </div>
            {noteTab === 'attachments' && (
              <div className="space-y-4">
                {/* Upload button */}
                <div
                  className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-gold/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const dt = { files: e.dataTransfer.files };
                    handleFileUpload({ target: dt });
                  }}
                >
                  <p className="text-muted text-sm mb-1">📎 اسحب الملفات هنا أو انقر للرفع</p>
                  <p className="text-muted text-xs">صور (PNG، JPG، GIF) أو PDF — الحد 5MB لكل ملف</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    multiple
                    className="sr-only"
                    onChange={handleFileUpload}
                  />
                </div>
                {/* Attachment list */}
                {(stock?.attachments || []).length === 0 && (
                  <p className="text-muted text-sm text-center py-4">لا توجد مرفقات بعد</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {(stock?.attachments || []).map((att) => (
                    <div key={att.id} className="relative bg-s2 border border-border rounded-xl overflow-hidden group">
                      {att.type?.startsWith('image/') ? (
                        <a href={att.data} target="_blank" rel="noopener noreferrer">
                          <img src={att.data} alt={att.name} className="w-full h-32 object-cover" />
                        </a>
                      ) : (
                        <a href={att.data} download={att.name} className="flex flex-col items-center justify-center h-32 gap-2 hover:bg-s3 transition-colors">
                          <span className="text-3xl">📄</span>
                          <span className="text-muted text-xs text-center px-2 truncate max-w-full">{att.name}</span>
                        </a>
                      )}
                      <div className="px-2 py-1.5 flex items-center justify-between">
                        <span className="text-muted text-xs truncate max-w-[70%]">{att.name}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(att.id)}
                          className="text-red text-xs hover:text-red/80 px-1"
                          title="حذف"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="px-2 pb-1.5">
                        <span className="text-muted text-[0.6rem]">
                          {new Date(att.date).toLocaleDateString('ar-SA')} · {(att.size / 1024).toFixed(0)}KB
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-4">

          {/* Open Trade Panel — top of right column for open trades */}
          {stock.status === 'open' && stock.trade?.entryPrice && (() => {
            const t = stock.trade;
            const ep = t.entryPrice ?? 0;
            const origStop = t.originalStop ?? plan.stop ?? 0;
            const curStop = t.currentStop ?? origStop;
            const sharesT = t.remainingShares ?? t.sharesActual ?? t.shares ?? 0;
            const rps = ep > 0 && origStop < ep ? ep - origStop : null;
            const curPrice = stockApiData?.currentPrice ?? t.lastKnownPrice ?? null;
            const curR = curPrice != null && rps ? (curPrice - ep) / rps : null;
            const posVal = curPrice != null ? curPrice * sharesT : null;
            const upnl = curPrice != null ? (curPrice - ep) * sharesT : null;
            const daysIn = t.entryDate ? Math.floor((Date.now() - new Date(t.entryDate).getTime()) / 86400000) : null;
            const rColor = curR == null ? 'text-muted' : curR >= 2 ? 'text-teal' : curR >= 0 ? 'text-gold' : 'text-red';
            const rBarPct = curR == null ? 0 : Math.max(0, Math.min(100, ((curR + 1) / 5) * 100));
            const rBarColor = curR == null ? '#555' : curR >= 2 ? '#10b981' : curR >= 0 ? '#f0b429' : '#ef4444';
            return (
              <section className="bg-s1 border border-teal/50 rounded-xl p-4" style={{ borderRightWidth: 4, borderRightColor: '#10b981' }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-teal font-semibold text-sm">📈 الصفقة المفتوحة</h3>
                  {daysIn != null && <span className="text-muted text-xs">{daysIn} يوم</span>}
                </div>

                {/* R progress bar */}
                {curR != null && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted">الأداء الحالي</span>
                      <span className={`font-mono font-bold ${rColor}`}>{curR >= 0 ? '+' : ''}{curR.toFixed(2)}R</span>
                    </div>
                    <div className="h-2 bg-s2 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${rBarPct}%`, background: rBarColor }} />
                    </div>
                    <div className="flex justify-between text-[0.6rem] text-muted mt-0.5">
                      <span>-1R</span><span>0</span><span>+1R</span><span>+2R</span><span>+4R</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <span className="text-muted">سعر الدخول</span>
                  <span className="font-mono text-fg">${ep.toFixed(2)}</span>
                  {curPrice != null && <><span className="text-muted">السعر الحالي</span><span className="font-mono text-fg">${curPrice}</span></>}
                  <span className="text-muted">الوقف الأصلي</span>
                  <span className="font-mono text-red">${origStop > 0 ? origStop.toFixed(2) : '—'}</span>
                  <span className="text-muted">الوقف الحالي</span>
                  <span className="font-mono text-gold">${curStop > 0 ? curStop.toFixed(2) : '—'}</span>
                  <span className="text-muted">الأسهم</span>
                  <span className="font-mono text-fg">{sharesT}</span>
                  {posVal != null && <><span className="text-muted">قيمة المركز</span><span className="font-mono text-fg">${posVal.toFixed(0)}</span></>}
                  {upnl != null && (
                    <>
                      <span className="text-muted">ربح/خسارة غير محقق</span>
                      <span className={`font-mono font-semibold ${upnl >= 0 ? 'text-teal' : 'text-red'}`}>
                        {upnl >= 0 ? '+' : ''}${upnl.toFixed(0)}
                      </span>
                    </>
                  )}
                  {t.entryDate && <><span className="text-muted">تاريخ الدخول</span><span className="font-mono text-fg">{new Date(t.entryDate).toLocaleDateString('ar-SA')}</span></>}
                </div>

                {t.stopHistory?.length > 0 && (
                  <div className="border-t border-border mt-3 pt-2">
                    <p className="text-muted text-xs mb-1">تحركات الوقف:</p>
                    <div className="flex flex-wrap gap-2">
                      {t.stopHistory.map((sh, i) => (
                        <span key={i} className="text-xs bg-s2 px-2 py-0.5 rounded text-gold font-mono">
                          ${typeof sh.stop === 'number' ? sh.stop.toFixed(2) : sh.stop ?? '—'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {t.partialExits?.length > 0 && (
                  <div className="border-t border-border mt-2 pt-2">
                    <p className="text-muted text-xs mb-1">خروجات جزئية:</p>
                    {t.partialExits.map((pe, i) => (
                      <div key={i} className="flex justify-between text-xs text-muted">
                        <span>{pe.date ? new Date(pe.date).toLocaleDateString('ar-SA') : `#${i + 1}`}</span>
                        <span className="font-mono">{pe.shares ?? '—'} سهم @ ${pe.price?.toFixed(2) ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })()}

          {/* Section 0 — المشاعر + أين وجدت السهم */}
          <section className="bg-s1 border border-border rounded-xl p-4">
            <h3 className="text-fg font-medium mb-3 text-sm">المشاعر والمصدر</h3>
            {/* Sentiment */}
            <div className="mb-3">
              <p className="text-muted text-xs mb-2">المشاعر تجاه السهم</p>
              <div className="flex flex-wrap gap-2">
                {SENTIMENTS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => saveStock({ sentiment: stock?.sentiment === s.key ? null : s.key })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-all ${
                      stock?.sentiment === s.key
                        ? 'bg-gold/20 border-gold/60 text-fg font-medium'
                        : 'bg-s2 border-border text-muted hover:border-gold/40 hover:text-fg'
                    }`}
                    title={s.label}
                  >
                    <span className="text-base">{s.emoji}</span>
                    <span className="text-xs">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
            {/* Discovered From */}
            <div>
              <p className="text-muted text-xs mb-1">أين وجدت هذا السهم؟</p>
              <div className="flex gap-2">
                <select
                  value={DISCOVERED_FROM_OPTIONS.includes(discoveredFromInput) ? discoveredFromInput : (discoveredFromInput ? 'أخرى' : '')}
                  onChange={(e) => {
                    if (e.target.value === 'أخرى') {
                      setDiscoveredFromInput('');
                    } else {
                      setDiscoveredFromInput(e.target.value);
                      saveStock({ discoveredFrom: e.target.value || null });
                    }
                  }}
                  className="flex-1 bg-s2 border border-border rounded-lg px-3 py-1.5 text-fg text-sm"
                  dir="rtl"
                >
                  <option value="">اختر المصدر...</option>
                  {DISCOVERED_FROM_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
                {!DISCOVERED_FROM_OPTIONS.slice(0, -1).includes(discoveredFromInput) && (
                  <input
                    type="text"
                    value={discoveredFromInput}
                    onChange={(e) => setDiscoveredFromInput(e.target.value)}
                    onBlur={() => saveStock({ discoveredFrom: discoveredFromInput || null })}
                    placeholder="اكتب المصدر..."
                    className="flex-1 bg-s2 border border-border rounded-lg px-3 py-1.5 text-fg text-sm"
                    dir="rtl"
                  />
                )}
              </div>
            </div>
          </section>

          {/* Section 1 — الاستراتيجيات */}
          <section className="bg-s1 border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-fg font-medium">الاستراتيجيات المرتبطة</h3>
              <select
                className="bg-s2 border border-border rounded px-2 py-1 text-sm text-fg"
                onChange={(e) => { const v = e.target.value; if (v) { addStrategy(Number(v)); e.target.value = ''; } }}
                value=""
              >
                <option value="">+ إضافة استراتيجية</option>
                {strategies.filter((s) => !(stock.strategies || []).some((id) => String(id) === String(s.id))).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {linkedStrategies.length === 0 ? (
              <p className="text-muted text-sm text-center py-4">لا توجد استراتيجية مرتبطة — أضف استراتيجية لتظهر شروطها هنا</p>
            ) : (
              <div className="space-y-4">
                {linkedStrategies.map((strategy) => {
                  const phases = buildGroupedChecklist(strategy);
                  const summary = getStrategySummary(strategy);
                  const fundItems = summary.fundamental.map((l) => l.replace(/^✓\s*/, ''));
                  const fundChecks = stock?.fundamentalChecks?.[String(strategy.id)] || [];
                  const stratChecks = stock?.strategyChecks?.[String(strategy.id)] || {};

                  // Add financial phase
                  const allPhases = fundItems.length
                    ? [...phases, { key: 'fundamental', label: '💰 الشروط المالية', color: 'text-blue-300', groups: [{ label: '', items: fundItems }] }]
                    : phases;

                  const totalAll = allPhases.reduce((s, ph) => s + ph.groups.reduce((ss, g) => ss + g.items.length, 0), 0);
                  const doneAll = allPhases.reduce((s, ph) => {
                    const ch = ph.key === 'fundamental' ? fundChecks : (stratChecks[ph.key] || []);
                    return s + ch.filter(Boolean).length;
                  }, 0);
                  const allPct = totalAll ? doneAll / totalAll : 0;

                  return (
                    <div key={strategy.id} className="border border-border rounded-xl overflow-hidden">
                      {/* Strategy header */}
                      <div className="flex items-center justify-between px-3 py-2 bg-s2">
                        <div className="flex items-center gap-2">
                          <span className="text-gold font-semibold text-sm">{strategy.name}</span>
                          <span className={`text-xs font-mono ${allPct >= 1 ? 'text-teal' : 'text-muted'}`}>
                            {doneAll}/{totalAll} {allPct >= 1 ? '✅' : ''}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeStrategy(strategy.id)}
                          className="text-muted hover:text-red-400 text-xs px-1"
                        >
                          إزالة ×
                        </button>
                      </div>
                      {/* Progress bar */}
                      {totalAll > 0 && (
                        <div className="h-1 bg-s3">
                          <div className="h-full bg-teal transition-all" style={{ width: `${allPct * 100}%` }} />
                        </div>
                      )}
                      {/* Phase checklists with sub-groups */}
                      <div className="p-3 space-y-3">
                        {allPhases.map(({ key, label, color, groups, empty }) => {
                          const isFinancial = key === 'fundamental';
                          const phaseChecks = isFinancial ? fundChecks : (stratChecks[key] || []);
                          const totalInPhase = groups.reduce((s, g) => s + g.items.length, 0);
                          const done = phaseChecks.filter(Boolean).length;

                          // Skip non-pattern empty phases
                          if (totalInPhase === 0 && !empty) return null;

                          // Compute cumulative offsets for sub-groups
                          let offset = 0;
                          const groupsWithOffset = groups.map((g) => {
                            const start = offset;
                            offset += g.items.length;
                            return { ...g, start };
                          });

                          return (
                            <div key={key} className="bg-s2/50 rounded-lg p-2.5">
                              {/* Phase header */}
                              <div className="flex items-center justify-between mb-2">
                                <p className={`${color} font-semibold text-xs`}>{label}</p>
                                {totalInPhase > 0 && (
                                  <span className={`text-xs font-mono ${done === totalInPhase ? 'text-teal' : 'text-muted'}`}>
                                    {done}/{totalInPhase}
                                  </span>
                                )}
                              </div>
                              {/* Empty pattern placeholder */}
                              {empty && (
                                <p className="text-muted text-xs italic">
                                  لم يتم تحديد نموذج — عدّل الاستراتيجية واختر النماذج من قسم «شروط الدخول»
                                </p>
                              )}
                              {/* Sub-groups */}
                              {!empty && (
                              <div className="space-y-2">
                                {groupsWithOffset.map(({ label: groupLabel, items, start }) => (
                                  <div key={groupLabel || start}>
                                    {groupLabel && (
                                      <p className="text-[0.6rem] text-muted/70 font-medium uppercase tracking-wide mb-1 px-0.5">
                                        ﹏ {groupLabel}
                                      </p>
                                    )}
                                    <ul className="space-y-1">
                                      {items.map((item, i) => {
                                        const idx = start + i;
                                        const checked = isFinancial ? !!fundChecks[idx] : !!(phaseChecks[idx]);
                                        return (
                                          <label key={i} className="flex items-center gap-2 cursor-pointer hover:bg-s1/60 rounded px-1 py-0.5 -mx-1">
                                            <span
                                              className="w-3.5 h-3.5 rounded border flex items-center justify-center text-[0.6rem] bg-s1 flex-shrink-0 transition-colors"
                                              style={{ borderColor: checked ? '#10b981' : undefined, color: checked ? '#10b981' : undefined }}
                                            >
                                              {checked ? '✓' : ''}
                                            </span>
                                            <input
                                              type="checkbox"
                                              className="sr-only"
                                              checked={checked}
                                              onChange={() =>
                                                isFinancial
                                                  ? toggleFundamentalCheck(strategy.id, idx)
                                                  : toggleStrategyPhaseCheck(strategy.id, key, idx)
                                              }
                                            />
                                            <span className={checked ? 'text-teal font-medium text-xs' : 'text-fg/90 text-xs'}>
                                              {item}
                                            </span>
                                          </label>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {stockDataLoading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                background: 'var(--s2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: '0.75rem',
                color: 'var(--muted2)',
                marginBottom: 12,
              }}
            >
              <span className="animate-pulse inline-block w-2 h-2 rounded-full bg-gold" />
              جاري تحميل بيانات {stock?.ticker}...
            </div>
          )}

          {stockApiData && !stockDataLoading && (
            <div
              style={{
                background: 'var(--s2)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '12px 14px',
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    fontSize: '0.58rem',
                    letterSpacing: '1.5px',
                    color: 'var(--muted)',
                    textTransform: 'uppercase',
                  }}
                >
                  البيانات الحية
                </span>
                <span
                  style={{
                    fontFamily: 'IBM Plex Mono',
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: (stockApiData.changePct ?? 0) >= 0 ? 'var(--teal)' : 'var(--red)',
                  }}
                >
                  ${stockApiData.currentPrice}
                  <span style={{ fontSize: '0.7rem', marginRight: 6 }}>
                    {(stockApiData.changePct ?? 0) >= 0 ? '+' : ''}
                    {stockApiData.changePct ?? '—'}%
                  </span>
                </span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 6,
                  marginBottom: 10,
                }}
              >
                {[
                  ['RSI(14)', stockApiData.rsi?.rsi14, (stockApiData.rsi?.rsi14 >= 50 && stockApiData.rsi?.rsi14 <= 80) ? 'teal' : 'red'],
                  ['EMA 200', `$${stockApiData.moving_averages?.ema200}`, stockApiData.sepa?.price_above_ema200 ? 'teal' : 'red'],
                  ['EMA 50', `$${stockApiData.moving_averages?.ema50}`, stockApiData.sepa?.price_above_ema50 ? 'teal' : 'red'],
                  ['EMA 21', `$${stockApiData.moving_averages?.ema21}`, null],
                  ['حجم/MA', `${stockApiData.volume?.ratio}x`, stockApiData.volume?.ratio >= 1 ? 'teal' : 'red'],
                  ['52w High', `$${stockApiData.high52w}`, null],
                ].map(([label, val, color]) => (
                  <div key={label} style={{ background: 'var(--s3)', borderRadius: 6, padding: '6px 8px' }}>
                    <div style={{ fontSize: '0.52rem', color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
                    <div
                      style={{
                        fontFamily: 'IBM Plex Mono',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: color ? `var(--${color})` : 'var(--text)',
                      }}
                    >
                      {val ?? '—'}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {[
                  ['فوق EMA200', stockApiData.sepa?.price_above_ema200],
                  ['EMA200 صاعد', stockApiData.sepa?.ema200_trending_up],
                  ['EMA50>200', stockApiData.sepa?.ema50_above_ema200],
                  ['فوق EMA50', stockApiData.sepa?.price_above_ema50],
                  ['قرب القمة', stockApiData.sepa?.near_52w_high],
                  ['Volume Dry', stockApiData.sepa?.volume_dry_up],
                ].map(([label, val]) => (
                  <span
                    key={label}
                    style={{
                      fontSize: '0.6rem',
                      padding: '2px 7px',
                      borderRadius: 20,
                      background: val ? 'rgba(6,214,160,0.12)' : 'rgba(239,71,111,0.10)',
                      color: val ? 'var(--teal)' : 'var(--red)',
                      border: `1px solid ${val ? 'rgba(6,214,160,0.25)' : 'rgba(239,71,111,0.2)'}`,
                    }}
                  >
                    {val ? '✓' : '✗'} {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Plan summary — ready only */}
          {stock.status === 'ready' && trigger > 0 && stop > 0 && (
            <section className="bg-s1 border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-fg font-medium text-sm">ملخص الخطة</h3>
                <button
                  type="button"
                  onClick={() => navigate('/watchlist', { state: { tab: 'ready' } })}
                  className="text-gold text-xs hover:underline"
                >
                  تعديل الخطة →
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted">
                <div>Pivot</div>
                <div className="font-mono text-fg">${trigger}</div>
                <div>Stop</div>
                <div className="font-mono text-fg">${stop}</div>
                {rr != null && (
                  <>
                    <div>R:R</div>
                    <div className={`font-mono ${rr >= 3 ? 'text-teal' : rr >= 2 ? 'text-gold' : 'text-red'}`}>{rr}:1</div>
                  </>
                )}
                <div>الأسهم</div>
                <div className="font-mono text-fg">{shares}</div>
                <div>المخاطرة</div>
                <div className="font-mono text-fg">${riskAmount?.toFixed(0)} ({riskPct}%)</div>
              </div>
            </section>
          )}

          {/* Section 2 — Phase cards (shown only when NO strategy is linked) */}
          {linkedStrategies.length === 0 && ['trend', 'pattern', 'entry', 'exit'].map((phaseKey) => {
            const phase = phases[phaseKey];
            if (!phase) return null;
            // Exit phase: show for ready, open, closed (not watching)
            if (phaseKey === 'exit' && stock.status === 'watching') return null;
            const items = phase.items || [];
            const checks = phase.checks || [];
            const noRulesInPhase = phase.fromStrategy && items.length === 0;
            const done = checks.filter(Boolean).length;
            const total = Math.max(items.length, checks.length);
            const pct = total ? done / total : 0;
            const isExit = phaseKey === 'exit';
            const isOpen = stock.status === 'open';
            const accentColor = isExit ? '#ef4444' : phaseKey === 'trend' ? '#10b981' : phaseKey === 'pattern' ? '#3b82f6' : '#f0b429';
            const textColor = isExit ? 'text-red-400' : pct >= 1 ? 'text-teal' : pct > 0.5 ? 'text-gold' : 'text-muted';
            const statusBadge = noRulesInPhase ? '' : pct >= 1 ? '✅ مكتمل' : pct > 0.5 ? '⏳ قيد الإكمال' : '○ لم يبدأ';
            return (
              <section
                key={phaseKey}
                className={`bg-s1 border rounded-xl p-4 border-r-4 ${isExit && isOpen ? 'ring-1 ring-red-500/30' : ''}`}
                style={{ borderRightColor: accentColor, borderColor: isExit && isOpen ? undefined : '' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-fg font-medium">{phase.label}</h3>
                    {isExit && isOpen && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-medium">نشط</span>
                    )}
                  </div>
                  {!noRulesInPhase && <span className="text-muted text-xs">{done}/{total}</span>}
                </div>
                {noRulesInPhase ? (
                  <p className="text-muted text-sm">لا توجد شروط محددة في هذه الاستراتيجية لهذه المرحلة</p>
                ) : (
                  <>
                    {statusBadge && <p className={`text-xs mb-2 ${textColor}`}>{statusBadge}</p>}
                    <ul className="space-y-1">
                      {items.map((label, i) => (
                        <label key={i} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-s2/50 rounded px-1 py-0.5 -mx-1">
                          <span
                            className="w-4 h-4 rounded border flex items-center justify-center text-xs bg-s2 flex-shrink-0"
                            style={{ borderColor: checks[i] ? accentColor : undefined }}
                          >
                            {checks[i] ? '☑' : '☐'}
                          </span>
                          <input type="checkbox" checked={!!checks[i]} onChange={() => togglePhaseCheck(phaseKey, i)} className="sr-only" />
                          <span className={checks[i] ? 'line-through text-muted' : ''}>{label}</span>
                        </label>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            );
          })}

          {/* Section 3 — خطة الدخول (watching / ready only) */}
          {(stock.status === 'watching' || stock.status === 'ready') && (
          <section className="bg-s1 border border-border rounded-xl p-4 border-r-4 border-r-gold">
            <h3 className="text-fg font-medium mb-3">خطة الدخول</h3>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="text-muted text-xs">Trigger</label>
                <input type="number" step="0.01" value={trigger || ''} onChange={(e) => updatePlan({ pivot: parseFloat(e.target.value) || 0 })} className="w-full bg-s2 border border-gold/50 rounded px-2 py-1 text-fg font-mono text-sm" dir="ltr" />
              </div>
              <div>
                <label className="text-muted text-xs">Stop</label>
                <input type="number" step="0.01" value={stop || ''} onChange={(e) => updatePlan({ stop: parseFloat(e.target.value) || 0 })} className="w-full bg-s2 border border-red/50 rounded px-2 py-1 text-fg font-mono text-sm" dir="ltr" />
              </div>
            </div>
            <div className="flex gap-2 mb-3 border-b border-border pb-2">
              <button
                type="button"
                onClick={() => updatePlan(targetPrice != null && entryPlanMethod === 'rr' ? { rrMode: 'resistance', resistance: targetPrice } : { rrMode: 'resistance' })}
                className={`px-3 py-1.5 rounded text-sm ${entryPlanMethod === 'resistance' ? 'bg-gold/20 text-gold border-b-2 border-gold' : 'text-muted border-b-2 border-transparent'}`}
              >
                سعر المقاومة
              </button>
              <button
                type="button"
                onClick={() => updatePlan(rr != null && entryPlanMethod === 'resistance' ? { rrMode: 'rr', rrManual: rr } : { rrMode: 'rr' })}
                className={`px-3 py-1.5 rounded text-sm ${entryPlanMethod === 'rr' ? 'bg-gold/20 text-gold border-b-2 border-gold' : 'text-muted border-b-2 border-transparent'}`}
              >
                R:R مباشرة
              </button>
            </div>
            {entryPlanMethod === 'resistance' && (
              <div className="mb-3">
                <label className="text-muted text-xs">مقاومة $</label>
                <input type="number" step="0.01" value={resistancePriceNum != null ? resistancePriceNum : ''} onChange={(e) => updatePlan({ resistance: parseFloat(e.target.value) || null })} className="w-full bg-s2 border border-border rounded px-2 py-1 text-fg font-mono text-sm" dir="ltr" placeholder="مثال: 215.00" />
                <p className="text-muted text-[0.65rem] mt-0.5">حددها من الشارت — قمة سابقة أو مستوى مقاومة</p>
              </div>
            )}
            {entryPlanMethod === 'rr' && (
              <div className="mb-3">
                <label className="text-muted text-xs">R:R</label>
                <input type="number" step="0.1" min="0.5" value={rrManual != null ? rrManual : ''} onChange={(e) => updatePlan({ rrManual: parseFloat(e.target.value) || null })} className="w-full bg-s2 border border-border rounded px-2 py-1 text-fg font-mono text-sm" dir="ltr" placeholder="مثال: 2.5" />
                <p className="text-muted text-[0.65rem] mt-0.5">سعر الهدف يُحسب تلقائياً</p>
              </div>
            )}
            <div className="bg-s2 rounded-lg p-3 mb-2 text-sm space-y-1">
              <p>R:R المبدئي: {rrDisplay != null ? <span className={`font-mono font-medium ${rrClass}`}>{rrDisplay}</span> : <span className="text-muted text-xs">{rrMsg}</span>}{rrDisplay != null && <span className={`text-xs ${rrClass} mr-1`}> {rrMsg}</span>}</p>
              {targetPrice != null && <p>سعر الهدف المرجعي: <span className="font-mono text-gold">${targetPrice.toFixed(2)}</span></p>}
              {distancePct != null && <p>المسافة للهدف: <span className="font-mono">{distancePct}%</span></p>}
              <p className="text-muted text-[0.65rem] mt-1">* الهدف مرجعي فقط — الخروج يعتمد على سلوك السهم</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <p className="text-muted text-xs">الأسهم</p>
              <p className="font-mono text-gold">{shares}</p>
              <p className="text-muted text-xs">قيمة المركز</p>
              <p className="font-mono">${positionValue.toFixed(0)} ({positionPct.toFixed(1)}%)</p>
              <p className="text-muted text-xs">المخاطرة $</p>
              <p className="font-mono">${riskAmount.toFixed(0)} ({riskPct}%)</p>
            </div>
            {linkedStrategy?.exitRules && (
              <div className="mt-3 pt-3 border-t border-border">
                <h4 className="text-muted text-sm mb-2">📋 خطة الخروج — من الاستراتيجية</h4>
                {linkedStrategy.exitRules?.partialExits?.filter((pe) => pe.enabled).length > 0 && (
                  <p className="text-teal text-xs mb-1">🎯 أهداف جزئية: {linkedStrategy.exitRules?.partialExits?.filter((pe) => pe.enabled).map((pe) => `خروج ${pe.pct}% عند +${pe.atR}R`).join(' · ')}</p>
                )}
                {linkedStrategy.exitRules?.behaviorExits?.filter((be) => be.enabled).length > 0 && (
                  <ul className="text-muted text-xs space-y-0.5">
                    {linkedStrategy.exitRules?.behaviorExits?.filter((be) => be.enabled).map((be) => (
                      <li key={be.id}>• {be.text}</li>
                    ))}
                  </ul>
                )}
                <a href="/strategies" className="text-xs text-gold hover:underline mt-1 inline-block">تعديل في الاستراتيجية ↗</a>
              </div>
            )}
            {linkedStrategies.length === 0 && (
              <p className="text-muted text-xs mt-2">ارتبط باستراتيجية لتظهر خطة الخروج تلقائياً. <a href="/strategies" className="text-gold hover:underline">اختر استراتيجية ↗</a></p>
            )}
            <button type="button" onClick={handleExecute} className="w-full py-3 rounded-lg bg-gold text-black font-bold text-sm hover:bg-gold/90">
              ⚡ تنفيذ
            </button>
          </section>
          )}

          {/* Section 4 — الإجراءات */}
          <div className="flex flex-wrap gap-2">
            {(stock.status === 'watching' || stock.status === 'ready') && (
              <button type="button" onClick={moveToReady} className="px-4 py-2 rounded-lg bg-gold/20 text-gold border border-gold/50 text-sm font-medium hover:bg-gold/30">
                ✅ نقل إلى جاهز للدخول
              </button>
            )}
            {stock.status === 'ready' && (
              <button type="button" onClick={moveToWatching} className="px-4 py-2 rounded-lg border border-border text-muted text-sm hover:bg-s2">
                📋 رجوع للمراقبة
              </button>
            )}
            <button type="button" onClick={handleDelete} className="px-4 py-2 rounded-lg border border-red/50 text-red text-sm hover:bg-red/10">
              🗑 حذف من القائمة
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation banner — fixed bottom */}
      {showReadyBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gold/95 text-black p-4 shadow-lg animate-slide-up flex flex-wrap items-center justify-center gap-4">
          <p className="font-medium text-center">
            🎯 الاتجاه والنموذج مكتملان! هل تريد نقل {stock.ticker} إلى قائمة جاهز للدخول؟
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowReadyBanner(false)} className="px-4 py-2 rounded-lg bg-black/10 hover:bg-black/20">
              تجاهل الآن
            </button>
            <button type="button" onClick={moveToReady} className="px-4 py-2 rounded-lg bg-black text-gold font-bold hover:bg-black/90">
              ✅ نقل إلى جاهز للدخول
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { loadData, saveData } from '../utils/storage';
import { useToast } from '../components/ui/Toast';
import Modal from '../components/ui/Modal';
import { initialStrategyForm, migrateFormToStrategy, buildTagsFromStrategy, migrateStrategy, buildExitRulesForStrategy } from '../utils/strategySchema';
import { defaultTrendConditions, defaultEntryConditions, defaultExecutionConditions, flattenExecutionToChecklist, inflateChecklistToExecution, TREND_PRESETS, ENTRY_PRESETS } from '../utils/technicalConditionsSchema';
import StrategyBuilderPage from './StrategyBuilderPage';

const _minFund = (eps25, rev20, float50, instInc, earn14) => ({
  eps: {
    quarterlyGrowth: { enabled: !!eps25, value: eps25 || 25 },
    annualGrowth:    { enabled: !!eps25, value: eps25 || 25 },
    acceleration:    { enabled: !!eps25 },
    beatEstimates:   { enabled: false, value: 5 },
  },
  revenue: {
    quarterlyGrowth: { enabled: !!rev20, value: rev20 || 20 },
    annualGrowth:    { enabled: !!rev20, value: rev20 || 20 },
    acceleration:    { enabled: !!rev20 },
  },
  margins:     { netMargin: { enabled: false, value: 0 }, grossMargin: { enabled: false, value: 0 } },
  balance:     { deRatio: { enabled: false, value: 1.5 }, float: { enabled: !!float50, value: float50 || 50 } },
  institutional: { ownership: { enabled: false, value: 10 }, increasing: { enabled: !!instInc } },
  earnings:    { daysToNext: { enabled: !!earn14, value: earn14 || 14 } },
});

const DEFAULT_STRATEGIES = [
  {
    id: 1, name: 'Minervini Core', type: 'mixed', icon: '📈', timeframe: 'Swing',
    tags: ['VCP', 'Pivot Breakout', 'EPS+25%', 'RS≥85'],
    stats: { winRate: 71, avgR: 2.8, profitFactor: 3.2, trades: 28, rrMin: 3 },
    trendConditions: TREND_PRESETS.minervini,
    entryConditions: { ...defaultEntryConditions(), patterns: ENTRY_PRESETS.minervini.patterns, volumeAtEntry: { enabled: true, pct: 40 } },
    executionConditions: defaultExecutionConditions(),
    fundamental: _minFund(25, 20, 50, true, 14),
    exitRules: {},
  },
  {
    id: 2, name: "O'Neil CANSLIM", type: 'mixed', icon: '🔭', timeframe: 'Swing',
    tags: ['Cup & Handle', 'Flat Base', 'EPS+25%', 'RS≥90'],
    stats: { winRate: 67, avgR: 2.2, profitFactor: 2.7, trades: 15, rrMin: 2.5 },
    trendConditions: TREND_PRESETS.oneil,
    entryConditions: { ...defaultEntryConditions(), patterns: ENTRY_PRESETS.oneil.patterns, volumeAtEntry: { enabled: true, pct: 50 } },
    executionConditions: defaultExecutionConditions(),
    fundamental: _minFund(25, 20, null, true, 14),
    exitRules: {},
  },
  {
    id: 3, name: 'RSI Momentum', type: 'technical', icon: '⚡', timeframe: 'Swing',
    tags: ['RSI 50-70', 'EMA 200', 'Volume Surge', 'OBV صاعد'],
    stats: { winRate: 59, avgR: 1.9, profitFactor: 2.1, trades: 22, rrMin: 2 },
    trendConditions: TREND_PRESETS.momentum,
    entryConditions: { ...defaultEntryConditions(), patterns: ENTRY_PRESETS.momentum.patterns, volumeAtEntry: { enabled: true, pct: 30 } },
    executionConditions: defaultExecutionConditions(),
    fundamental: _minFund(15, null, null, false, null),
    exitRules: {},
  },
];

const STEPS = ['الأساس', 'الفني', 'المالي', 'المخاطر والخروج', 'مراجعة'];
const TYPE_OPTIONS = [
  { key: 'technical', label: '📊 فني فقط' },
  { key: 'fundamental', label: '💰 مالي فقط' },
  { key: 'mixed', label: '⚡ مزيج الاثنين' },
];
const TIMEFRAME_OPTIONS = ['Swing', 'Position', 'Day Trade'];
const INSPIRED_OPTIONS = ['Mark Minervini', 'William O\'Neil', 'RSI Strategy', 'مخصص تماماً'];
const MA_OPTIONS_1 = ['200 EMA', '200 SMA', '150 SMA', '50 EMA'];
const MA_OPTIONS_2 = ['50 EMA', '21 EMA', '10 EMA'];
const MA_OPTIONS_3 = ['200', '150', '100'];
const MA_OPTIONS_4 = ['21', '50'];
const MA_OPTIONS_5 = ['4 أسابيع', '8 أسابيع', '12 أسبوع'];
const RSI_DIVERGENCE = ['Bullish', 'Bearish'];
const VOLUME_DRY = ['مطلوب', 'اختياري'];
const PRICE_PATTERNS = ['VCP', 'Cup & Handle', 'Pivot Breakout', 'High Tight Flag', 'Flat Base', 'Double Bottom', 'RSI Bounce', 'EMA Pullback'];
const INDICATOR_OPTIONS = ['MACD', 'Stochastic', 'ATR', 'Bollinger Bands', 'ADX', 'Williams %R', 'CCI', 'Ichimoku', 'Parabolic SAR', 'مؤشر مخصص'];
const CONDITION_OPTIONS = ['يتقاطع فوق', 'يتقاطع تحت', 'أكبر من', 'أصغر من', 'صاعد', 'هابط', 'في منطقة', 'يكسر فوق', 'يكسر تحت'];
const TIMEFRAME_IND = ['يومي', 'أسبوعي', '4 ساعات', 'ساعة', 'شهري'];

const initialFormData = () => ({ ...initialStrategyForm(), timeframe: 'Swing' });
const FUNDAMENTAL_CONDITIONS = ['أكبر من', 'أصغر من', 'يساوي', 'في تحسن', 'في تراجع', 'مطلوب'];
const EMA_OPTIONS = ['10', '21', '50'];
const EMA_OPTIONS_STOP = ['10 EMA', '21 EMA', '50 EMA'];

export default function Strategies({ user }) {
  const username = user?.username || '';
  const { showToast } = useToast();
  const [strategies, setStrategies] = useState([]);
  const [view, setView] = useState('list'); // 'list' | 'builder' | 'detail'
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState(initialFormData);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [shareStrategy, setShareStrategy] = useState(null);
  const [shareUrl, setShareUrl] = useState('');
  const [importStrategy, setImportStrategy] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('strategy');
    if (!encoded || !username) return;
    try {
      const strategy = JSON.parse(decodeURIComponent(escape(atob(encoded))));
      setImportStrategy(strategy);
      window.history.replaceState({}, '', window.location.pathname);
    } catch (e) {
      showToast('رابط غير صحيح', 'error');
    }
  }, [username, showToast]);

  useEffect(() => {
    if (!username) return;
    const stored = loadData(username, 'strategies', null);
    const list = (stored && Array.isArray(stored)) ? stored : DEFAULT_STRATEGIES;
    // Auto-save defaults for new users who have no strategies yet
    if (!stored || !Array.isArray(stored) || stored.length === 0) {
      saveData(username, 'strategies', DEFAULT_STRATEGIES);
    }
    // Upgrade legacy default strategies (id 1/2/3) that lack trendConditions
    const upgraded = list.map((s) => {
      const def = DEFAULT_STRATEGIES.find((d) => d.id === s.id);
      if (def && !s.trendConditions) return { ...def, ...s, trendConditions: def.trendConditions, entryConditions: s.entryConditions || def.entryConditions, executionConditions: s.executionConditions || def.executionConditions, fundamental: s.fundamental || def.fundamental };
      return s;
    });
    setStrategies(upgraded.map(migrateStrategy));
  }, [username]);

  const saveStrategies = (next) => {
    setStrategies(next);
    saveData(username, 'strategies', next);
  };

  const openBuilder = (strategy = null) => {
    if (strategy) {
      const migrated = migrateFormToStrategy(strategy.formData || strategy);
      const trendConditions = strategy.trendConditions && typeof strategy.trendConditions.price === 'object'
        ? strategy.trendConditions
        : defaultTrendConditions();
      const entryConditions = strategy.entryConditions && Array.isArray(strategy.entryConditions.patterns)
        ? strategy.entryConditions
        : { ...defaultEntryConditions(), patterns: strategy.entryPatterns || migrated.entryPatterns || [] };
      const executionConditions = strategy.executionConditions?.groups?.length
        ? strategy.executionConditions
        : inflateChecklistToExecution(strategy.executionChecklist || migrated.executionChecklist || []);
      setFormData({
        ...migrated,
        trendConditions,
        entryConditions,
        executionConditions,
        executionChecklist: flattenExecutionToChecklist(executionConditions),
        inspirations: strategy.inspirations || migrated.inspirations || [],
      });
      setEditingId(strategy.id);
    } else {
      const initial = initialFormData();
      const execDefault = defaultExecutionConditions();
      setFormData({
        ...initial,
        trendConditions: defaultTrendConditions(),
        entryConditions: defaultEntryConditions(),
        executionConditions: execDefault,
        executionChecklist: flattenExecutionToChecklist(execDefault),
        inspirations: [],
      });
      setEditingId(null);
    }
    setView('builder');
    setCurrentStep(1);
  };

  const openDetail = (s) => {
    setSelectedStrategy(s);
    setView('detail');
  };

  const backToList = () => {
    setView('list');
    setSelectedStrategy(null);
    setEditingId(null);
  };

  const handleSaveStrategy = () => {
    const name = (formData.name || '').trim();
    if (!name) {
      showToast('أدخل اسم الاستراتيجية', 'error');
      return;
    }
    const tags = buildTagsFromStrategy(formData);
    const { _presetBannerNames, ...formDataToSave } = formData;
    const newStrategy = {
      id: editingId || Date.now(),
      name,
      type: formData.type,
      icon: formData.type === 'technical' ? '📊' : formData.type === 'fundamental' ? '💰' : '⚡',
      stats: { winRate: 0, avgR: 0, profitFactor: 0, trades: 0, rrMin: formData.risk?.minRR ?? 2 },
      tags,
      technical: formData.technical,
      fundamental: formData.fundamental,
      risk: formData.risk,
      exitRules: buildExitRulesForStrategy(formData),
      trendConditions: formData.trendConditions,
      entryConditions: formData.entryConditions,
      executionConditions: formData.executionConditions,
      executionChecklist: (formData.executionConditions && formData.executionConditions.groups?.length)
        ? flattenExecutionToChecklist(formData.executionConditions)
        : (formData.executionChecklist || []),
      entryPatterns: formData.entryConditions?.patterns || formData.entryPatterns || [],
      inspirations: formData.inspirations,
      rsRating: formData.rsRating,
      formData: formDataToSave,
    };
    let next;
    if (editingId) {
      next = strategies.map((s) => (s.id === editingId ? newStrategy : s));
    } else {
      next = [...strategies, newStrategy];
    }
    saveStrategies(next);
    backToList();
    showToast(`✅ تم حفظ استراتيجية ${name}`, 'success');
  };

  const duplicateStrategy = (s) => {
    const copy = { ...s, id: Date.now(), name: `نسخة من ${s.name}` };
    saveStrategies([...strategies, copy]);
    showToast('تم نسخ الاستراتيجية', 'info');
  };

  const deleteStrategy = (s) => {
    if (!window.confirm(`حذف "${s.name}"؟`)) return;
    saveStrategies(strategies.filter((x) => x.id !== s.id));
    if (selectedStrategy?.id === s.id) backToList();
    showToast('تم الحذف', 'info');
  };

  const handleShare = (s) => {
    const toShare = {
      ...s,
      sharedBy: username || 'مستخدم',
      sharedAt: new Date().toISOString(),
      version: '1.0',
    };
    const json = JSON.stringify(toShare);
    const encoded = btoa(unescape(encodeURIComponent(json)));
    const url = window.location.origin + window.location.pathname + '?strategy=' + encoded;
    setShareUrl(url);
    setShareStrategy(s);
    try {
      navigator.clipboard.writeText(url);
      showToast('تم نسخ الرابط', 'success');
    } catch (_) {}
  };

  return (
    <div className="min-h-screen">
      {view === 'list' && (
        <>
          <header className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-border px-6 py-4 flex items-center justify-between flex-wrap gap-2">
            <h1 className="font-display text-xl text-fg">⬡ Strategy Builder</h1>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setView('list')} className="px-4 py-2 rounded-lg border border-border text-fg hover:bg-s2">
                قائمة الاستراتيجيات
              </button>
              <button type="button" onClick={() => openBuilder()} className="px-4 py-2 rounded-lg bg-gold text-black font-bold hover:bg-gold/90">
                + بناء استراتيجية
              </button>
            </div>
          </header>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {strategies.map((s) => (
                <div
                  key={s.id}
                  onClick={() => openDetail(s)}
                  className="bg-s1 border border-border rounded-xl p-4 cursor-pointer hover:border-gold/50 transition-colors relative"
                >
                  <div className="absolute top-2 left-2">
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleShare(s); }} className="px-2 py-1 rounded-lg border border-border text-muted text-xs hover:bg-s2 hover:text-gold">
                      🔗 مشاركة
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{s.icon}</span>
                    <h2 className="font-display text-gold text-lg">{s.name}</h2>
                  </div>
                  <span className="inline-block px-2 py-0.5 rounded text-xs bg-s2 text-muted mb-2">{s.type}</span>
                  <div className="flex flex-wrap gap-2 text-sm text-muted mb-2">
                    <span>Win {s.stats?.winRate ?? 0}%</span>
                    <span>Avg R {s.stats?.avgR ?? 0}</span>
                    <span>PF {s.stats?.profitFactor ?? 0}</span>
                    <span>R:R Min {s.stats?.rrMin ?? 0}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(s.tags || []).map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded bg-s2 text-xs text-fg">{t}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-s1 border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border text-muted text-sm">مقارنة</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted text-right border-b border-border">
                      <th className="px-4 py-2 font-medium">الاستراتيجية</th>
                      <th className="px-4 py-2 font-medium">النوع</th>
                      <th className="px-4 py-2 font-medium">Win Rate</th>
                      <th className="px-4 py-2 font-medium">Avg R</th>
                      <th className="px-4 py-2 font-medium">Profit Factor</th>
                      <th className="px-4 py-2 font-medium">R:R Min</th>
                      <th className="px-4 py-2 font-medium">الصفقات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {strategies.map((s) => (
                      <tr key={s.id} onClick={() => openDetail(s)} className="border-b border-border/50 hover:bg-s2/50 cursor-pointer text-right">
                        <td className="px-4 py-2 font-mono text-gold">{s.name}</td>
                        <td className="px-4 py-2">{s.type}</td>
                        <td className="px-4 py-2">{s.stats?.winRate ?? 0}%</td>
                        <td className="px-4 py-2">{s.stats?.avgR ?? 0}</td>
                        <td className="px-4 py-2">{s.stats?.profitFactor ?? 0}</td>
                        <td className="px-4 py-2">{s.stats?.rrMin ?? 0}</td>
                        <td className="px-4 py-2">{s.stats?.trades ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {view === 'builder' && (
        <StrategyBuilderPage
          formData={formData}
          setFormData={setFormData}
          onSave={handleSaveStrategy}
          onBack={backToList}
          showToast={showToast}
        />
      )}

      {view === 'detail' && selectedStrategy && (
        <StrategyDetail
          strategy={selectedStrategy}
          onEdit={() => openBuilder(selectedStrategy)}
          onDuplicate={() => duplicateStrategy(selectedStrategy)}
          onDelete={() => deleteStrategy(selectedStrategy)}
          onShare={() => handleShare(selectedStrategy)}
          onBack={backToList}
        />
      )}

      {shareStrategy && (
        <Modal open={!!shareStrategy} onClose={() => setShareStrategy(null)} title="🔗 تمت المشاركة">
          <div className="space-y-4">
            <p className="text-fg text-sm">تم نسخ الرابط — أرسله لأي شخص وسيستطيع نسخ استراتيجيتك والتعديل عليها.</p>
            <input type="text" readOnly value={shareUrl} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg text-sm" dir="ltr" />
            <div className="flex gap-2">
              <button type="button" onClick={() => { navigator.clipboard.writeText(shareUrl); showToast('تم النسخ مجدداً'); }} className="px-4 py-2 rounded-lg border border-gold text-gold hover:bg-gold/10">نسخ مجدداً</button>
              <button type="button" onClick={() => setShareStrategy(null)} className="px-4 py-2 rounded-lg bg-gold text-black font-bold">إغلاق</button>
            </div>
          </div>
        </Modal>
      )}

      {importStrategy && (
        <Modal open={!!importStrategy} onClose={() => setImportStrategy(null)} title="📥 استراتيجية مشتركة" size="lg">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{importStrategy.icon || '📈'}</span>
              <div>
                <h3 className="font-display text-gold text-lg">{importStrategy.name}</h3>
                {importStrategy.sharedBy && <p className="text-muted text-sm">من: {importStrategy.sharedBy}</p>}
              </div>
            </div>
            <div className="bg-s2 rounded-lg p-3 text-sm">
              <p className="text-muted mb-1">الملخص:</p>
              <p className="text-fg">✓ {(importStrategy.trendConditions || []).filter((c) => c.enabled).length} شرط اتجاه</p>
              <p className="text-fg">✓ {(importStrategy.entryPatterns || []).length} نموذج دخول</p>
              <p className="text-fg">✓ {(importStrategy.executionChecklist || []).filter((i) => i.enabled).length} بند تنفيذ</p>
              <p className="text-fg">✓ مستوى المخاطرة: {importStrategy.risk?.maxRiskPct ?? 2}%</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const newStrategy = {
                    ...importStrategy,
                    id: Date.now(),
                    name: (importStrategy.name || 'استراتيجية') + ' (نسخة)',
                    importedFrom: importStrategy.sharedBy,
                    createdBy: username,
                  };
                  saveStrategies([...strategies, newStrategy]);
                  showToast(`✅ تم استيراد ${newStrategy.name}`, 'success');
                  setImportStrategy(null);
                  setSelectedStrategy(newStrategy);
                  setView('detail');
                }}
                className="px-4 py-2 rounded-lg bg-gold text-black font-bold"
              >
                استيراد ونسخ
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedStrategy(importStrategy);
                  setView('detail');
                  setImportStrategy(null);
                }}
                className="px-4 py-2 rounded-lg border border-gold text-gold hover:bg-gold/10"
              >
                عرض فقط
              </button>
              <button type="button" onClick={() => setImportStrategy(null)} className="px-4 py-2 rounded-lg border border-border text-fg hover:bg-s2">
                إلغاء
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StrategyBuilder({ formData, setFormData, currentStep, setCurrentStep, onSave, onBack }) {
  const update = (path, value) => {
    setFormData((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const parts = path.split('.');
      let o = next;
      for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]] = o[parts[i]] || {};
      o[parts[parts.length - 1]] = value;
      return next;
    });
  };

  const toggleArray = (path, item) => {
    setFormData((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const arr = path.split('.').reduce((o, k) => o[k], next);
      const idx = arr.indexOf(item);
      if (idx >= 0) arr.splice(idx, 1);
      else arr.push(item);
      return next;
    });
  };

  const addCustomIndicator = () => {
    setFormData((prev) => ({
      ...prev,
      technical: {
        ...prev.technical,
        customIndicators: [
          ...(prev.technical?.customIndicators || []),
          { enabled: true, indicator: 'MACD', condition: 'يتقاطع فوق', value: '', timeframe: 'يومي', customName: '' },
        ],
      },
    }));
  };

  const updateCustomIndicator = (index, field, value) => {
    setFormData((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const arr = next.technical?.customIndicators || [];
      if (arr[index]) arr[index] = { ...arr[index], [field]: value };
      return next;
    });
  };

  const removeCustomIndicator = (index) => {
    setFormData((prev) => ({
      ...prev,
      technical: {
        ...prev.technical,
        customIndicators: (prev.technical?.customIndicators || []).filter((_, i) => i !== index),
      },
    }));
  };

  const addCustomFundamentalRule = () => {
    setFormData((prev) => ({
      ...prev,
      fundamental: {
        ...prev.fundamental,
        customRules: [...(prev.fundamental?.customRules || []), { enabled: false, name: '', condition: 'أكبر من', value: '' }],
      },
    }));
  };

  const updateCustomFundamentalRule = (index, field, value) => {
    setFormData((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const arr = next.fundamental?.customRules || [];
      if (arr[index]) arr[index] = { ...arr[index], [field]: value };
      return next;
    });
  };

  const removeCustomFundamentalRule = (index) => {
    setFormData((prev) => ({
      ...prev,
      fundamental: {
        ...prev.fundamental,
        customRules: (prev.fundamental?.customRules || []).filter((_, i) => i !== index),
      },
    }));
  };

  const t = formData.technical || {};
  const f = formData.fundamental || {};
  const r = formData.risk || {};
  const exitRules = formData.exitRules || {};
  const ma = Array.isArray(t.ma) ? t.ma : [
    { enabled: false, label: 'السعر فوق', value: '200 EMA' },
    { enabled: false, label: 'السعر فوق', value: '50 EMA' },
    { enabled: false, label: 'EMA 50 فوق EMA', value: '200' },
    { enabled: false, label: 'EMA 10 فوق EMA', value: '21' },
    { enabled: false, label: '200 EMA صاعد منذ', value: '4 أسابيع' },
  ];
  const updateMa = (index, field, value) => {
    setFormData((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next.technical) next.technical = {};
      if (!next.technical.ma) next.technical.ma = [...ma];
      next.technical.ma[index] = { ...next.technical.ma[index], [field]: value };
      return next;
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button type="button" onClick={onBack} className="text-muted hover:text-fg">← رجوع</button>
        <h1 className="font-display text-gold text-xl">بناء استراتيجية</h1>
      </div>
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setCurrentStep(i + 1)}
            className={`shrink-0 px-3 py-2 rounded-lg text-sm font-medium ${
              currentStep === i + 1 ? 'bg-gold text-black' : 'bg-s2 text-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {currentStep === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-muted text-sm mb-1">اسم الاستراتيجية *</label>
            <input value={formData.name} onChange={(e) => update('name', e.target.value)} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" placeholder="اسم الاستراتيجية" dir="rtl" />
          </div>
          <div>
            <label className="block text-muted text-sm mb-1">الوصف</label>
            <textarea value={formData.description} onChange={(e) => update('description', e.target.value)} rows={3} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg" dir="rtl" />
          </div>
          <div>
            <label className="block text-muted text-sm mb-2">النوع</label>
            <div className="flex gap-2 flex-wrap">
              {TYPE_OPTIONS.map((o) => (
                <button key={o.key} type="button" onClick={() => update('type', o.key)} className={`px-4 py-2 rounded-lg border ${formData.type === o.key ? 'border-gold bg-gold/20 text-gold' : 'border-border text-muted'}`}>{o.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-muted text-sm mb-2">الإطار الزمني</label>
            <div className="flex gap-2 flex-wrap">
              {TIMEFRAME_OPTIONS.map((opt) => (
                <button key={opt} type="button" onClick={() => update('timeframe', opt)} className={`px-4 py-2 rounded-lg border ${formData.timeframe === opt ? 'border-gold bg-gold/20 text-gold' : 'border-border text-muted'}`}>{opt}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-muted text-sm mb-2">مستوحى من</label>
            <div className="flex gap-2 flex-wrap">
              {INSPIRED_OPTIONS.map((opt) => (
                <button key={opt} type="button" onClick={() => toggleArray('inspired', opt)} className={`px-4 py-2 rounded-lg border ${(formData.inspired || []).includes(opt) ? 'border-teal bg-teal/20 text-teal' : 'border-border text-muted'}`}>{opt}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-gold font-medium mb-3">المتوسطات المتحركة</h3>
              {[
                { opts: MA_OPTIONS_1 },
                { opts: MA_OPTIONS_2 },
                { opts: MA_OPTIONS_3 },
                { opts: MA_OPTIONS_4 },
                { opts: MA_OPTIONS_5 },
              ].map((row, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <input type="checkbox" checked={!!ma[i]?.enabled} onChange={(e) => updateMa(i, 'enabled', e.target.checked)} className="rounded" />
                  <span className="text-sm text-muted w-32">{(ma[i] && ma[i].label) || ''}</span>
                  <select value={(ma[i] && ma[i].value) || row.opts[0]} onChange={(e) => updateMa(i, 'value', e.target.value)} className="flex-1 bg-s2 border border-border rounded px-2 py-1 text-fg text-sm">
                    {row.opts.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <h3 className="text-gold font-medium mt-4 mb-2">RSI</h3>
              <div className="flex items-center gap-2 mb-2">
                <input type="checkbox" checked={!!t.rsi?.enabled} onChange={(e) => update('technical.rsi.enabled', e.target.checked)} className="rounded" />
                <span className="text-sm text-muted">RSI بين</span>
                <input type="number" value={t.rsi?.min ?? 50} onChange={(e) => update('technical.rsi.min', Number(e.target.value))} className="w-16 bg-s2 border border-border rounded px-2 py-1 text-fg" dir="ltr" />
                <span className="text-muted">و</span>
                <input type="number" value={t.rsi?.max ?? 75} onChange={(e) => update('technical.rsi.max', Number(e.target.value))} className="w-16 bg-s2 border border-border rounded px-2 py-1 text-fg" dir="ltr" />
              </div>
            </div>
            <div>
              <h3 className="text-gold font-medium mb-3">الحجم</h3>
              <div className="flex items-center gap-2 mb-2">
                <input type="checkbox" checked={!!t.volume?.breakout?.enabled} onChange={(e) => update('technical.volume.breakout.enabled', e.target.checked)} className="rounded" />
                <span className="text-sm text-muted">حجم الاختراق +</span>
                <input type="number" value={t.volume?.breakout?.value ?? 40} onChange={(e) => update('technical.volume.breakout.value', Number(e.target.value))} className="w-16 bg-s2 border border-border rounded px-2 py-1 text-fg" dir="ltr" />
                <span>%</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <input type="checkbox" checked={!!t.volume?.dryUp?.enabled} onChange={(e) => update('technical.volume.dryUp.enabled', e.target.checked)} className="rounded" />
                <span className="text-sm text-muted">Volume Dry-Up</span>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <input type="checkbox" checked={!!t.volume?.obv?.enabled} onChange={(e) => update('technical.volume.obv.enabled', e.target.checked)} className="rounded" />
                <span className="text-sm text-muted">On-Balance Volume صاعد</span>
              </div>
              <h3 className="text-gold font-medium mb-2">أنماط السعر</h3>
              <div className="flex flex-wrap gap-2">
                {PRICE_PATTERNS.map((p) => (
                  <button key={p} type="button" onClick={() => { const arr = t.patterns || []; const next = arr.includes(p) ? arr.filter((x) => x !== p) : [...arr, p]; update('technical.patterns', next); }} className={`px-3 py-1 rounded border text-sm ${(t.patterns || []).includes(p) ? 'border-teal bg-teal/20 text-teal' : 'border-border text-muted'}`}>{p}</button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-4">
                <input type="checkbox" checked={!!t.rsRating?.enabled} onChange={(e) => update('technical.rsRating.enabled', e.target.checked)} className="rounded" />
                <span className="text-sm text-muted">RS Rating ≥</span>
                <input type="number" value={t.rsRating?.value ?? 80} onChange={(e) => update('technical.rsRating.value', Number(e.target.value))} className="w-16 bg-s2 border border-border rounded px-2 py-1 text-fg" dir="ltr" />
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-6">
            <h3 className="text-gold font-medium mb-2">⚙️ مؤشرات مخصصة — أضف شرطك الخاص</h3>
            <button type="button" onClick={addCustomIndicator} className="mb-4 px-4 py-2 rounded-lg border border-gold text-gold hover:bg-gold/10">+ إضافة مؤشر</button>
            {(t.customIndicators || []).map((ind, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 mb-3 p-3 bg-s2 rounded-lg animate-[fadeIn_0.2s_ease-out]">
                <input type="checkbox" checked={ind.enabled} onChange={(e) => updateCustomIndicator(i, 'enabled', e.target.checked)} className="rounded" />
                <select value={ind.indicator} onChange={(e) => updateCustomIndicator(i, 'indicator', e.target.value)} className="bg-s3 border border-border rounded px-2 py-1 text-fg text-sm">
                  {INDICATOR_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                {ind.indicator === 'مؤشر مخصص' && <input value={ind.customName} onChange={(e) => updateCustomIndicator(i, 'customName', e.target.value)} className="w-32 bg-s3 border border-border rounded px-2 py-1 text-fg text-sm" placeholder="الاسم" dir="rtl" />}
                <select value={ind.condition} onChange={(e) => updateCustomIndicator(i, 'condition', e.target.value)} className="bg-s3 border border-border rounded px-2 py-1 text-fg text-sm">
                  {CONDITION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <input value={ind.value} onChange={(e) => updateCustomIndicator(i, 'value', e.target.value)} className="w-28 bg-s3 border border-border rounded px-2 py-1 text-fg text-sm" placeholder="القيمة أو الوصف..." dir="rtl" />
                <select value={ind.timeframe} onChange={(e) => updateCustomIndicator(i, 'timeframe', e.target.value)} className="bg-s3 border border-border rounded px-2 py-1 text-fg text-sm">
                  {TIMEFRAME_IND.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <button type="button" onClick={() => removeCustomIndicator(i)} className="text-red hover:bg-red/20 rounded px-2 py-1">✕</button>
              </div>
            ))}
            <p className="text-muted text-sm">💡 يمكنك إضافة أي مؤشر — سيظهر في الـ Checklist عند فتح كل صفقة</p>
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Column 1 — الأرباح والإيرادات */}
            <div className="bg-s1 border border-border rounded-xl p-4">
              <h3 className="text-gold font-medium mb-3 border-b border-border pb-2">الأرباح والإيرادات</h3>
              <h4 className="text-fg text-sm mb-2 mt-2">EPS</h4>
              {[
                { path: 'eps.quarterlyGrowth', label: 'نمو EPS الفصلي ≥', def: 25, suf: '%' },
                { path: 'eps.annualGrowth', label: 'نمو EPS السنوي ≥', def: 20, suf: '%' },
                { path: 'eps.acceleration', label: 'تسارع نمو EPS (فصل عن فصل)' },
                { path: 'eps.beatEstimates', label: 'EPS فاق التوقعات بـ ≥', def: 5, suf: '%' },
              ].map((row) => (
                <div key={row.path} className="flex items-center gap-2 mb-2">
                  <input type="checkbox" checked={!!f.eps?.[row.path.split('.')[1]]?.enabled} onChange={(e) => update('fundamental.' + row.path + '.enabled', e.target.checked)} className="rounded" />
                  <span className="text-sm text-muted">{row.label}</span>
                  {row.def != null && (
                    <>
                      <input type="number" value={f.eps?.[row.path.split('.')[1]]?.value ?? row.def} onChange={(e) => update('fundamental.' + row.path + '.value', Number(e.target.value))} className="w-14 bg-s2 border border-border rounded px-2 py-1 text-fg text-sm" dir="ltr" />
                      {row.suf && <span>{row.suf}</span>}
                    </>
                  )}
                </div>
              ))}
              <h4 className="text-fg text-sm mb-2 mt-3">الإيرادات</h4>
              {[
                { path: 'revenue.quarterlyGrowth', label: 'نمو الإيرادات الفصلي ≥', def: 20, suf: '%' },
                { path: 'revenue.annualGrowth', label: 'نمو الإيرادات السنوي ≥', def: 15, suf: '%' },
                { path: 'revenue.acceleration', label: 'تسارع نمو الإيرادات' },
              ].map((row) => (
                <div key={row.path} className="flex items-center gap-2 mb-2">
                  <input type="checkbox" checked={!!f.revenue?.[row.path.split('.')[1]]?.enabled} onChange={(e) => update('fundamental.' + row.path + '.enabled', e.target.checked)} className="rounded" />
                  <span className="text-sm text-muted">{row.label}</span>
                  {row.def != null && <><input type="number" value={f.revenue?.[row.path.split('.')[1]]?.value ?? row.def} onChange={(e) => update('fundamental.' + row.path + '.value', Number(e.target.value))} className="w-14 bg-s2 border border-border rounded px-2 py-1 text-fg text-sm" dir="ltr" />{row.suf && <span>{row.suf}</span>}</>}
                </div>
              ))}
            </div>
            {/* Column 2 — الهوامش والميزانية */}
            <div className="bg-s1 border border-border rounded-xl p-4">
              <h3 className="text-gold font-medium mb-3 border-b border-border pb-2">الهوامش والميزانية</h3>
              <h4 className="text-fg text-sm mb-2 mt-2">الهوامش</h4>
              {[
                { path: 'margins.netMargin', label: 'هامش الربح الصافي ≥', def: 0, suf: '%' },
                { path: 'margins.grossMargin', label: 'هامش الربح الإجمالي ≥', def: 0, suf: '%' },
                { path: 'margins.netMarginImproving', label: 'هامش الربح الصافي في تحسن مستمر' },
              ].map((row) => (
                <div key={row.path} className="flex items-center gap-2 mb-2">
                  <input type="checkbox" checked={!!(f.margins && f.margins[row.path.split('.')[1]]?.enabled)} onChange={(e) => update('fundamental.' + row.path + '.enabled', e.target.checked)} className="rounded" />
                  <span className="text-sm text-muted">{row.label}</span>
                  {row.def != null && <><input type="number" step="0.1" value={f.margins?.[row.path.split('.')[1]]?.value ?? row.def} onChange={(e) => update('fundamental.' + row.path + '.value', Number(e.target.value))} className="w-14 bg-s2 border border-border rounded px-2 py-1 text-fg text-sm" dir="ltr" />{row.suf && <span className="text-muted text-xs">{row.suf}</span>}</>}
                </div>
              ))}
              <h4 className="text-fg text-sm mb-2 mt-3">الميزانية</h4>
              {[
                { path: 'balance.deRatio', label: 'نسبة الدين للأصول D/E ≤', def: 1.5 },
                { path: 'balance.float', label: 'عدد الأسهم المتداولة Float ≤', def: 50, suf: 'مليون' },
                { path: 'balance.currentRatio', label: 'نسبة السيولة الحالية ≥', def: 1.5 },
              ].map((row) => (
                <div key={row.path} className="flex items-center gap-2 mb-2">
                  <input type="checkbox" checked={!!(f.balance && f.balance[row.path.split('.')[1]]?.enabled)} onChange={(e) => update('fundamental.' + row.path + '.enabled', e.target.checked)} className="rounded" />
                  <span className="text-sm text-muted">{row.label}</span>
                  {row.def != null && <><input type="number" step="0.1" value={f.balance?.[row.path.split('.')[1]]?.value ?? row.def} onChange={(e) => update('fundamental.' + row.path + '.value', Number(e.target.value))} className="w-14 bg-s2 border border-border rounded px-2 py-1 text-fg text-sm" dir="ltr" />{row.suf && <span className="text-muted text-xs"> {row.suf}</span>}</>}
                </div>
              ))}
            </div>
            {/* Column 3 — المؤسسيون والتوقيت + قواعد مخصصة */}
            <div className="bg-s1 border border-border rounded-xl p-4">
              <h3 className="text-gold font-medium mb-3 border-b border-border pb-2">المؤسسيون والتوقيت</h3>
              <h4 className="text-fg text-sm mb-2 mt-2">المؤسسيون</h4>
              {[
                { path: 'institutional.ownership', label: 'نسبة ملكية المؤسسيين ≥', def: 30, suf: '%' },
                { path: 'institutional.increasing', label: 'المؤسسيون يزيدون ملكيتهم' },
                { path: 'institutional.newFunds', label: 'عدد صناديق جديدة دخلت ≥', def: 1 },
              ].map((row) => (
                <div key={row.path} className="flex items-center gap-2 mb-2">
                  <input type="checkbox" checked={!!(f.institutional && f.institutional[row.path.split('.')[1]]?.enabled)} onChange={(e) => update('fundamental.' + row.path + '.enabled', e.target.checked)} className="rounded" />
                  <span className="text-sm text-muted">{row.label}</span>
                  {row.def != null && !row.label.includes('يزيدون') && <><input type="number" value={f.institutional?.[row.path.split('.')[1]]?.value ?? row.def} onChange={(e) => update('fundamental.' + row.path + '.value', Number(e.target.value))} className="w-14 bg-s2 border border-border rounded px-2 py-1 text-fg text-sm" dir="ltr" />{row.suf && <span className="text-muted text-xs"> {row.suf}</span>}</>}
                </div>
              ))}
              <h4 className="text-fg text-sm mb-2 mt-3">التوقيت</h4>
              {[
                { path: 'earnings.recentWeeks', label: 'آخر نتائج فصلية منذ ≤', def: 8, suf: 'أسابيع' },
                { path: 'earnings.daysToNext', label: 'موعد النتائج القادمة بعد ≥', def: 14, suf: 'يوم' },
                { path: 'earnings.roe', label: 'ROE ≥', def: 15, suf: '%' },
              ].map((row) => (
                <div key={row.path} className="flex items-center gap-2 mb-2">
                  <input type="checkbox" checked={!!(f.earnings && f.earnings[row.path.split('.')[1]]?.enabled)} onChange={(e) => update('fundamental.' + row.path + '.enabled', e.target.checked)} className="rounded" />
                  <span className="text-sm text-muted">{row.label}</span>
                  {row.def != null && <><input type="number" value={f.earnings?.[row.path.split('.')[1]]?.value ?? row.def} onChange={(e) => update('fundamental.' + row.path + '.value', Number(e.target.value))} className="w-14 bg-s2 border border-border rounded px-2 py-1 text-fg text-sm" dir="ltr" />{row.suf && <span className="text-muted text-xs"> {row.suf}</span>}</>}
                </div>
              ))}
              <h4 className="text-fg text-sm mb-2 mt-3">قواعد مالية مخصصة</h4>
              <button type="button" onClick={addCustomFundamentalRule} className="mb-3 px-3 py-1.5 rounded-lg border border-gold text-gold text-sm hover:bg-gold/10">+ إضافة شرط مالي</button>
              {(f.customRules || []).map((rule, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 mb-3 p-2 bg-s2 rounded-lg animate-[fadeIn_0.2s_ease-out]">
                  <input type="checkbox" checked={!!rule.enabled} onChange={(e) => updateCustomFundamentalRule(i, 'enabled', e.target.checked)} className="rounded" />
                  <input type="text" value={rule.name || ''} onChange={(e) => updateCustomFundamentalRule(i, 'name', e.target.value)} className="flex-1 min-w-[120px] bg-s3 border border-border rounded px-2 py-1 text-fg text-sm" placeholder="اسم الشرط مثال: P/E أقل من متوسط القطاع" dir="rtl" />
                  <select value={rule.condition || 'أكبر من'} onChange={(e) => updateCustomFundamentalRule(i, 'condition', e.target.value)} className="bg-s3 border border-border rounded px-2 py-1 text-fg text-sm">
                    {FUNDAMENTAL_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input type="text" value={rule.value || ''} onChange={(e) => updateCustomFundamentalRule(i, 'value', e.target.value)} className="w-24 bg-s3 border border-border rounded px-2 py-1 text-fg text-sm" placeholder="القيمة..." dir="rtl" />
                  <button type="button" onClick={() => removeCustomFundamentalRule(i)} className="text-red hover:bg-red/20 rounded px-1">✕</button>
                </div>
              ))}
            </div>
          </div>
          {/* نقاط الأساسيات — bottom bar */}
          {(() => {
            const toggles = [
              f.eps?.quarterlyGrowth?.enabled, f.eps?.annualGrowth?.enabled, f.eps?.acceleration?.enabled, f.eps?.beatEstimates?.enabled,
              f.revenue?.quarterlyGrowth?.enabled, f.revenue?.annualGrowth?.enabled, f.revenue?.acceleration?.enabled,
              f.margins?.netMargin?.enabled, f.margins?.grossMargin?.enabled, f.margins?.netMarginImproving?.enabled,
              f.balance?.deRatio?.enabled, f.balance?.float?.enabled, f.balance?.currentRatio?.enabled,
              f.institutional?.ownership?.enabled, f.institutional?.increasing?.enabled, f.institutional?.newFunds?.enabled,
              f.earnings?.recentWeeks?.enabled, f.earnings?.daysToNext?.enabled, f.earnings?.roe?.enabled,
              ...(f.customRules || []).map((r) => r.enabled),
            ];
            const total = 19 + (f.customRules || []).length;
            const active = toggles.filter(Boolean).length;
            const pct = total ? Math.round((active / total) * 100) : 0;
            const barColor = pct >= 70 ? 'bg-teal' : pct >= 40 ? 'bg-gold' : 'bg-red';
            return (
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between mb-1 text-sm">
                  <span className="text-muted">نقاط الأساسيات:</span>
                  <span className={`font-mono font-medium ${pct >= 70 ? 'text-teal' : pct >= 40 ? 'text-gold' : 'text-red'}`}>{active}/{total}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden bg-s2">
                  <div className={`h-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {currentStep === 4 && (
        <div className="space-y-8">
          {/* Section A — إدارة المخاطر: 4 meta boxes */}
          <div>
            <h3 className="text-gold font-medium mb-3">إدارة المخاطر</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-s1 border border-border rounded-xl p-4">
                <label className="block text-muted text-sm mb-1">Max Risk/Trade</label>
                <div className="flex items-center gap-1">
                  <input type="number" value={r.maxRiskPct ?? 2} onChange={(e) => update('risk.maxRiskPct', Number(e.target.value))} className="w-16 bg-s2 border border-border rounded px-2 py-2 text-fg" dir="ltr" />
                  <span className="text-muted">%</span>
                </div>
              </div>
              <div className="bg-s1 border border-border rounded-xl p-4">
                <label className="block text-muted text-sm mb-1">Min R:R</label>
                <div className="flex items-center gap-1">
                  <input type="number" step="0.1" value={r.minRR ?? 3} onChange={(e) => update('risk.minRR', Number(e.target.value))} className="w-16 bg-s2 border border-border rounded px-2 py-2 text-fg" dir="ltr" />
                  <span className="text-muted">:1</span>
                </div>
              </div>
              <div className="bg-s1 border border-border rounded-xl p-4">
                <label className="block text-muted text-sm mb-1">Max Open Trades</label>
                <input type="number" value={r.maxOpenTrades ?? 5} onChange={(e) => update('risk.maxOpenTrades', Number(e.target.value))} className="w-16 bg-s2 border border-border rounded px-2 py-2 text-fg" dir="ltr" />
              </div>
              <div className="bg-s1 border border-border rounded-xl p-4">
                <label className="block text-muted text-sm mb-1">Max Exposure</label>
                <div className="flex items-center gap-1">
                  <input type="number" value={r.maxExposure ?? 50} onChange={(e) => update('risk.maxExposure', Number(e.target.value))} className="w-16 bg-s2 border border-border rounded px-2 py-2 text-fg" dir="ltr" />
                  <span className="text-muted">%</span>
                </div>
              </div>
            </div>
          </div>
          {/* Section B — قواعد الخروج: 2 columns */}
          <div>
            <h3 className="text-gold font-medium mb-3">قواعد الخروج</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-s1 border border-red/30 rounded-xl p-4 border-r-4" style={{ borderRightColor: 'rgba(239,68,68,0.5)' }}>
                <h4 className="text-fg font-medium mb-3">متى تقطع الخسارة (Stop Rules)</h4>
                <div className="space-y-3">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={!!exitRules.stop?.underLastContraction?.enabled} onChange={(e) => update('exitRules.stop.underLastContraction.enabled', e.target.checked)} className="rounded" /><span className="text-sm text-muted">Stop تحت آخر تضيق في النموذج</span></label>
                  <label className="flex items-center gap-2 flex-wrap">
                    <input type="checkbox" checked={!!exitRules.stop?.breakEMA?.enabled} onChange={(e) => update('exitRules.stop.breakEMA.enabled', e.target.checked)} className="rounded" />
                    <span className="text-sm text-muted">Stop عند كسر EMA</span>
                    <select value={exitRules.stop?.breakEMA?.value ?? '21 EMA'} onChange={(e) => update('exitRules.stop.breakEMA.value', e.target.value)} className="bg-s2 border border-border rounded px-2 py-1 text-fg text-sm">{EMA_OPTIONS_STOP.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                    <span className="text-sm text-muted">بحجم مرتفع</span>
                  </label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={!!exitRules.stop?.pctFromEntry?.enabled} onChange={(e) => update('exitRules.stop.pctFromEntry.enabled', e.target.checked)} className="rounded" /><span className="text-sm text-muted">Stop عند هبوط</span><input type="number" value={exitRules.stop?.pctFromEntry?.value ?? 7} onChange={(e) => update('exitRules.stop.pctFromEntry.value', Number(e.target.value))} className="w-14 bg-s2 border border-border rounded px-2 py-1 text-fg text-sm" dir="ltr" /><span className="text-sm text-muted">% من سعر الدخول</span></label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={!!exitRules.stop?.peakDrop?.enabled} onChange={(e) => update('exitRules.stop.peakDrop.enabled', e.target.checked)} className="rounded" /><span className="text-sm text-muted">Stop عند هبوط</span><input type="number" value={exitRules.stop?.peakDrop?.value ?? 10} onChange={(e) => update('exitRules.stop.peakDrop.value', Number(e.target.value))} className="w-14 bg-s2 border border-border rounded px-2 py-1 text-fg text-sm" dir="ltr" /><span className="text-sm text-muted">% من أعلى سعر (Peak)</span></label>
                  <div><label className="flex items-center gap-2 mb-1"><input type="checkbox" checked={!!exitRules.stop?.custom?.enabled} onChange={(e) => update('exitRules.stop.custom.enabled', e.target.checked)} className="rounded" /><span className="text-sm text-muted">قاعدة Stop مخصصة:</span></label><input type="text" value={exitRules.stop?.custom?.text ?? ''} onChange={(e) => update('exitRules.stop.custom.text', e.target.value)} className="w-full mt-1 bg-s2 border border-border rounded px-2 py-1 text-fg text-sm" placeholder="مثال: أغلق إذا كسر الدعم الأسبوعي بشمعتين متتاليتين..." dir="rtl" /></div>
                </div>
              </div>
              <div className="bg-s1 border border-teal/30 rounded-xl p-4 border-r-4" style={{ borderRightColor: 'rgba(16,185,129,0.5)' }}>
                <h4 className="text-fg font-medium mb-3">متى تأخذ الأرباح (Profit Rules)</h4>
                <div className="space-y-3">
                  {(exitRules.profit?.partialExits || []).map((pe, i) => (
                    <div key={i} className="flex items-center gap-2 flex-wrap">
                      <input type="checkbox" checked={!!pe.enabled} onChange={(e) => { const arr = [...(exitRules.profit?.partialExits || [])]; arr[i] = { ...arr[i], enabled: e.target.checked }; update('exitRules.profit.partialExits', arr); }} className="rounded" />
                      <span className="text-sm text-muted">خروج جزئي</span>
                      <input type="number" value={pe.pct ?? 33} onChange={(e) => { const arr = [...(exitRules.profit?.partialExits || [])]; arr[i] = { ...arr[i], pct: Number(e.target.value) }; update('exitRules.profit.partialExits', arr); }} className="w-12 bg-s2 border border-border rounded px-2 py-1 text-fg text-sm" dir="ltr" />%
                      <span className="text-sm text-muted">من المركز عند وصول</span>
                      <input type="number" step="0.1" value={pe.atR ?? 2} onChange={(e) => { const arr = [...(exitRules.profit?.partialExits || [])]; arr[i] = { ...arr[i], atR: Number(e.target.value) }; update('exitRules.profit.partialExits', arr); }} className="w-12 bg-s2 border border-border rounded px-2 py-1 text-fg text-sm" dir="ltr" />R
                      <button type="button" onClick={() => { const arr = (exitRules.profit?.partialExits || []).filter((_, j) => j !== i); update('exitRules.profit.partialExits', arr); }} className="text-red text-sm">✕</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => { const arr = [...(exitRules.profit?.partialExits || [{ enabled: false, pct: 33, atR: 2 }]), { enabled: false, pct: 33, atR: 2 }]; update('exitRules.profit.partialExits', arr); }} className="text-gold text-sm">+ إضافة هدف</button>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={!!exitRules.profit?.fullExitAtR?.enabled} onChange={(e) => update('exitRules.profit.fullExitAtR.enabled', e.target.checked)} className="rounded" /><span className="text-sm text-muted">خروج كامل عند وصول</span><input type="number" step="0.1" value={exitRules.profit?.fullExitAtR?.value ?? 5} onChange={(e) => update('exitRules.profit.fullExitAtR.value', Number(e.target.value))} className="w-12 bg-s2 border border-border rounded px-2 py-1 text-fg text-sm" dir="ltr" />R</label>
                  <label className="flex items-center gap-2 flex-wrap"><input type="checkbox" checked={!!exitRules.profit?.trailingStop?.enabled} onChange={(e) => update('exitRules.profit.trailingStop.enabled', e.target.checked)} className="rounded" /><span className="text-sm text-muted">Trailing Stop بعد</span><input type="number" step="0.1" value={exitRules.profit?.trailingStop?.afterR ?? 2} onChange={(e) => update('exitRules.profit.trailingStop.afterR', Number(e.target.value))} className="w-12 bg-s2 border border-border rounded px-2 py-1 text-fg text-sm" dir="ltr" />R احمِ <input type="number" value={exitRules.profit?.trailingStop?.protectPct ?? 50} onChange={(e) => update('exitRules.profit.trailingStop.protectPct', Number(e.target.value))} className="w-12 bg-s2 border border-border rounded px-2 py-1 text-fg text-sm" dir="ltr" />% من الأرباح</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={!!exitRules.profit?.maxDays?.enabled} onChange={(e) => update('exitRules.profit.maxDays.enabled', e.target.checked)} className="rounded" /><span className="text-sm text-muted">لا تحتفظ أكثر من</span><input type="number" value={exitRules.profit?.maxDays?.value ?? 30} onChange={(e) => update('exitRules.profit.maxDays.value', Number(e.target.value))} className="w-14 bg-s2 border border-border rounded px-2 py-1 text-fg text-sm" dir="ltr" /><span className="text-sm text-muted">يوم تداول</span></label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={!!exitRules.profit?.closeBeforeEarnings?.enabled} onChange={(e) => update('exitRules.profit.closeBeforeEarnings.enabled', e.target.checked)} className="rounded" /><span className="text-sm text-muted">أغلق قبل الإعلان بـ</span><input type="number" value={exitRules.profit?.closeBeforeEarnings?.value ?? 2} onChange={(e) => update('exitRules.profit.closeBeforeEarnings.value', Number(e.target.value))} className="w-12 bg-s2 border border-border rounded px-2 py-1 text-fg text-sm" dir="ltr" /><span className="text-sm text-muted">يوم</span></label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={!!exitRules.profit?.peakDrawdown?.enabled} onChange={(e) => update('exitRules.profit.peakDrawdown.enabled', e.target.checked)} className="rounded" /><span className="text-sm text-muted">أغلق إذا تراجع</span><input type="number" value={exitRules.profit?.peakDrawdown?.value ?? 10} onChange={(e) => update('exitRules.profit.peakDrawdown.value', Number(e.target.value))} className="w-12 bg-s2 border border-border rounded px-2 py-1 text-fg text-sm" dir="ltr" /><span className="text-sm text-muted">% من القمة (Peak Drawdown)</span></label>
                  <div><label className="flex items-center gap-2 mb-1"><input type="checkbox" checked={!!exitRules.profit?.custom?.enabled} onChange={(e) => update('exitRules.profit.custom.enabled', e.target.checked)} className="rounded" /><span className="text-sm text-muted">قاعدة خروج مخصصة:</span></label><input type="text" value={exitRules.profit?.custom?.text ?? ''} onChange={(e) => update('exitRules.profit.custom.text', e.target.value)} className="w-full mt-1 bg-s2 border border-border rounded px-2 py-1 text-fg text-sm" placeholder="مثال: إذا ظهر نموذج انعكاسي أسبوعي بحجم مرتفع..." dir="rtl" /></div>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-muted text-sm mb-1">ملاحظات إضافية على الخروج</label>
              <textarea value={exitRules.freeText ?? ''} onChange={(e) => update('exitRules.freeText', e.target.value)} rows={4} className="w-full min-h-[80px] bg-s2 border border-border rounded px-3 py-2 text-fg text-sm" placeholder="أي قواعد خروج إضافية خاصة بهذه الاستراتيجية..." dir="rtl" />
            </div>
          </div>
        </div>
      )}

      {currentStep === 5 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-s2 rounded-xl p-4">
              <h3 className="text-teal font-medium mb-2">قواعد فنية نشطة ✓</h3>
              <ul className="text-sm text-fg space-y-1">
                {(ma || []).filter((m) => m.enabled).map((m, i) => <li key={i}>{m.label} {m.value}</li>)}
                {t.rsi?.enabled && <li>RSI {t.rsi.min}-{t.rsi.max}</li>}
                {(t.patterns || []).map((p) => <li key={p}>{p}</li>)}
                {t.rsRating?.enabled && <li>RS Rating ≥ {t.rsRating.value}</li>}
                {(t.customIndicators || []).filter((i) => i.enabled).map((i, idx) => <li key={idx}>{i.indicator} {i.condition} {i.value}</li>)}
                {(ma || []).filter((m) => m.enabled).length === 0 && !t.rsRating?.enabled && (t.patterns || []).length === 0 && (t.customIndicators || []).filter((i) => i.enabled).length === 0 && <li className="text-muted">—</li>}
              </ul>
            </div>
            <div className="bg-s2 rounded-xl p-4">
              <h3 className="text-teal font-medium mb-2">قواعد مالية نشطة ✓</h3>
              <ul className="text-sm text-fg space-y-1">
                {f.eps?.quarterlyGrowth?.enabled && <li>نمو EPS فصلي ≥ {f.eps.quarterlyGrowth.value}%</li>}
                {f.eps?.annualGrowth?.enabled && <li>نمو EPS سنوي ≥ {f.eps.annualGrowth.value}%</li>}
                {f.eps?.acceleration?.enabled && <li>تسارع نمو EPS</li>}
                {f.revenue?.quarterlyGrowth?.enabled && <li>نمو إيرادات ≥ {f.revenue.quarterlyGrowth.value}%</li>}
                {f.margins?.netMargin?.enabled && <li>هامش صافي ≥ {f.margins.netMargin.value}%</li>}
                {f.balance?.deRatio?.enabled && <li>D/E ≤ {f.balance.deRatio.value}</li>}
                {f.earnings?.roe?.enabled && <li>ROE ≥ {f.earnings.roe.value}%</li>}
                {!f.eps?.quarterlyGrowth?.enabled && !f.eps?.annualGrowth?.enabled && !f.revenue?.quarterlyGrowth?.enabled && !f.balance?.deRatio?.enabled && <li className="text-muted">—</li>}
              </ul>
            </div>
            <div className="bg-s2 rounded-xl p-4">
              <h3 className="text-teal font-medium mb-2">إدارة المخاطر</h3>
              <ul className="text-sm text-fg space-y-1">
                <li>Max Risk: {r.maxRiskPct ?? 2}%</li>
                <li>Min R:R: {r.minRR ?? 3}:1</li>
                <li>Max Open: {r.maxOpenTrades ?? 5}</li>
                <li>Max Exposure: {r.maxExposurePct ?? r.maxExposure ?? 50}%</li>
              </ul>
            </div>
          </div>
          {exitRules && (
            <div className="bg-s2 rounded-xl p-4">
              <h3 className="text-teal font-medium mb-2">قواعد الخروج</h3>
              <ul className="text-sm text-fg space-y-1">
                {exitRules.stop?.underLastContraction?.enabled && <li>Stop تحت آخر تضيق</li>}
                {exitRules.stop?.breakEMA?.enabled && <li>Stop عند كسر {exitRules.stop.breakEMA.value}</li>}
                {exitRules.stop?.pctFromEntry?.enabled && <li>Stop عند هبوط {exitRules.stop.pctFromEntry.value}% من الدخول</li>}
                {exitRules.stop?.peakDrop?.enabled && <li>Stop عند هبوط {exitRules.stop.peakDrop.value}% من القمة</li>}
                {(exitRules.profit?.partialExits || []).filter((pe) => pe.enabled).map((pe, i) => <li key={i}>خروج {pe.pct}% عند {pe.atR}R</li>)}
                {exitRules.profit?.fullExitAtR?.enabled && <li>خروج كامل عند {exitRules.profit.fullExitAtR.value}R</li>}
                {exitRules.profit?.trailingStop?.enabled && <li>Trailing بعد {exitRules.profit.trailingStop.afterR}R احمِ {exitRules.profit.trailingStop.protectPct}%</li>}
                {exitRules.profit?.maxDays?.enabled && <li>لا تحتفظ أكثر من {exitRules.profit.maxDays.value} يوم</li>}
                {exitRules.profit?.closeBeforeEarnings?.enabled && <li>أغلق قبل الإعلان بـ {exitRules.profit.closeBeforeEarnings.value} يوم</li>}
                {exitRules.profit?.peakDrawdown?.enabled && <li>أغلق إذا تراجع {exitRules.profit.peakDrawdown.value}% من القمة</li>}
                {exitRules.freeText && <li className="text-muted">{exitRules.freeText.slice(0, 80)}…</li>}
              </ul>
            </div>
          )}
          <button type="button" onClick={onSave} className="w-full py-3 rounded-xl bg-gold text-black font-bold text-lg">💾 حفظ الاستراتيجية</button>
        </div>
      )}

      <div className="flex justify-between mt-8">
        <button type="button" onClick={() => setCurrentStep((s) => Math.max(1, s - 1))} disabled={currentStep === 1} className="px-4 py-2 rounded-lg border border-border text-fg disabled:opacity-50">السابق</button>
        {currentStep < 5 ? (
          <button type="button" onClick={() => setCurrentStep((s) => Math.min(5, s + 1))} className="px-4 py-2 rounded-lg bg-gold text-black font-bold">التالي</button>
        ) : null}
      </div>
    </div>
  );
}

function StrategyDetail({ strategy, onEdit, onDuplicate, onDelete, onShare, onBack }) {
  const fd = strategy.formData || {};
  const t = fd.technical || {};
  const f = fd.fundamental || {};
  const r = fd.risk || {};
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button type="button" onClick={onBack} className="text-muted hover:text-fg">← رجوع</button>
        <div className="flex gap-2">
          {onShare && <button type="button" onClick={onShare} className="px-4 py-2 rounded-lg border border-gold text-gold hover:bg-gold/10">🔗 مشاركة</button>}
          <button type="button" onClick={onEdit} className="px-4 py-2 rounded-lg border border-border text-fg hover:bg-s2">تعديل</button>
          <button type="button" onClick={onDuplicate} className="px-4 py-2 rounded-lg border border-gold text-gold hover:bg-gold/10">نسخ</button>
          <button type="button" onClick={onDelete} className="px-4 py-2 rounded-lg border border-red text-red hover:bg-red/10">حذف</button>
        </div>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">{strategy.icon}</span>
        <h1 className="font-display text-gold text-2xl">{strategy.name}</h1>
        <span className="px-2 py-0.5 rounded bg-s2 text-muted text-sm">{strategy.type}</span>
      </div>
      {strategy.stats && (
        <div className="flex flex-wrap gap-4 mb-6 text-sm">
          <span>Win Rate: {strategy.stats.winRate}%</span>
          <span>Avg R: {strategy.stats.avgR}</span>
          <span>Profit Factor: {strategy.stats.profitFactor}</span>
          <span>R:R Min: {strategy.stats.rrMin}</span>
          <span>Trades: {strategy.stats.trades}</span>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-s1 border border-border rounded-xl p-4">
          <h3 className="text-gold font-medium mb-2">الفني</h3>
          <pre className="text-sm text-muted whitespace-pre-wrap">{JSON.stringify(t, null, 2)}</pre>
        </div>
        <div className="bg-s1 border border-border rounded-xl p-4">
          <h3 className="text-gold font-medium mb-2">المالي والمخاطر</h3>
          <pre className="text-sm text-muted whitespace-pre-wrap">{JSON.stringify({ fundamental: f, risk: r }, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}

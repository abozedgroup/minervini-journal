import React, { useState, useRef, useCallback, useEffect } from 'react';
import { initialStrategyForm, defaultFundamental, defaultExitRules } from '../utils/strategySchema';
import TrendConditions from '../components/strategy/TrendConditions';
import EntryConditions from '../components/strategy/EntryConditions';
import ExecutionConditions from '../components/strategy/ExecutionConditions';
import {
  defaultTrendConditions,
  defaultEntryConditions,
  defaultExecutionConditions,
  TREND_PRESETS,
  ENTRY_PRESETS,
  PRESET_LABELS,
} from '../utils/technicalConditionsSchema';

const SECTIONS = [
  { id: 'basics', label: 'الأساسيات', icon: '●' },
  { id: 'trend', label: 'شروط الاتجاه', icon: '●' },
  { id: 'entry', label: 'شروط الدخول', icon: '●' },
  { id: 'execution', label: 'شروط التنفيذ', icon: '●' },
  { id: 'fundamental', label: 'الأساسيات المالية', icon: '●' },
  { id: 'risk', label: 'المخاطر والخروج', icon: '●' },
  { id: 'review', label: 'مراجعة وحفظ', icon: '●' },
];

const INSPIRATION_CARDS = [
  { id: 'minervini', label: 'مينيرفيني' },
  { id: 'oneil', label: 'ويليام أونيل' },
  { id: 'canslim', label: 'CAN SLIM' },
  { id: 'rsi', label: 'مومنتم RSI' },
  { id: 'custom', label: 'مخصص' },
];

function countTrendActive(trend) {
  if (!trend) return 0;
  let n = 0;
  for (const key of ['price', 'rsi', 'volume', 'rs']) {
    const card = trend[key];
    if (!card) continue;
    if (card.rows) n += card.rows.filter((r) => r.enabled).length;
    if (card.customRows) n += card.customRows.filter((r) => r.enabled).length;
  }
  return n;
}

function getSectionStatus(formData, sectionId) {
  if (sectionId === 'basics') return (formData.name || '').trim() ? 'complete' : formData.inspirations?.length ? 'hasContent' : 'empty';
  if (sectionId === 'trend') {
    const n = countTrendActive(formData.trendConditions);
    return n > 0 ? 'complete' : formData.trendConditions ? 'hasContent' : 'empty';
  }
  if (sectionId === 'entry') {
    const ec = formData.entryConditions;
    const hasPatterns = (ec?.patterns?.length || 0) > 0;
    const hasRules = (ec?.entryRules?.length || 0) > 0;
    return hasPatterns || hasRules ? 'hasContent' : 'empty';
  }
  if (sectionId === 'execution') {
    const groups = formData.executionConditions?.groups || [];
    const total = groups.reduce((acc, g) => acc + (g.items || []).length, 0);
    const enabled = groups.reduce((acc, g) => acc + (g.items || []).filter((i) => i.enabled).length, 0);
    return enabled > 0 ? 'complete' : total > 0 ? 'hasContent' : 'empty';
  }
  if (sectionId === 'fundamental') return formData.fundamental ? 'hasContent' : 'empty';
  if (sectionId === 'risk') return formData.risk?.maxRiskPct != null ? 'hasContent' : 'empty';
  if (sectionId === 'review') return 'empty';
  return 'empty';
}

const EPS_TIMEFRAME_OPTIONS = [
  { value: 'last', label: 'آخر فصل' },
  { value: 'last3', label: 'آخر 3 فصول' },
  { value: 'avg', label: 'متوسط' },
];
const CUSTOM_CONDITION_OPTIONS = ['أكبر من', 'أصغر من', 'يساوي', 'في تحسن', 'في تراجع', 'مطلوب'];
const EMA_STOP_OPTIONS = ['10 EMA', '21 EMA', '50 EMA', '200 EMA'];
const REVERSAL_PATTERN_OPTIONS = [
  { value: 'none', label: '—' },
  { value: 'reversal_candle', label: 'شمعة انعكاسية' },
  { value: 'head_shoulders', label: 'نموذج رأس وكتفين' },
  { value: 'custom', label: 'مخصص' },
];

export default function StrategyBuilderPage({ formData, setFormData, onSave, onBack, showToast }) {
  const [expandedSection, setExpandedSection] = useState('basics');
  const [inspirations, setInspirations] = useState(formData.inspirations || []);
  const [presetBanner, setPresetBanner] = useState(formData._presetBannerNames?.length ? formData._presetBannerNames.join(' + ') : null);
  const sectionRefs = useRef({});
  const prevInspirationsRef = useRef(null);

  useEffect(() => {
    const key = inspirations.join(',');
    if (prevInspirationsRef.current === null) {
      prevInspirationsRef.current = key;
      return;
    }
    if (prevInspirationsRef.current === key) return;
    prevInspirationsRef.current = key;
    if (inspirations.length === 0) {
      setPresetBanner(null);
      return;
    }
    let presetName = null;
    let trendPatch = null;
    let entryPatch = null;
    if (inspirations.includes('minervini')) {
      presetName = PRESET_LABELS.minervini;
      trendPatch = TREND_PRESETS.minervini;
      entryPatch = { ...defaultEntryConditions(), patterns: ENTRY_PRESETS.minervini.patterns, volumeAtEntry: { enabled: true, pct: ENTRY_PRESETS.minervini.volumePct } };
    } else if (inspirations.includes('oneil') || inspirations.includes('canslim')) {
      presetName = PRESET_LABELS.oneil;
      trendPatch = TREND_PRESETS.oneil;
      entryPatch = { ...defaultEntryConditions(), patterns: ENTRY_PRESETS.oneil.patterns, volumeAtEntry: { enabled: true, pct: ENTRY_PRESETS.oneil.volumePct } };
    } else if (inspirations.includes('rsi')) {
      presetName = PRESET_LABELS.momentum;
      trendPatch = TREND_PRESETS.momentum;
      entryPatch = { ...defaultEntryConditions(), patterns: ENTRY_PRESETS.momentum.patterns, volumeAtEntry: { enabled: true, pct: ENTRY_PRESETS.momentum.volumePct } };
    }
    if (presetName) {
      setPresetBanner(presetName);
      setFormData((prev) => ({
        ...prev,
        trendConditions: trendPatch ?? prev.trendConditions,
        entryConditions: entryPatch ?? prev.entryConditions,
      }));
      const t = setTimeout(() => setPresetBanner((b) => (b === presetName ? null : b)), 4000);
      return () => clearTimeout(t);
    }
  }, [inspirations.join(',')]);

  useEffect(() => {
    if (formData._presetBannerNames?.length) setPresetBanner(formData._presetBannerNames.join(' + '));
  }, [formData._presetBannerNames]);

  const update = useCallback(
    (path, value) => {
      setFormData((prev) => {
        const next = JSON.parse(JSON.stringify(prev));
        const parts = path.split('.');
        let o = next;
        for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]] = o[parts[i]] || {};
        o[parts[parts.length - 1]] = value;
        return next;
      });
    },
    [setFormData]
  );

  useEffect(() => {
    setFormData((prev) => ({ ...prev, inspirations }));
  }, [inspirations, setFormData]);

  const scrollToSection = (id) => {
    const el = sectionRefs.current[id];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setExpandedSection(id);
  };

  const completedCount = SECTIONS.filter((s) => getSectionStatus(formData, s.id) === 'complete').length;
  const progressPct = Math.round((completedCount / 7) * 100);

  return (
    <div className="grid grid-cols-[200px_1fr] h-[100vh] overflow-hidden bg-bg">
      {/* Left Nav — sticky */}
      <nav className="flex flex-col border-l border-border bg-s1 overflow-y-auto">
        <div className="p-3 border-b border-border">
          <p className="text-muted text-xs mb-1">{completedCount} من 7 أقسام مكتملة</p>
          <div className="h-1.5 rounded-full bg-s2 overflow-hidden">
            <div className="h-full bg-gold transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <ul className="p-2 space-y-0.5">
          {SECTIONS.map((s) => {
            const status = getSectionStatus(formData, s.id);
            const dotClass = status === 'complete' ? 'text-teal' : status === 'hasContent' ? 'text-gold' : 'text-muted';
            return (
              <li key={s.id}>
                <button type="button" onClick={() => scrollToSection(s.id)} className="w-full text-right flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-s2 text-sm">
                  <span className={`shrink-0 ${dotClass}`}>{s.icon}</span>
                  <span className="text-fg">{s.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Content — scrollable */}
      <div className="overflow-y-auto">
        {/* Top Bar — sticky */}
        <header className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between gap-4">
          <button type="button" onClick={onBack} className="text-gold hover:underline shrink-0">
            ← رجوع
          </button>
          <input
            type="text"
            value={formData.name || ''}
            onChange={(e) => update('name', e.target.value)}
            placeholder="اسم الاستراتيجية"
            className="flex-1 max-w-md bg-s2 border border-border rounded-lg px-3 py-2 text-fg text-center"
            dir="rtl"
          />
          <button type="button" onClick={onSave} className="px-4 py-2 rounded-lg bg-gold text-black font-bold shrink-0">
            💾 حفظ الآن
          </button>
        </header>

        <div className="p-6 space-y-6 max-w-4xl mx-auto">
          {/* Section 1 — الأساسيات */}
          <SectionCard
            ref={(r) => (sectionRefs.current.basics = r)}
            id="basics"
            title="الأساسيات"
            icon="●"
            status={getSectionStatus(formData, 'basics')}
            expanded={expandedSection === 'basics'}
            onToggle={() => setExpandedSection(expandedSection === 'basics' ? null : 'basics')}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-muted text-sm mb-1">النوع</label>
                <div className="flex gap-2 flex-wrap">
                  {['technical', 'fundamental', 'mixed'].map((key) => (
                    <button key={key} type="button" onClick={() => update('type', key)} className={`px-4 py-2 rounded-lg border text-sm ${formData.type === key ? 'border-gold bg-gold/20 text-gold' : 'border-border text-muted'}`}>
                      {key === 'technical' ? '📊 فني' : key === 'fundamental' ? '💰 مالي' : '⚡ مزيج'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-muted text-sm mb-1">الإطار الزمني</label>
                <select value={formData.timeframe || 'swing'} onChange={(e) => update('timeframe', e.target.value)} className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg">
                  <option value="swing">Swing</option>
                  <option value="position">Position</option>
                  <option value="day">Day Trade</option>
                </select>
              </div>
              <div>
                <label className="block text-muted text-sm mb-2">مستوحى من</label>
                <div className="flex flex-wrap gap-2">
                  {INSPIRATION_CARDS.map((card) => {
                    const selected = inspirations.includes(card.id);
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => setInspirations((prev) => (prev.includes(card.id) ? prev.filter((x) => x !== card.id) : [...prev, card.id]))}
                        className={`relative px-4 py-3 rounded-xl border text-sm transition-colors ${selected ? 'border-gold bg-[rgba(240,180,41,0.08)] text-gold' : 'border-border text-muted hover:border-gold/50'}`}
                      >
                        {selected && <span className="absolute top-1 left-1 text-gold">✓</span>}
                        {card.label}
                      </button>
                    );
                  })}
                </div>
                {presetBanner && (
                  <div className="mt-3 p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-sm">
                    <p className="text-amber-200 mb-2">✅ تم تحميل الإعدادات الافتراضية لـ {presetBanner} — عدّل كما تشاء</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setPresetBanner(null)} className="px-3 py-1 rounded-lg border border-amber-500/50 text-amber-200 text-xs">
                        تعديل
                      </button>
                      <button type="button" onClick={() => setPresetBanner(null)} className="px-3 py-1 rounded-lg bg-amber-500/30 text-amber-900 dark:text-amber-100 text-xs">
                        قبول كما هي
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          {/* Section 2 — شروط الاتجاه */}
          <SectionCard ref={(r) => (sectionRefs.current.trend = r)} id="trend" title="شروط الاتجاه" icon="●" status={getSectionStatus(formData, 'trend')} expanded={expandedSection === 'trend'} onToggle={() => setExpandedSection(expandedSection === 'trend' ? null : 'trend')}>
            <TrendConditions
              data={formData.trendConditions ?? defaultTrendConditions()}
              onChange={(next) => update('trendConditions', next)}
            />
          </SectionCard>

          {/* Section 3 — شروط الدخول */}
          <SectionCard ref={(r) => (sectionRefs.current.entry = r)} id="entry" title="شروط الدخول" icon="●" status={getSectionStatus(formData, 'entry')} expanded={expandedSection === 'entry'} onToggle={() => setExpandedSection(expandedSection === 'entry' ? null : 'entry')}>
            <EntryConditions
              data={formData.entryConditions ?? defaultEntryConditions()}
              onChange={(next) => update('entryConditions', next)}
            />
          </SectionCard>

          {/* Section 4 — شروط التنفيذ */}
          <SectionCard ref={(r) => (sectionRefs.current.execution = r)} id="execution" title="شروط التنفيذ" icon="●" status={getSectionStatus(formData, 'execution')} expanded={expandedSection === 'execution'} onToggle={() => setExpandedSection(expandedSection === 'execution' ? null : 'execution')}>
            <ExecutionConditions
              data={formData.executionConditions ?? defaultExecutionConditions()}
              onChange={(next) => update('executionConditions', next)}
            />
          </SectionCard>

          {/* Section 5 — الأساسيات المالية (full 3 columns) */}
          <SectionCard ref={(r) => (sectionRefs.current.fundamental = r)} id="fundamental" title="الأساسيات المالية" icon="●" status={getSectionStatus(formData, 'fundamental')} expanded={expandedSection === 'fundamental'} onToggle={() => setExpandedSection(expandedSection === 'fundamental' ? null : 'fundamental')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Column 1 — الأرباح والإيرادات */}
              <div className="space-y-4">
                <h4 className="font-medium text-fg border-b border-border pb-1">📈 نمو الأرباح EPS</h4>
                <FundamentalToggle path="fundamental.eps.quarterlyGrowth" formData={formData} update={update} label="نمو EPS الفصلي ≥" valueLabel="%" defaultValue={25} showTimeframe options={EPS_TIMEFRAME_OPTIONS} />
                <FundamentalToggle path="fundamental.eps.annualGrowth" formData={formData} update={update} label="نمو EPS السنوي ≥" valueLabel="%" defaultValue={20} />
                <FundamentalToggle path="fundamental.eps.acceleration" formData={formData} update={update} label="تسارع نمو EPS (كل فصل أعلى من السابق)" />
                <FundamentalToggle path="fundamental.eps.beatEstimates" formData={formData} update={update} label="EPS فاق توقعات المحللين بـ ≥" valueLabel="%" defaultValue={5} />
                <FundamentalToggle path="fundamental.eps.newHigh" formData={formData} update={update} label="EPS سجل رقماً قياسياً جديداً" />
                <h4 className="font-medium text-fg border-b border-border pb-1 mt-4">💰 نمو الإيرادات</h4>
                <FundamentalToggle path="fundamental.revenue.quarterlyGrowth" formData={formData} update={update} label="نمو الإيرادات الفصلي ≥" valueLabel="%" defaultValue={20} />
                <FundamentalToggle path="fundamental.revenue.annualGrowth" formData={formData} update={update} label="نمو الإيرادات السنوي ≥" valueLabel="%" defaultValue={15} />
                <FundamentalToggle path="fundamental.revenue.acceleration" formData={formData} update={update} label="تسارع نمو الإيرادات" />
                <FundamentalToggle path="fundamental.revenue.beatEstimates" formData={formData} update={update} label="الإيرادات فاقت التوقعات" />
                <div className="pt-2">
                  <button type="button" onClick={() => addCustomFundamentalRule(formData, update)} className="text-sm text-gold hover:underline">+ إضافة شرط مالي مخصص</button>
                  {(formData.fundamental?.customRules || []).map((r, i) => (
                    <div key={r.id || i} className="flex flex-wrap items-center gap-2 mt-2">
                      <input type="checkbox" checked={!!r.enabled} onChange={(e) => updateCustomFundamentalRule(formData, update, i, { enabled: e.target.checked })} className="rounded" />
                      <input type="text" value={r.name || ''} onChange={(e) => updateCustomFundamentalRule(formData, update, i, { name: e.target.value })} placeholder="الاسم" className="flex-1 min-w-[100px] bg-s2 border border-border rounded px-2 py-1 text-sm" dir="rtl" />
                      <select value={r.condition || ''} onChange={(e) => updateCustomFundamentalRule(formData, update, i, { condition: e.target.value })} className="bg-s2 border border-border rounded px-2 py-1 text-sm">
                        {CUSTOM_CONDITION_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                      <input type="text" value={r.value ?? ''} onChange={(e) => updateCustomFundamentalRule(formData, update, i, { value: e.target.value })} placeholder="قيمة" className="w-20 bg-s2 border border-border rounded px-2 py-1 text-sm" dir="ltr" />
                      <button type="button" onClick={() => removeCustomFundamentalRule(formData, update, i)} className="p-1 text-red hover:bg-red/20 rounded">✕</button>
                    </div>
                  ))}
                </div>
              </div>
              {/* Column 2 — الهوامش والميزانية */}
              <div className="space-y-4">
                <h4 className="font-medium text-fg border-b border-border pb-1">📊 الهوامش</h4>
                <FundamentalToggle path="fundamental.margins.netMargin" formData={formData} update={update} label="هامش الربح الصافي Net Margin ≥" valueLabel="%" defaultValue={0} />
                <FundamentalToggle path="fundamental.margins.grossMargin" formData={formData} update={update} label="هامش الربح الإجمالي Gross Margin ≥" valueLabel="%" defaultValue={0} />
                <FundamentalToggle path="fundamental.margins.netMarginImproving" formData={formData} update={update} label="هامش الربح الصافي في تحسن مستمر (3 فصول)" />
                <FundamentalToggle path="fundamental.margins.operatingMargin" formData={formData} update={update} label="هامش التشغيل Operating Margin ≥" valueLabel="%" defaultValue={0} />
                <h4 className="font-medium text-fg border-b border-border pb-1 mt-4">🏦 الميزانية</h4>
                <FundamentalToggle path="fundamental.balance.deRatio" formData={formData} update={update} label="نسبة الدين للأصول D/E ≤" defaultValue={1.5} />
                <FundamentalToggle path="fundamental.balance.currentRatio" formData={formData} update={update} label="نسبة السيولة الحالية Current Ratio ≥" defaultValue={1.5} />
                <FundamentalToggle path="fundamental.balance.float" formData={formData} update={update} label="عدد الأسهم المتداولة Float ≤" valueLabel="مليون" defaultValue={50} />
                <FundamentalToggle path="fundamental.balance.buyback" formData={formData} update={update} label="الشركة تعيد شراء أسهمها (Share Buyback)" />
                <FundamentalToggle path="fundamental.balance.roe" formData={formData} update={update} label="ROE العائد على حقوق الملكية ≥" valueLabel="%" defaultValue={15} />
              </div>
              {/* Column 3 — المؤسسيون والتوقيت */}
              <div className="space-y-4">
                <h4 className="font-medium text-fg border-b border-border pb-1">🏛 المؤسسيون</h4>
                <FundamentalToggle path="fundamental.institutional.ownership" formData={formData} update={update} label="نسبة ملكية المؤسسيين ≥" valueLabel="%" defaultValue={30} />
                <FundamentalToggle path="fundamental.institutional.increasing" formData={formData} update={update} label="المؤسسيون يزيدون ملكيتهم (زيادة في آخر فصلين)" />
                <FundamentalToggle path="fundamental.institutional.newFunds" formData={formData} update={update} label="عدد صناديق جديدة دخلت ≥" valueLabel="صندوق" defaultValue={1} />
                <FundamentalToggle path="fundamental.institutional.aRated" formData={formData} update={update} label="صناديق عالية الجودة تمتلك السهم (A-rated)" />
                <h4 className="font-medium text-fg border-b border-border pb-1 mt-4">📅 التوقيت المالي</h4>
                <FundamentalToggle path="fundamental.earnings.recentWeeks" formData={formData} update={update} label="آخر نتائج فصلية منذ ≤" valueLabel="أسابيع" defaultValue={8} />
                <FundamentalToggle path="fundamental.earnings.daysToNext" formData={formData} update={update} label="موعد النتائج القادمة بعد ≥" valueLabel="يوم" defaultValue={14} />
                <FundamentalToggle path="fundamental.earnings.guidancePositive" formData={formData} update={update} label="الشركة أعلنت guidance إيجابي في آخر إعلان" />
              </div>
            </div>
            <FundamentalsScoreBar formData={formData} />
          </SectionCard>

          {/* Section 6 — المخاطر والخروج (full 2 columns) */}
          <SectionCard ref={(r) => (sectionRefs.current.risk = r)} id="risk" title="المخاطر والخروج" icon="●" status={getSectionStatus(formData, 'risk')} expanded={expandedSection === 'risk'} onToggle={() => setExpandedSection(expandedSection === 'risk' ? null : 'risk')}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* LEFT — إدارة المخاطر */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-muted text-xs mb-1">Max Risk %</label><input type="number" value={formData.risk?.maxRiskPct ?? 2} onChange={(e) => update('risk.maxRiskPct', Number(e.target.value))} className="w-full bg-s2 border border-border rounded px-2 py-1.5 text-fg" dir="ltr" /></div>
                  <div><label className="block text-muted text-xs mb-1">Min R:R</label><input type="number" step="0.1" value={formData.risk?.minRR ?? 3} onChange={(e) => update('risk.minRR', Number(e.target.value))} className="w-full bg-s2 border border-border rounded px-2 py-1.5 text-fg" dir="ltr" /></div>
                  <div><label className="block text-muted text-xs mb-1">Max Trades</label><input type="number" value={formData.risk?.maxOpenTrades ?? 5} onChange={(e) => update('risk.maxOpenTrades', Number(e.target.value))} className="w-full bg-s2 border border-border rounded px-2 py-1.5 text-fg" dir="ltr" /></div>
                  <div><label className="block text-muted text-xs mb-1">Max Exposure %</label><input type="number" value={formData.risk?.maxExposure ?? 50} onChange={(e) => update('risk.maxExposure', Number(e.target.value))} className="w-full bg-s2 border border-border rounded px-2 py-1.5 text-fg" dir="ltr" /></div>
                </div>
                <h4 className="font-medium text-fg border-b border-border pb-1">🛑 متى تقطع الخسارة</h4>
                <RiskToggle path="exitRules.stop.underLastContraction" formData={formData} update={update} label="Initial Stop تحت آخر تضيق في النموذج (Pivot Low)" />
                <RiskToggle path="exitRules.stop.breakEMA" formData={formData} update={update} label="Stop عند كسر EMA" options={EMA_STOP_OPTIONS} />
                <RiskToggle path="exitRules.stop.pctFromEntry" formData={formData} update={update} label="Stop عند هبوط" valueLabel="% من سعر الدخول" defaultValue={7} />
                <RiskToggle path="exitRules.stop.peakDrop" formData={formData} update={update} label="Stop عند هبوط (Peak Trailing)" valueLabel="% من أعلى سعر" defaultValue={10} />
                <RiskToggle path="exitRules.stop.portfolioLossMonth" formData={formData} update={update} label="توقف عن التداول إذا خسرت" valueLabel="% من المحفظة هذا الشهر" defaultValue={6} />
                <div className="flex flex-wrap gap-2 items-start">
                  <label className="flex items-center gap-1 cursor-pointer shrink-0"><input type="checkbox" checked={!!getNested(formData, 'exitRules.stop.custom.enabled')} onChange={(e) => update('exitRules.stop.custom.enabled', e.target.checked)} className="rounded" /><span className="text-sm">قاعدة Stop مخصصة:</span></label>
                  <input type="text" value={getNested(formData, 'exitRules.stop.custom.text') || ''} onChange={(e) => update('exitRules.stop.custom.text', e.target.value)} placeholder="مثال: أغلق إذا كسر دعم الأسبوعي..." className="flex-1 min-w-[200px] bg-s2 border border-border rounded px-2 py-1.5 text-sm" dir="rtl" />
                </div>
              </div>
              {/* RIGHT — قواعد الخروج بالأرباح */}
              <div className="space-y-4">
                <h4 className="font-medium text-fg border-b border-border pb-1">🎯 متى تأخذ الأرباح</h4>
                {(formData.exitRules?.profit?.partialExits || defaultExitRules().profit.partialExits).map((row, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <input type="checkbox" checked={!!row.enabled} onChange={(e) => updatePartialExit(formData, update, i, { enabled: e.target.checked })} className="rounded" />
                    <span className="text-sm text-muted">خروج جزئي</span>
                    <input type="number" value={row.pct ?? 33} onChange={(e) => updatePartialExit(formData, update, i, { pct: Number(e.target.value) })} className="w-14 bg-s2 border border-border rounded px-2 py-1 text-sm" dir="ltr" />%
                    <span className="text-sm text-muted">من المركز عند وصول</span>
                    <input type="number" value={row.atR ?? 2} onChange={(e) => updatePartialExit(formData, update, i, { atR: Number(e.target.value) })} className="w-14 bg-s2 border border-border rounded px-2 py-1 text-sm" dir="ltr" />R
                    {(formData.exitRules?.profit?.partialExits || []).length > 1 && <button type="button" onClick={() => removePartialExit(formData, update, i)} className="p-1 text-red hover:bg-red/20 rounded">✕</button>}
                  </div>
                ))}
                <button type="button" onClick={() => addPartialExit(formData, update)} className="text-sm text-gold hover:underline">+ إضافة هدف ربح</button>
                <RiskToggle path="exitRules.profit.fullExitAtR" formData={formData} update={update} label="خروج كامل عند وصول" valueLabel="R" defaultValue={5} />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={!!getNested(formData, 'exitRules.profit.trailingStop.enabled')} onChange={(e) => update('exitRules.profit.trailingStop.enabled', e.target.checked)} className="rounded" /><span className="text-sm">Trailing Stop بعد وصول</span></label>
                  <input type="number" value={getNested(formData, 'exitRules.profit.trailingStop.afterR') ?? 2} onChange={(e) => update('exitRules.profit.trailingStop.afterR', Number(e.target.value))} className="w-14 bg-s2 border border-border rounded px-2 py-1 text-sm" dir="ltr" />R
                  <span className="text-sm text-muted">احمِ</span>
                  <input type="number" value={getNested(formData, 'exitRules.profit.trailingStop.protectPct') ?? 50} onChange={(e) => update('exitRules.profit.trailingStop.protectPct', Number(e.target.value))} className="w-14 bg-s2 border border-border rounded px-2 py-1 text-sm" dir="ltr" />%
                  <span className="text-sm text-muted">من الأرباح</span>
                </div>
                <h4 className="font-medium text-fg border-b border-border pb-1 mt-4">⏱ قواعد الوقت</h4>
                <RiskToggle path="exitRules.profit.maxDays" formData={formData} update={update} label="لا تحتفظ بصفقة أكثر من" valueLabel="يوم تداول" defaultValue={30} />
                <RiskToggle path="exitRules.profit.closeBeforeEarnings" formData={formData} update={update} label="أغلق قبل الإعلان الفصلي بـ" valueLabel="يوم" defaultValue={2} />
                <RiskToggle path="exitRules.profit.reviewDays" formData={formData} update={update} label="راجع الصفقة إذا مر" valueLabel="أيام بدون تقدم" defaultValue={5} />
                <h4 className="font-medium text-fg border-b border-border pb-1 mt-4">📉 سلوك السهم</h4>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={!!getNested(formData, 'exitRules.profit.closeUnderEma.enabled')} onChange={(e) => update('exitRules.profit.closeUnderEma.enabled', e.target.checked)} className="rounded" /><span className="text-sm">أغلق إذا أغلق السهم تحت EMA</span></label>
                  <select value={getNested(formData, 'exitRules.profit.closeUnderEma.value') || '50 EMA'} onChange={(e) => update('exitRules.profit.closeUnderEma.value', e.target.value)} className="bg-s2 border border-border rounded px-2 py-1 text-sm">{EMA_STOP_OPTIONS.slice(0, 3).map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select>
                  <span className="text-sm text-muted">بحجم مرتفع</span>
                </div>
                <RiskToggle path="exitRules.profit.peakDrawdown" formData={formData} update={update} label="أغلق إذا تراجع (Peak Drawdown)" valueLabel="% من القمة" defaultValue={10} />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1 cursor-pointer shrink-0"><input type="checkbox" checked={!!getNested(formData, 'exitRules.profit.reversalPattern.enabled')} onChange={(e) => update('exitRules.profit.reversalPattern.enabled', e.target.checked)} className="rounded" /><span className="text-sm">أغلق إذا ظهر نموذج انعكاسي</span></label>
                  <select value={getNested(formData, 'exitRules.profit.reversalPattern.value') || 'none'} onChange={(e) => update('exitRules.profit.reversalPattern.value', e.target.value)} className="bg-s2 border border-border rounded px-2 py-1 text-sm">{REVERSAL_PATTERN_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>
                </div>
                <div>
                  <label className="block text-muted text-xs mb-1">ملاحظات الخروج</label>
                  <textarea value={formData.exitRules?.freeText ?? ''} onChange={(e) => update('exitRules.freeText', e.target.value)} placeholder="قواعد خروج خاصة بك..." className="w-full min-h-[80px] bg-s2 border border-border rounded px-3 py-2 text-sm" dir="rtl" />
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Section 7 — مراجعة وحفظ */}
          <SectionCard ref={(r) => (sectionRefs.current.review = r)} id="review" title="مراجعة وحفظ" icon="●" status="empty" expanded={expandedSection === 'review'} onToggle={() => setExpandedSection(expandedSection === 'review' ? null : 'review')}>
            <div className="space-y-3">
              <p className="text-fg">
                الاتجاه: {countTrendActive(formData.trendConditions)} شرط • الدخول: {(formData.entryConditions?.patterns || []).length} نموذج • التنفيذ: {(formData.executionConditions?.groups || []).reduce((acc, g) => acc + (g.items || []).filter((i) => i.enabled).length, 0)} بند
              </p>
              <button type="button" onClick={onSave} className="w-full py-3 rounded-xl bg-gold text-black font-bold text-lg">
                💾 حفظ الاستراتيجية
              </button>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function getNested(obj, path) {
  const parts = path.split('.');
  let v = obj;
  for (const p of parts) {
    v = v?.[p];
  }
  return v;
}

function FundamentalToggle({ path, formData, update, label, valueLabel = '', defaultValue = 0, showTimeframe, options }) {
  const node = getNested(formData, path) || {};
  const hasValue = valueLabel !== undefined && (valueLabel === '%' || valueLabel === 'أسابيع' || valueLabel === 'يوم' || valueLabel === 'مليون' || valueLabel === 'صندوق');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1 cursor-pointer shrink-0">
        <input type="checkbox" checked={!!node.enabled} onChange={(e) => update(`${path}.enabled`, e.target.checked)} className="rounded" />
        <span className="text-sm text-fg">{label}</span>
      </label>
      {hasValue && (
        <>
          <input type="number" value={node.value ?? defaultValue} onChange={(e) => update(`${path}.value`, e.target.value ? Number(e.target.value) : defaultValue)} className="w-16 bg-s2 border border-border rounded px-2 py-1 text-sm" dir="ltr" />
          <span className="text-muted text-xs">{valueLabel}</span>
        </>
      )}
      {showTimeframe && options && (
        <select value={node.timeframe || 'last'} onChange={(e) => update(`${path}.timeframe`, e.target.value)} className="bg-s2 border border-border rounded px-2 py-1 text-sm">
          {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      )}
    </div>
  );
}

function FundamentalsScoreBar({ formData }) {
  const f = formData.fundamental || defaultFundamental();
  const toggles = [
    f.eps?.quarterlyGrowth?.enabled, f.eps?.annualGrowth?.enabled, f.eps?.acceleration?.enabled, f.eps?.beatEstimates?.enabled, f.eps?.newHigh?.enabled,
    f.revenue?.quarterlyGrowth?.enabled, f.revenue?.annualGrowth?.enabled, f.revenue?.acceleration?.enabled, f.revenue?.beatEstimates?.enabled,
    f.margins?.netMargin?.enabled, f.margins?.grossMargin?.enabled, f.margins?.netMarginImproving?.enabled, f.margins?.operatingMargin?.enabled,
    f.balance?.deRatio?.enabled, f.balance?.currentRatio?.enabled, f.balance?.float?.enabled, f.balance?.buyback?.enabled, f.balance?.roe?.enabled,
    f.institutional?.ownership?.enabled, f.institutional?.increasing?.enabled, f.institutional?.newFunds?.enabled, f.institutional?.aRated?.enabled,
    f.earnings?.recentWeeks?.enabled, f.earnings?.daysToNext?.enabled, f.earnings?.guidancePositive?.enabled,
  ];
  const total = toggles.length;
  const active = toggles.filter(Boolean).length;
  const pct = total ? Math.round((active / total) * 100) : 0;
  const barColor = pct >= 70 ? 'bg-teal' : pct >= 40 ? 'bg-gold' : 'bg-red-500';
  return (
    <div className="mt-4 pt-4 border-t border-border">
      <p className="text-sm text-muted mb-1">نقاط الأساسيات: {active}/{total}</p>
      <div className="h-2 rounded-full bg-s2 overflow-hidden">
        <div className={`h-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function addCustomFundamentalRule(formData, update) {
  const list = formData.fundamental?.customRules || [];
  const next = [...list, { id: 'cr_' + Date.now(), enabled: true, name: '', condition: 'مطلوب', value: '' }];
  update('fundamental.customRules', next);
}

function updateCustomFundamentalRule(formData, update, index, patch) {
  const list = formData.fundamental?.customRules || [];
  const next = list.map((r, i) => (i === index ? { ...r, ...patch } : r));
  update('fundamental.customRules', next);
}

function removeCustomFundamentalRule(formData, update, index) {
  const list = formData.fundamental?.customRules || [];
  const next = list.filter((_, i) => i !== index);
  update('fundamental.customRules', next);
}

function RiskToggle({ path, formData, update, label, valueLabel = '', defaultValue = 0, options }) {
  const node = getNested(formData, path) || {};
  const hasValue = valueLabel !== undefined && valueLabel.length > 0;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1 cursor-pointer shrink-0">
        <input type="checkbox" checked={!!node.enabled} onChange={(e) => update(`${path}.enabled`, e.target.checked)} className="rounded" />
        <span className="text-sm text-fg">{label}</span>
      </label>
      {hasValue && (
        <>
          <input type="number" value={node.value ?? defaultValue} onChange={(e) => update(`${path}.value`, e.target.value ? Number(e.target.value) : defaultValue)} className="w-16 bg-s2 border border-border rounded px-2 py-1 text-sm" dir="ltr" />
          <span className="text-muted text-xs">{valueLabel}</span>
        </>
      )}
      {options && (
        <select value={node.value || options[0]} onChange={(e) => update(`${path}.value`, e.target.value)} className="bg-s2 border border-border rounded px-2 py-1 text-sm">
          {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      )}
    </div>
  );
}

function updatePartialExit(formData, update, index, patch) {
  const list = formData.exitRules?.profit?.partialExits || defaultExitRules().profit.partialExits;
  const next = list.map((r, i) => (i === index ? { ...r, ...patch } : r));
  update('exitRules.profit.partialExits', next);
}

function addPartialExit(formData, update) {
  const list = formData.exitRules?.profit?.partialExits || defaultExitRules().profit.partialExits;
  update('exitRules.profit.partialExits', [...list, { enabled: false, pct: 33, atR: 3 }]);
}

function removePartialExit(formData, update, index) {
  const list = formData.exitRules?.profit?.partialExits || [];
  if (list.length <= 1) return;
  const next = list.filter((_, i) => i !== index);
  update('exitRules.profit.partialExits', next);
}

const SectionCard = React.forwardRef(function SectionCard({ id, title, icon, status, expanded, onToggle, children }, ref) {
  const badge = status === 'complete' ? '✅ مكتمل' : status === 'hasContent' ? '🟡 قيد الإكمال' : '';
  return (
    <section ref={ref} id={id} className="bg-s1 border border-border rounded-xl overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between p-4 text-right hover:bg-s2/50 transition-colors">
        <span className="text-lg">{icon}</span>
        <div className="flex items-center gap-2">
          <h2 className="font-medium text-fg">{title}</h2>
          {badge && <span className="text-xs text-muted">{badge}</span>}
        </div>
        <span className="text-muted">{expanded ? '▴' : '▾'}</span>
      </button>
      {expanded && <div className="p-4 pt-0 border-t border-border">{children}</div>}
    </section>
  );
});

import React, { useCallback, useState } from 'react';
import { defaultEntryConditions } from '../../utils/technicalConditionsSchema';
import ConditionRow from './ConditionRow';
import { InlineNumber } from './InlineInput';

// ── Known chart patterns organized by school ──────────────────────────────────
const PATTERN_GROUPS = [
  {
    group: 'أونيل',
    patterns: [
      'Cup & Handle',
      'Cup without Handle',
      'Flat Base',
      'Double Bottom',
      'Ascending Base',
      'IPO Base',
      'High Tight Flag',
      'Saucer Base',
    ],
  },
  {
    group: 'مينرفيني',
    patterns: [
      'VCP',
      'Pivot Breakout',
      'Power Pocket',
      'Stage 2 Breakout',
      'Tight Area',
    ],
  },
  {
    group: 'بيتر برانت',
    patterns: [
      'Rectangle',
      'Symmetrical Triangle',
      'Ascending Triangle',
      'Descending Triangle',
      'Bull Flag',
      'Bear Flag',
      'Pennant',
      'Rising Wedge',
      'Falling Wedge',
      'Inverse Head & Shoulders',
    ],
  },
];

export default function EntryConditions({ data, onChange }) {
  const entry = data || defaultEntryConditions();
  const [customInput, setCustomInput] = useState('');

  const togglePattern = useCallback(
    (p) => {
      const patterns = entry.patterns || [];
      const next = patterns.includes(p) ? patterns.filter((x) => x !== p) : [...patterns, p];
      onChange({ ...entry, patterns: next });
    },
    [entry, onChange]
  );

  const addCustomPattern = useCallback(() => {
    const name = customInput.trim();
    if (!name) return;
    const existing = entry.customPatterns || [];
    if (existing.includes(name)) return;
    onChange({ ...entry, customPatterns: [...existing, name] });
    setCustomInput('');
  }, [customInput, entry, onChange]);

  const removeCustomPattern = useCallback(
    (name) => {
      onChange({ ...entry, customPatterns: (entry.customPatterns || []).filter((p) => p !== name) });
    },
    [entry, onChange]
  );

  const updateEntryRule = useCallback(
    (id, patch) => {
      const rules = (entry.entryRules || []).map((r) => (r.id === id ? { ...r, ...patch } : r));
      onChange({ ...entry, entryRules: rules });
    },
    [entry, onChange]
  );

  const updateVolume = useCallback(
    (patch) => onChange({ ...entry, volumeAtEntry: { ...entry.volumeAtEntry, ...patch } }),
    [entry, onChange]
  );

  const updateVolumeAboveDays = useCallback(
    (patch) => onChange({ ...entry, volumeAboveDays: { ...entry.volumeAboveDays, ...patch } }),
    [entry, onChange]
  );

  const setFreeText = useCallback((v) => onChange({ ...entry, freeText: v }), [entry, onChange]);

  const selectedPatterns = entry.patterns || [];
  const customPatterns = entry.customPatterns || [];

  return (
    <div className="space-y-6">
      {/* ── النموذج السعري ───────────────────────────────────────────────── */}
      <div>
        <label className="block text-muted text-sm mb-3">النموذج السعري المطلوب</label>

        {PATTERN_GROUPS.map(({ group, patterns }) => (
          <div key={group} className="mb-4">
            <p className="text-[0.65rem] text-muted/70 uppercase tracking-widest mb-2">— {group}</p>
            <div className="flex flex-wrap gap-2">
              {patterns.map((p) => {
                const selected = selectedPatterns.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePattern(p)}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                      selected ? 'border-gold bg-gold/20 text-gold' : 'border-border text-muted hover:border-gold/50'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Custom patterns */}
        <div>
          <p className="text-[0.65rem] text-muted/70 uppercase tracking-widest mb-2">— مخصص</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {customPatterns.map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gold bg-gold/20 text-gold text-sm"
              >
                {p}
                <button
                  type="button"
                  onClick={() => removeCustomPattern(p)}
                  className="hover:text-red-400 leading-none ml-1"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomPattern()}
              placeholder="اكتب اسم النموذج..."
              className="flex-1 bg-s2 border border-border rounded-lg px-3 py-1.5 text-sm text-fg placeholder-muted"
              dir="rtl"
            />
            <button
              type="button"
              onClick={addCustomPattern}
              disabled={!customInput.trim()}
              className="px-4 py-1.5 rounded-lg border border-gold/50 text-gold text-sm hover:bg-gold/10 disabled:opacity-40"
            >
              + إضافة
            </button>
          </div>
        </div>
      </div>

      {/* ── قواعد نقطة الدخول ────────────────────────────────────────────── */}
      <div>
        <label className="block text-muted text-sm mb-2">قواعد نقطة الدخول</label>
        <div className="space-y-1.5">
          {(entry.entryRules || []).map((rule) => (
            <ConditionRow
              key={rule.id}
              row={{ ...rule, timeframe: 'يومي' }}
              onChange={(patch) => updateEntryRule(rule.id, patch)}
              deletable={false}
              borderColor="#f0b429"
              showTimeframe={false}
            >
              {rule.type === 'pivot_pct' && (
                <>
                  لا تدخل إذا تجاوز السعر الـ Pivot بأكثر من{' '}
                  <InlineNumber value={rule.value} onChange={(v) => updateEntryRule(rule.id, { value: v })} />%
                </>
              )}
              {rule.type === 'pullback' && <>الدخول عند أول pullback بعد الاختراق</>}
              {rule.type === 'manual_price' && (
                <>
                  الدخول عند إغلاق فوق{' '}
                  <input
                    type="text"
                    value={rule.value ?? ''}
                    onChange={(e) => updateEntryRule(rule.id, { value: e.target.value })}
                    placeholder="___"
                    className="w-20 bg-s3 border border-border rounded px-2 py-0.5 text-sm"
                    dir="ltr"
                  />{' '}
                  (محدد يدوياً)
                </>
              )}
            </ConditionRow>
          ))}
        </div>
      </div>

      {/* ── الحجم عند الدخول ─────────────────────────────────────────────── */}
      <div>
        <label className="block text-muted text-sm mb-2">الحجم عند الدخول</label>
        <div className="space-y-1.5">
          <ConditionRow
            row={{ id: 'vol1', enabled: entry.volumeAtEntry?.enabled !== false, timeframe: 'يومي' }}
            onChange={(patch) => updateVolume(patch)}
            deletable={false}
            borderColor="#f0b429"
            showTimeframe={false}
          >
            حجم يوم الدخول ≥ المتوسط بـ{' '}
            <InlineNumber value={entry.volumeAtEntry?.pct ?? 40} onChange={(v) => updateVolume({ pct: v })} />%
          </ConditionRow>
          <ConditionRow
            row={{ id: 'vol2', enabled: entry.volumeAboveDays?.enabled === true, timeframe: 'يومي' }}
            onChange={(patch) => updateVolumeAboveDays(patch)}
            deletable={false}
            borderColor="#f0b429"
            showTimeframe={false}
          >
            حجم الاختراق أعلى من{' '}
            <InlineNumber value={entry.volumeAboveDays?.days ?? 3} onChange={(v) => updateVolumeAboveDays({ days: v })} min={1} />{' '}
            أيام الماضية
          </ConditionRow>
        </div>
      </div>

      {/* ── قواعد دخول إضافية ────────────────────────────────────────────── */}
      <div>
        <label className="block text-muted text-sm mb-2">قواعد دخول إضافية</label>
        <textarea
          value={entry.freeText || ''}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="مثال: تأكد من عدم وجود مقاومة كبيرة فوق نقطة الدخول مباشرة"
          className="w-full min-h-[80px] bg-s2 border border-border rounded-lg p-3 text-sm"
          dir="rtl"
        />
      </div>
    </div>
  );
}

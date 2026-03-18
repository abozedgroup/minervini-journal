import React, { useCallback, useState } from 'react';
import { defaultTrendConditions, nanoid } from '../../utils/technicalConditionsSchema';
import ConditionRow from './ConditionRow';
import { InlineNumber, InlineSelect } from './InlineInput';

const CARD_COLORS = { price: '#06d6a0', rsi: '#118ab2', volume: '#f0b429', rs: '#ff9500' };
const PRICE_OPERATORS = [
  { value: 'فوق', label: 'فوق' },
  { value: 'تحت', label: 'تحت' },
  { value: 'يتقاطع فوق', label: 'يتقاطع فوق' },
  { value: 'يتقاطع تحت', label: 'يتقاطع تحت' },
];
const MA_TYPES = [
  { value: 'EMA', label: 'EMA' },
  { value: 'SMA', label: 'SMA' },
  { value: 'WMA', label: 'WMA' },
  { value: 'قيمة', label: 'قيمة' },
];

export default function TrendConditions({ data, onChange }) {
  const trend = data || defaultTrendConditions();
  const [customTextOpen, setCustomTextOpen] = useState(false);

  const updateCard = useCallback(
    (cardKey, patch) => {
      onChange({ ...trend, [cardKey]: { ...trend[cardKey], ...patch } });
    },
    [trend, onChange]
  );

  const updateRow = useCallback(
    (cardKey, rowId, patch) => {
      const card = trend[cardKey];
      if (!card.rows) return;
      const rows = card.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r));
      updateCard(cardKey, { rows });
    },
    [updateCard, trend]
  );

  const updateCustomRow = useCallback(
    (cardKey, rowId, patch) => {
      const card = trend[cardKey];
      const customRows = (card.customRows || []).map((r) => (r.id === rowId ? { ...r, ...patch } : r));
      updateCard(cardKey, { customRows });
    },
    [updateCard, trend]
  );

  const addCustomRow = useCallback(
    (cardKey) => {
      const card = trend[cardKey];
      const customRows = [...(card.customRows || []), { id: nanoid(), enabled: true, operator: 'فوق', type: 'EMA', period: 200, timeframe: 'يومي' }];
      updateCard(cardKey, { customRows });
    },
    [updateCard, trend]
  );

  const removeCustomRow = useCallback(
    (cardKey, id) => {
      const card = trend[cardKey];
      const customRows = (card.customRows || []).filter((r) => r.id !== id);
      updateCard(cardKey, { customRows });
    },
    [updateCard, trend]
  );

  const setCustomText = useCallback(
    (value) => onChange({ ...trend, customText: value }),
    [trend, onChange]
  );

  const countActive = (card) => {
    const fromRows = (card.rows || []).filter((r) => r.enabled).length;
    const fromCustom = (card.customRows || []).filter((r) => r.enabled).length;
    return fromRows + fromCustom;
  };

  const renderPriceRow = (row, color) => {
    if (row.id === 'p1' || row.id === 'p2' || row.id === 'p3') {
      return (
        <>
          السعر فوق EMA( <InlineNumber value={row.period} onChange={(v) => updateRow('price', row.id, { period: v })} /> ){' '}
        </>
      );
    }
    if (row.id === 'p4' || row.id === 'p5') {
      return (
        <>
          EMA( <InlineNumber value={row.period1} onChange={(v) => updateRow('price', row.id, { period1: v })} /> ) فوق EMA( <InlineNumber value={row.period2} onChange={(v) => updateRow('price', row.id, { period2: v })} /> ){' '}
        </>
      );
    }
    if (row.id === 'p6') {
      return (
        <>
          EMA( <InlineNumber value={row.period} onChange={(v) => updateRow('price', row.id, { period: v })} /> ) صاعد منذ <InlineNumber value={row.weeks} onChange={(v) => updateRow('price', row.id, { weeks: v })} min={1} max={52} /> أسابيع{' '}
        </>
      );
    }
    return null;
  };

  const renderPriceCustomRow = (row) => (
    <>
      السعر <InlineSelect value={row.operator} onChange={(v) => updateCustomRow('price', row.id, { operator: v })} options={PRICE_OPERATORS} />{' '}
      <InlineSelect value={row.type} onChange={(v) => updateCustomRow('price', row.id, { type: v })} options={MA_TYPES} />(
      <InlineNumber value={row.period} onChange={(v) => updateCustomRow('price', row.id, { period: v })} />){' '}
    </>
  );

  const renderRsiRow = (row) => {
    if (row.id === 'r1') {
      return (
        <>
          RSI( <InlineNumber value={row.period} onChange={(v) => updateRow('rsi', row.id, { period: v })} /> ) بين <InlineNumber value={row.min} onChange={(v) => updateRow('rsi', row.id, { min: v })} /> و <InlineNumber value={row.max} onChange={(v) => updateRow('rsi', row.id, { max: v })} />{' '}
        </>
      );
    }
    if (row.id === 'r2') {
      return (
        <>
          RSI( <InlineNumber value={row.period} onChange={(v) => updateRow('rsi', row.id, { period: v })} /> ) فوق <InlineNumber value={row.threshold} onChange={(v) => updateRow('rsi', row.id, { threshold: v })} />{' '}
        </>
      );
    }
    if (row.id === 'r3') {
      return (
        <>
          MA( <InlineNumber value={row.ma1} onChange={(v) => updateRow('rsi', row.id, { ma1: v })} /> ) على RSI فوق MA( <InlineNumber value={row.ma2} onChange={(v) => updateRow('rsi', row.id, { ma2: v })} /> ) على RSI{' '}
        </>
      );
    }
    if (row.id === 'r4') {
      return (
        <>
          RSI في اتجاه صاعد خلال آخر <InlineNumber value={row.candles} onChange={(v) => updateRow('rsi', row.id, { candles: v })} min={1} /> شمعات{' '}
        </>
      );
    }
    return null;
  };

  const renderVolumeRow = (row) => {
    if (row.id === 'v1') {
      return (
        <>
          حجم الاختراق فوق المتوسط( <InlineNumber value={row.maPeriod} onChange={(v) => updateRow('volume', row.id, { maPeriod: v })} /> ) بـ <InlineNumber value={row.pct} onChange={(v) => updateRow('volume', row.id, { pct: v })} />%{' '}
        </>
      );
    }
    if (row.id === 'v2') return <>Volume Dry-Up في آخر <InlineNumber value={row.days} onChange={(v) => updateRow('volume', row.id, { days: v })} min={1} /> أيام</>;
    if (row.id === 'v3') return <>OBV في اتجاه صاعد</>;
    if (row.id === 'v4') {
      return (
        <>
          حجم اليوم أعلى من أمس بـ <InlineNumber value={row.pct} onChange={(v) => updateRow('volume', row.id, { pct: v })} />%{' '}
        </>
      );
    }
    return null;
  };

  const renderRsRow = (row) => {
    if (row.id === 'rs1') {
      return (
        <>
          RS Rating ≥ <InlineNumber value={row.threshold} onChange={(v) => updateRow('rs', row.id, { threshold: v })} min={0} max={100} />{' '}
        </>
      );
    }
    if (row.id === 'rs2') return <>RS Rating في تحسن مستمر</>;
    if (row.id === 'rs3') {
      return (
        <>
          السهم في أعلى <InlineNumber value={row.pct} onChange={(v) => updateRow('rs', row.id, { pct: v })} min={1} max={100} />% من قوة السوق{' '}
        </>
      );
    }
    return null;
  };

  const Card = ({ cardKey, label, icon, rows, customRows, onAddCustom, renderRow, renderCustomRow }) => {
    const card = trend[cardKey];
    const color = CARD_COLORS[cardKey];
    const n = countActive(card);

    return (
      <div className="rounded-xl border border-border overflow-hidden bg-s1" style={{ borderRightWidth: 4, borderRightColor: color }}>
        <div className="flex items-center justify-between p-3 bg-s2/50">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateCard(cardKey, { enabled: !card.enabled })}
              className={`w-[22px] h-[22px] rounded flex items-center justify-center text-xs ${card.enabled ? 'bg-teal text-white' : 'bg-s3 text-muted'}`}
            >
              {card.enabled ? '✓' : '○'}
            </button>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="font-medium text-fg">{label}</span>
            {n > 0 && <span className="text-muted text-xs">[{n}] شرط نشط</span>}
          </div>
        </div>
        <div className={`p-3 ${!card.enabled ? 'opacity-60' : ''}`}>
          {(card.rows || []).map((row) => (
            <ConditionRow
              key={row.id}
              row={row}
              onChange={(patch) => updateRow(cardKey, row.id, patch)}
              deletable={false}
              borderColor={color}
              showTimeframe={true}
            >
              {renderRow(row)}
            </ConditionRow>
          ))}
          {(card.customRows || []).map((row) => (
            <ConditionRow
              key={row.id}
              row={row}
              onChange={(patch) => updateCustomRow(cardKey, row.id, patch)}
              onDelete={() => removeCustomRow(cardKey, row.id)}
              deletable={true}
              borderColor={color}
              showTimeframe={true}
            >
              {renderCustomRow ? renderCustomRow(row) : renderRow(row)}
            </ConditionRow>
          ))}
          {onAddCustom && (
            <button type="button" onClick={() => onAddCustom()} className="text-sm text-teal hover:underline mt-1">
              + إضافة شرط
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card
        cardKey="price"
        label="السعر"
        icon="📈"
        rows={trend.price?.rows}
        customRows={trend.price?.customRows}
        onAddCustom={() => addCustomRow('price')}
        renderRow={renderPriceRow}
        renderCustomRow={renderPriceCustomRow}
      />
      <Card
        cardKey="rsi"
        label="RSI"
        icon="📊"
        rows={trend.rsi?.rows}
        customRows={trend.rsi?.customRows}
        onAddCustom={() => addCustomRow('rsi')}
        renderRow={renderRsiRow}
      />
      <Card
        cardKey="volume"
        label="الحجم"
        icon="📦"
        rows={trend.volume?.rows}
        customRows={trend.volume?.customRows}
        onAddCustom={() => addCustomRow('volume')}
        renderRow={renderVolumeRow}
      />
      <Card
        cardKey="rs"
        label="RS Rating"
        icon="⭐"
        rows={trend.rs?.rows}
        renderRow={renderRsRow}
      />
      <div className="border border-border rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setCustomTextOpen((o) => !o)}
          className="w-full flex items-center justify-between p-3 text-right text-muted hover:bg-s2/50"
        >
          <span>✏️ ملاحظات وشروط إضافية</span>
          <span>{customTextOpen ? '▴' : '▾'}</span>
        </button>
        {customTextOpen && (
          <div className="p-3 border-t border-border">
            <textarea
              value={trend.customText || ''}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="أي شروط اتجاه إضافية لا تندرج ضمن المؤشرات أعلاه..."
              className="w-full min-h-[80px] bg-s2 border border-border rounded-lg p-3 text-sm"
              dir="rtl"
            />
          </div>
        )}
      </div>
    </div>
  );
}

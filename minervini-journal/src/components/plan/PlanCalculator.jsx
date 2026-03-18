import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { debounce } from '../../utils/debounce';
import { calcPlan, calcRR } from '../../utils/stockCalcs';

const DEBOUNCE_MS = 300;
const RISK_OPTIONS = [0.5, 1, 1.5, 2];

const PlanCalculator = ({
  pivot,
  stop,
  settings,
  onChange,
  showExecution = false,
}) => {
  const [localPivot, setLocalPivot] = useState(pivot ?? '');
  const [localStop, setLocalStop] = useState(stop ?? '');
  const [rrMode, setRrMode] = useState('resistance');
  const [resistance, setResistance] = useState('');
  const [rrManual, setRrManual] = useState('');
  const [riskPct, setRiskPct] = useState(
    () => settings?.defaultRiskPct ?? 1.5
  );
  const debouncedOnChange = useRef(
    debounce((data) => onChange && onChange(data), DEBOUNCE_MS)
  ).current;

  useEffect(() => {
    setLocalPivot(pivot ?? '');
  }, [pivot]);
  useEffect(() => {
    setLocalStop(stop ?? '');
  }, [stop]);

  const pivotNum = parseFloat(localPivot);
  const stopNum = parseFloat(localStop);
  const resistanceNum = resistance === '' ? null : parseFloat(resistance);
  const rrManualNum = rrManual === '' ? null : parseFloat(rrManual);

  const plan = useMemo(
    () =>
      calcPlan(
        pivotNum,
        stopNum,
        settings || {},
        { riskPct: riskPct }
      ),
    [pivotNum, stopNum, settings, riskPct]
  );
  const rrResult = useMemo(
    () =>
      calcRR(pivotNum, stopNum, resistanceNum, rrManualNum),
    [pivotNum, stopNum, resistanceNum, rrManualNum]
  );

  useEffect(() => {
    if (!pivotNum || !stopNum) return;
    debouncedOnChange({
      pivot: pivotNum,
      stop: stopNum,
      resistance: rrMode === 'resistance' ? resistanceNum : null,
      rrManual: rrMode === 'manual' ? rrManualNum : null,
      rrMode,
      riskPct,
    });
  }, [pivotNum, stopNum, resistanceNum, rrManualNum, rrMode, riskPct, debouncedOnChange]);

  const rr = rrResult?.rr ?? 0;
  const targetRef = rrResult?.targetRef;
  const rrClass =
    rr >= 3 ? 'text-teal' : rr >= 2 ? 'text-gold' : 'text-red';
  const rrLabel =
    rr >= 3 ? '✓ ممتاز' : rr >= 2 ? '✓ مقبول' : '⚠️ ضعيف';
  const positionPct = plan?.positionPct ?? 0;
  const showPositionWarning = positionPct > 25;
  const showRrWarning = rr > 0 && rr < 2;
  const showRrInfo = rr >= 2 && rr < 3;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-muted text-xs mb-1">نقطة الاختراق (Pivot)</label>
        <input
          type="number"
          step="0.01"
          value={localPivot}
          onChange={(e) => setLocalPivot(e.target.value)}
          placeholder="سعر الاختراق من الشارت"
          className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg font-mono"
          dir="ltr"
        />
      </div>
      <div>
        <label className="block text-muted text-xs mb-1">وقف الخسارة (Stop Loss)</label>
        <input
          type="number"
          step="0.01"
          value={localStop}
          onChange={(e) => setLocalStop(e.target.value)}
          placeholder="تحت آخر تضيق في النموذج"
          className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg font-mono"
          dir="ltr"
        />
      </div>
      <div>
        <label className="block text-muted text-xs mb-1">تحديد R:R</label>
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => setRrMode('resistance')}
            className={`px-3 py-1.5 rounded text-sm ${rrMode === 'resistance' ? 'bg-gold/20 text-gold border border-gold/50' : 'bg-s2 border border-border text-muted'}`}
          >
            سعر المقاومة $
          </button>
          <button
            type="button"
            onClick={() => setRrMode('manual')}
            className={`px-3 py-1.5 rounded text-sm ${rrMode === 'manual' ? 'bg-gold/20 text-gold border border-gold/50' : 'bg-s2 border border-border text-muted'}`}
          >
            R:R مباشرة
          </button>
        </div>
        {rrMode === 'resistance' && (
          <input
            type="number"
            step="0.01"
            value={resistance}
            onChange={(e) => setResistance(e.target.value)}
            placeholder="أقرب مقاومة من الشارت"
            className="w-full bg-s2 border border-border rounded-lg px-3 py-2 text-fg font-mono"
            dir="ltr"
          />
        )}
        {rrMode === 'manual' && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.1"
              value={rrManual}
              onChange={(e) => setRrManual(e.target.value)}
              placeholder="R:R"
              className="w-24 bg-s2 border border-border rounded-lg px-3 py-2 text-fg font-mono"
              dir="ltr"
            />
            <span className="text-muted text-sm">:1</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {RISK_OPTIONS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setRiskPct(p)}
            className={`px-2 py-1 rounded text-xs font-mono ${riskPct === p ? 'bg-gold text-black' : 'bg-s2 border border-border text-muted'}`}
          >
            {p}%
          </button>
        ))}
      </div>

      {plan && (
        <div className="rounded-lg border border-border bg-s2/50 p-3 space-y-2 text-sm">
          <div>
            <span className="text-muted text-xs">R:R المبدئي</span>
            <div className={`font-mono font-medium ${rrClass}`}>
              {rr.toFixed(1)} : 1 {rrLabel}
            </div>
          </div>
          {targetRef != null && (
            <div className="text-muted text-xs">
              الهدف المرجعي: ${targetRef.toFixed(2)} *
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-muted">المخاطرة بالدولار</span><div className="font-mono">{plan.riskAmount != null ? `$${plan.riskAmount.toLocaleString()}` : '—'}</div></div>
            <div><span className="text-muted">نسبة المخاطرة</span><div className="font-mono">{plan.riskPct}%</div></div>
            <div><span className="text-muted">عدد الأسهم</span><div className="font-mono">{plan.shares} سهم</div></div>
            <div><span className="text-muted">قيمة المركز</span><div className="font-mono">{plan.positionValue != null ? `$${plan.positionValue?.toLocaleString()} (${plan.positionPct}%)` : '—'}</div></div>
          </div>
          {showPositionWarning && (
            <div className="rounded p-2 bg-gold/20 border border-gold/50 text-amber-200 text-xs">
              ⚠️ المركز {plan.positionPct}% — يتجاوز 25% الموصى به. قلّص نسبة المخاطرة أو انتظر setup أفضل.
            </div>
          )}
          {showRrWarning && (
            <div className="rounded p-2 bg-red/20 border border-red/50 text-red text-xs">
              ⚠️ R:R ضعيف — مينيرفيني لا يدخل تحت 2:1
            </div>
          )}
          {showRrInfo && (
            <div className="rounded p-2 bg-gold/10 border border-gold/30 text-amber-200 text-xs">
              ℹ️ R:R مقبول — المثالي 3:1 وأعلى
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(PlanCalculator);

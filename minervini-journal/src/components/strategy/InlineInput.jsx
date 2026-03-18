import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { debounce } from '../../utils/debounce';

const inputClass =
  'bg-transparent border-none border-b border-b-gold/40 text-gold font-mono text-[0.85rem] min-w-[35px] max-w-[60px] text-center py-0 px-0.5 outline-none focus:border-b-gold transition-colors';

export function InlineNumber({ value, onChange, min, max, step = 1 }) {
  const [local, setLocal] = useState(value ?? '');
  const debouncedOnChange = useMemo(() => debounce((v) => onChange(v), 400), [onChange]);

  useEffect(() => {
    setLocal(value ?? '');
  }, [value]);

  const handleChange = useCallback(
    (e) => {
      const v = e.target.value;
      setLocal(v);
      const n = v === '' ? null : Number(v);
      if (n !== null && !Number.isNaN(n)) debouncedOnChange(n);
      else debouncedOnChange(v);
    },
    [debouncedOnChange]
  );

  return (
    <input
      type="number"
      value={local}
      onChange={handleChange}
      min={min}
      max={max}
      step={step}
      className={inputClass}
      dir="ltr"
    />
  );
}

export function InlineSelect({ value, onChange, options }) {
  const handleChange = useCallback(
    (e) => onChange(e.target.value),
    [onChange]
  );

  return (
    <select
      value={value ?? ''}
      onChange={handleChange}
      className="bg-s3 border border-border rounded text-[0.75rem] text-fg py-0.5 px-1.5 outline-none"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

export default React.memo(InlineNumber);

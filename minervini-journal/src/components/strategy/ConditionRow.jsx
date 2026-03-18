import React, { useCallback } from 'react';
import { TIMEFRAMES } from '../../utils/technicalConditionsSchema';

function ConditionRowUnmemo({ row, onChange, onDelete, deletable, borderColor, children, showTimeframe = true }) {
  const handleToggle = useCallback(() => {
    onChange({ ...row, enabled: !row.enabled });
  }, [row, onChange]);

  const handleTimeframeChange = useCallback(
    (e) => onChange({ ...row, timeframe: e.target.value }),
    [row, onChange]
  );

  const handleDelete = useCallback(() => {
    if (deletable && onDelete) onDelete(row.id);
  }, [deletable, onDelete, row.id]);

  const borderStyle = row.enabled && borderColor ? { borderColor } : undefined;

  return (
    <div
      className="flex items-center gap-2 p-2 px-3 rounded-lg mb-1.5 transition-all duration-150 border"
      style={{
        background: 'var(--s2)',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: 'var(--border)',
        opacity: row.enabled ? 1 : 0.5,
        ...borderStyle,
      }}
    >
      <button
        type="button"
        onClick={handleToggle}
        className="shrink-0 w-[22px] h-[22px] rounded flex items-center justify-center text-xs font-medium transition-colors"
        style={{
          background: row.enabled ? '#10b981' : 'var(--s3)',
          color: row.enabled ? '#fff' : 'var(--muted)',
          border: 'none',
        }}
        aria-label={row.enabled ? 'تعطيل' : 'تفعيل'}
      >
        {row.enabled ? '✓' : '○'}
      </button>
      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap" style={{ fontSize: '0.82rem', color: row.enabled ? 'var(--text)' : 'var(--muted)' }}>
        {children}
      </div>
      {showTimeframe && (
        <select
          value={row.timeframe || 'يومي'}
          onChange={handleTimeframeChange}
          className="shrink-0 bg-s3 border border-border rounded text-[0.68rem] px-2 py-1 text-fg"
        >
          {TIMEFRAMES.map((tf) => (
            <option key={tf} value={tf}>{tf}</option>
          ))}
        </select>
      )}
      {deletable && onDelete && (
        <button
          type="button"
          onClick={handleDelete}
          className="shrink-0 w-[22px] h-[22px] rounded flex items-center justify-center text-red hover:bg-red/20 transition-colors"
          aria-label="حذف"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export default React.memo(ConditionRowUnmemo);

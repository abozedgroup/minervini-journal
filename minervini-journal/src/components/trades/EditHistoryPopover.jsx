import { useState, useRef, useEffect } from 'react';
import { getEditDiff } from '../../utils/tradeAudit';

export default function EditHistoryPopover({ editHistory }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [open]);

  const history = Array.isArray(editHistory) ? editHistory : [];
  if (history.length === 0) return null;

  return (
    <div className="relative inline-block" ref={ref}>
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gold/20 text-gold hover:bg-gold/30">
        📝 معدَّل
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-80 max-h-72 overflow-y-auto bg-s1 border border-border rounded-xl shadow-xl p-3 z-50">
          <p className="text-muted text-xs font-medium mb-2">سجل التعديلات</p>
          <div className="space-y-3">
            {[...history].reverse().map((record, i) => {
              const changes = getEditDiff(record.before || {}, record.after || {});
              return (
                <div key={i} className="border-b border-border/50 pb-2 last:border-0 last:pb-0">
                  <p className="text-fg text-xs font-medium">
                    {record.editedAt ? new Date(record.editedAt).toLocaleString('ar-SA') : '—'}
                    {record.editedBy ? ` · ${record.editedBy}` : ''}
                  </p>
                  <p className="text-muted text-xs mt-1">{record.reason}</p>
                  {changes.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-fg">
                      {changes.map((c, j) => (
                        <li key={j} className="font-mono">
                          {c.field}: {c.before} ← {c.after}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
